import http.server
import json
import requests
import re

AUTH_KEY = "MDE5ZTc1YTYtMTQ5ZC03ZDllLThmMmMtNDU5ZmE3NDMyMjE2OjNiYmJkYmVjLTY0MDMtNDFhZS04YTAzLWZlZjM3ZjEwYmZkMQ=="
ARTIFACTS = ["человек","папа","десятый","летний","уще","рих","исход","метр","ик","год","па","ма","нет","да","шум","тип","brand","model","type","color","weight","power"]

def clean_value(value):
    if not isinstance(value, str): return value
    lower = value.lower().strip()
    for a in ARTIFACTS:
        if a in lower: return "-"
    if re.search(r'\d{4}\s*год', lower): return "-"
    return value.strip()

def get_token():
    resp = requests.post(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        headers={"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json","RqUID":"d1ce2957-f8e5-430d-a3ce-023c62e39c69","Authorization":f"Basic {AUTH_KEY}"},
        data="scope=GIGACHAT_API_PERS"
    )
    return resp.json()["access_token"]

def parse_json(raw_text):
    text = re.sub(r'```(?:json)?\s*', '', raw_text.strip(), flags=re.IGNORECASE)
    text = re.sub(r'\s*```', '', text)
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end <= start:
        raise ValueError("JSON не найден")
    json_str = text[start:end+1]
    json_str = re.sub(r',\s*}', '}', json_str)
    json_str = re.sub(r',\s*]', ']', json_str)
    return json.loads(json_str)

def generate_single(description, marketplace, detail, token, temperature=0.3):
    mp_name = "Wildberries" if marketplace=="wb" else "Ozon"
    prompt = f"""Ты — копирайтер для {mp_name}. Создай карточку: "{description}"
Требования: 10-12 характеристик, 6-7 предложений, 8-10 ключевых слов
ОТВЕТЬ ТОЛЬКО JSON (без markdown, без лишних слов):
{{"title":"...","description":"...","specifications":{{"Бренд":"...","Модель":"...","Тип":"...","Материал":"...","Цвет":"...","Размеры":"...","Вес":"...","Мощность":"...","Страна":"...","Гарантия":"...","Комплектация":"...","Особенности":"..."}},"keywords":[...]}}"""
    
    resp = requests.post(
        "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
        headers={"Content-Type":"application/json","Authorization":f"Bearer {token}"},
        json={"model":"GigaChat","messages":[{"role":"user","content":prompt}],"temperature":temperature,"max_tokens":2500}
    )
    
    raw_text = resp.json()["choices"][0]["message"]["content"]
    result = parse_json(raw_text)
    
    title = clean_value(result.get("title", ""))
    desc = clean_value(result.get("description", ""))
    specs = result.get("specifications", {})
    keywords = result.get("keywords", [])
    
    cleaned_specs = {}
    for key, value in specs.items():
        cleaned = clean_value(str(value))
        cleaned_specs[key] = cleaned if cleaned else "-"
    
    if not title or title == "-":
        title = description.capitalize()
    if not desc or desc == "-":
        desc = "Описание будет доступно позже."
    
    return {
        "title": title,
        "description": desc,
        "specifications": cleaned_specs,
        "keywords": [kw.strip() for kw in keywords if kw.strip()]
    }

def generate(description, marketplace, detail, multi_variant=False):
    token = get_token()
    if not multi_variant:
        return generate_single(description, marketplace, detail, token)
    
    variants = []
    for i in range(3):
        try:
            variants.append(generate_single(description, marketplace, detail, token, temperature=0.6))
        except Exception as e:
            print(f"Ошибка варианта {i}: {e}")
    while len(variants) < 3:
        try:
            variants.append(generate_single(description, marketplace, detail, token, temperature=0.8))
        except: break
    return variants

class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length",0))
        body = self.rfile.read(length)
        data = json.loads(body)
        try:
            result = generate(
                data.get("description",""),
                data.get("marketplace","wb"),
                data.get("detail","max"),
                data.get("multi_variant", False)
            )
            self.send_response(200)
            self.send_header("Content-Type","application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode())
        except Exception as e:
            print("Ошибка:", e)
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error":str(e)}).encode())

if __name__ == "__main__":
    server = http.server.HTTPServer(("localhost",5555), Handler)
    print("GigaChat сервер v3.3.1 запущен на порту 5555")
    server.serve_forever()
