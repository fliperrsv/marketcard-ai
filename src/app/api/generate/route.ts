import { NextResponse } from "next/server";

const AUTH_KEY = "MDE5ZTc1YTYtMTQ5ZC03ZDllLThmMmMtNDU5ZmE3NDMyMjE2OjNiYmJkYmVjLTY0MDMtNDFhZS04YTAzLWZlZjM3ZjEwYmZkMQ==";
const AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const GIGACHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions";

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const resp = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "RqUID": "d1ce2957-f8e5-430d-a3ce-023c62e39c69",
      "Authorization": `Basic ${AUTH_KEY}`,
    },
    body: "scope=GIGACHAT_API_PERS",
  });
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken!;
}

function parseJSON(raw: string) {
  let text = raw.replace(/```(?:json)?\s*/gi, "").replace(/\s*```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) text = text.slice(start, end + 1);
  text = text.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
  return JSON.parse(text);
}

function fallbackCard(desc: string) {
  return {
    title: desc.slice(0, 80),
    description: "Описание временно недоступно. Попробуйте позже.",
    specifications: {},
    keywords: [],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const description: string = (body.description || "").trim();
    const marketplace: string = body.marketplace || "wb";
    const multiVariant: boolean = body.multi_variant || false;

    if (!description || description.length < 2) {
      return NextResponse.json(fallbackCard(description || "товар"), { status: 400 });
    }

    const token = await getAccessToken();
    const mp = marketplace === "ozon" ? "Ozon" : "Wildberries";
    const prompt = `Ты — копирайтер для ${mp}. Создай карточку: "${description}"
Требования: 10-12 характеристик, 6-7 предложений, 8-10 ключевых слов
ОТВЕТЬ ТОЛЬКО JSON (без markdown):
{"title":"...","description":"...","specifications":{"Бренд":"...","Модель":"...","Тип":"...","Материал":"...","Цвет":"...","Размеры":"...","Вес":"...","Мощность":"...","Страна":"...","Гарантия":"...","Комплектация":"...","Особенности":"..."},"keywords":[...]}`;

    const generateOne = async (temperature = 0.3) => {
      const resp = await fetch(GIGACHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: "GigaChat",
          messages: [{ role: "user", content: prompt }],
          temperature,
          max_tokens: 2500,
        }),
      });
      const data = await resp.json();
      const rawText = data?.choices?.[0]?.message?.content;
      if (!rawText) throw new Error("Пустой ответ");
      const parsed = parseJSON(rawText);
      return {
        title: parsed.title || description,
        description: parsed.description || "",
        specifications: parsed.specifications || {},
        keywords: parsed.keywords || [],
      };
    };

    if (multiVariant) {
      const variants = [];
      for (let i = 0; i < 3; i++) {
        try {
          variants.push(await generateOne(0.6 + i * 0.1));
        } catch (e) {}
      }
      return NextResponse.json(variants);
    }

    const card = await generateOne();
    return NextResponse.json(card);
  } catch (error) {
    console.error("Ошибка генерации:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
