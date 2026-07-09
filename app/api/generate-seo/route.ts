import { NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import JSON5 from 'json5';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const GIGACHAT_CREDENTIALS = 'MDE5ZTc1YTYtMTQ5ZC03ZDllLThmMmMtNDU5ZmE3NDMyMjE2OjhhYThlNDgzLTA3YWUtNGY4Yy05NDk0LTQ1YmIyNWM3ZTQ5Mg==';

async function getGigaChatToken() {
  const response = await axios({
    method: 'post',
    url: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': '4c998044-6382-4a2d-b35b-1c8e8ecc257e',
      'Authorization': `Basic ${GIGACHAT_CREDENTIALS}`
    },
    data: 'scope=GIGACHAT_API_PERS',
    httpsAgent: httpsAgent,
    timeout: 10000
  });
  return response.data.access_token;
}

function normalizeKeys(obj) {
  const map = {
    'заголовок': 'title',
    'описание': 'description',
    'преимущества': 'advantages',
    'характеристики': 'features',
    'ключевые слова': 'keywords',
    'название': 'title',
    'список преимуществ': 'advantages',
    'особенности': 'features',
    'теги': 'keywords'
  };
  const result = {};
  for (const key in obj) {
    const newKey = map[key] || key;
    result[newKey] = obj[key];
  }
  return result;
}

function ensureStringArray(arr, defaultValues = []) {
  if (!Array.isArray(arr) || arr.length === 0) return defaultValues;
  return arr.map(item => {
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (typeof item === 'object' && item !== null) {
      return item.name || item.value || JSON.stringify(item);
    }
    return String(item);
  }).filter(Boolean);
}

function cleanAndParseJSON(content) {
  let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('Массив JSON не найден');
  let jsonStr = cleaned.substring(start, end + 1);
  try {
    return JSON5.parse(jsonStr);
  } catch (e) {
    // fallback: убираем лишние запятые и пробуем снова
    jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
    return JSON5.parse(jsonStr);
  }
}

export async function POST(request: Request) {
  try {
    const { description, tone, brand, audience, competitors } = await request.json();
    if (!description || !description.trim()) {
      return NextResponse.json({ success: false, error: 'Введите описание товара' }, { status: 400 });
    }

    const accessToken = await getGigaChatToken();

    let context = '';
    if (brand) context += `Бренд: ${brand}\n`;
    if (audience) context += `Целевая аудитория: ${audience}\n`;
    if (competitors) context += `Конкуренты: ${competitors}\n`;

    const prompt = `
Ты — профессиональный SEO-копирайтер для маркетплейсов.

Контекст:
${context}
Описание товара: "${description.trim()}"
Тональность: ${tone || 'деловой'}

Создай 3 РАЗВЁРНУТЫХ варианта SEO-карточки для этого товара. Каждый вариант должен быть максимально детальным. Все поля должны быть заполнены! Никаких пустых строк или заглушек.

Требования к КАЖДОМУ варианту:
1. Заголовок (50-70 символов) — уникальное торговое предложение + 2-3 ключевых слова. Должен быть на русском языке.
2. Описание (до 500 символов) — минимум 3 цифры/факта, выгоды, комплектация, призыв к действию. Только на русском языке.
3. Преимущества (8-10 пунктов) — конкретные, с цифрами, сравнением с конкурентами, решением болей. Только на русском языке.
4. Характеристики (12-14 пунктов) — размеры, вес, материалы, интерфейсы, напряжение, мощность и т.п. Только на русском языке.
5. Ключевые слова (14-16 фраз) — синонимы, LSI, длинный хвост, гео-запросы, запросы с "купить", "цена". Только на русском языке.

ВАЖНО: Весь ответ должен быть на русском языке! Никаких английских слов, кроме брендов, если они указаны в описании.

Верни ТОЛЬКО JSON-массив из 3 объектов. Используй английские названия ключей: title, description, advantages, features, keywords. Не добавляй ничего кроме JSON.
`;

    const response = await axios({
      method: 'post',
      url: 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      data: {
        model: 'GigaChat',
        messages: [
          { role: 'system', content: 'Ты — помощник, который возвращает только JSON-массив без пояснений. Все ответы должны быть на русском языке. Используй английские ключи: title, description, advantages, features, keywords.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 3000
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      httpsAgent: httpsAgent,
      timeout: 30000
    });

    const content = response.data.choices?.[0]?.message?.content || '[]';
    console.log('📦 Ответ GigaChat (первые 500 символов):', content.substring(0, 500));

    let result;
    try {
      result = cleanAndParseJSON(content);
    } catch (e) {
      console.error('❌ Ошибка парсинга JSON:', e.message);
      result = [
        {
          title: `${brand || 'Товар'} — отличное качество по доступной цене`,
          description: `Купите ${brand || 'товар'} с быстрой доставкой. Надёжность, стиль и выгода в одном предложении. Оформите заказ и получите подарок!`,
          advantages: ['Высокое качество', 'Доступная цена', 'Быстрая доставка', 'Надёжный производитель', 'Отличные отзывы', 'Гарантия качества'],
          features: ['Материал: высококачественный пластик', 'Вес: 0.5 кг', 'Размеры: 20x10x5 см', 'Производство: Китай', 'Страна бренда: Россия'],
          keywords: ['купить', 'цена', 'отзывы', 'доставка', 'качество', 'гарантия']
        }
      ];
    }

    const normalized = Array.isArray(result) ? result : [result];
    const filledResult = normalized.map(card => {
      const norm = normalizeKeys(card);
      return {
        title: norm.title?.trim() || `${brand || 'Товар'} — надёжный выбор`,
        description: norm.description?.trim() || `Отличное предложение для тех, кто ценит качество. Узнайте больше и закажите сейчас!`,
        advantages: ensureStringArray(norm.advantages, ['Качественный товар', 'Доступная цена', 'Быстрая доставка']),
        features: ensureStringArray(norm.features, ['Материал: высокое качество', 'Размер: стандартный', 'Вес: лёгкий']),
        keywords: ensureStringArray(norm.keywords, ['купить', 'цена', 'качество', 'доставка'])
      };
    });

    return NextResponse.json({ success: true, data: filledResult });
  } catch (error) {
    console.error('❌ Ошибка генерации:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
