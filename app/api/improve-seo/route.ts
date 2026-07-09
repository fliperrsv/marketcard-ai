import { NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';

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

function ensureStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
      return item.name || item.value || JSON.stringify(item);
    }
    return String(item);
  });
}

function extractJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('JSON не найден');
  return JSON.parse(text.substring(start, end + 1));
}

export async function POST(request: Request) {
  try {
    const { data, analysis, tone, brand, audience, competitors } = await request.json();
    if (!data) {
      return NextResponse.json({ success: false, error: 'Нет данных' }, { status: 400 });
    }

    const accessToken = await getGigaChatToken();

    const weaknesses = analysis?.weaknesses || ['нет данных'];
    const recommendations = analysis?.recommendations || ['нет рекомендаций'];
    let context = '';
    if (brand) context += `Бренд: ${brand}\n`;
    if (audience) context += `Целевая аудитория: ${audience}\n`;
    if (competitors) context += `Конкуренты: ${competitors}\n`;

    const prompt = `
Ты — SEO-копирайтер. Исправь карточку товара по списку замечаний.

Контекст:
${context}
Текущая карточка:
Заголовок: ${data.title}
Описание: ${data.description}
Преимущества: ${data.advantages?.join('\n')}
Характеристики: ${data.features?.join('\n')}
Ключевые слова: ${data.keywords?.join(', ')}

Слабые стороны (исправить каждую):
${weaknesses.map((w, i) => `${i+1}. ${w}`).join('\n')}

Рекомендации:
${recommendations.map((r, i) => `${i+1}. ${r}`).join('\n')}

Тональность: ${tone || 'деловой'}

Верни ТОЛЬКО JSON без пояснений:
{
  "title": "...",
  "description": "...",
  "advantages": ["..."],
  "features": ["..."],
  "keywords": ["..."]
}`;

    const response = await axios({
      method: 'post',
      url: 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      data: {
        model: 'GigaChat',
        messages: [
          { role: 'system', content: 'Ты — помощник, который возвращает только JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      httpsAgent: httpsAgent,
      timeout: 30000
    });

    const content = response.data.choices?.[0]?.message?.content || '{}';
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      result = extractJSON(content);
    }

    if (result.advantages) result.advantages = ensureStringArray(result.advantages);
    if (result.features) result.features = ensureStringArray(result.features);
    if (result.keywords) result.keywords = ensureStringArray(result.keywords);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Ошибка улучшения:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
