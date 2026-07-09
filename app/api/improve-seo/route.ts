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

function extractJSON(text) {
  // Находим первый { и последний }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('JSON не найден');
  }
  const jsonStr = text.substring(start, end + 1);
  return JSON.parse(jsonStr);
}

export async function POST(request: Request) {
  try {
    const { data, analysis, tone } = await request.json();
    if (!data) {
      return NextResponse.json({ success: false, error: 'Нет данных' }, { status: 400 });
    }

    const accessToken = await getGigaChatToken();

    // Формируем список замечаний и рекомендаций
    const weaknesses = analysis?.weaknesses || ['нет данных'];
    const recommendations = analysis?.recommendations || ['нет рекомендаций'];

    // Собираем текущие данные в читаемый вид
    const currentData = `
Заголовок: ${data.title || ''}
Описание: ${data.description || ''}
Преимущества: ${(data.advantages || []).join('\n')}
Характеристики: ${(data.features || []).join('\n')}
Ключевые слова: ${(data.keywords || []).join(', ')}
`;

    // Формируем промпт с чёткими инструкциями
    const prompt = `
Ты — профессиональный SEO-копирайтер для маркетплейсов.

Твоя задача: **исправить карточку товара**, устранив все перечисленные недостатки.

**Текущая карточка:**
${currentData}

**Слабые стороны (их нужно обязательно исправить):**
${weaknesses.map((w, i) => `${i+1}. ${w}`).join('\n')}

**Рекомендации по улучшению (используй их как подсказки):**
${recommendations.map((r, i) => `${i+1}. ${r}`).join('\n')}

**Тональность:** ${tone || 'деловой'}

**Инструкция:**
1. Перепиши карточку, сохранив ту же структуру JSON.
2. Устрани **каждое** замечание из списка слабых сторон.
3. Добавь конкретные цифры, факты, УТП.
4. Сделай текст продающим, но читаемым.
5. Не повторяй ключевые слова — используй синонимы.

**Важно:** Верни ТОЛЬКО JSON без пояснений, без markdown, без кавычек-ёлочек. Начинай с { и заканчивай }.

Формат JSON:
{
  "title": "исправленный заголовок",
  "description": "исправленное описание",
  "advantages": ["преимущество 1", ...],
  "features": ["характеристика 1", ...],
  "keywords": ["ключевое слово 1", ...]
}`;

    const response = await axios({
      method: 'post',
      url: 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      data: {
        model: 'GigaChat',
        messages: [
          { role: 'system', content: 'Ты — помощник, который возвращает только JSON без пояснений.' },
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
    console.log('📦 Ответ от GigaChat (первые 300 символов):', content.substring(0, 300));

    // Пытаемся распарсить JSON
    let result;
    try {
      // Сначала пробуем прямой парсинг
      result = JSON.parse(content);
    } catch (e) {
      // Если не получилось — вырезаем JSON
      result = extractJSON(content);
    }

    // Проверяем, что все поля есть
    if (!result.title) result.title = data.title || 'Товар';
    if (!result.description) result.description = data.description || 'Описание';
    if (!result.advantages || !result.advantages.length) result.advantages = data.advantages || ['Качественный товар'];
    if (!result.features || !result.features.length) result.features = data.features || ['Характеристика 1'];
    if (!result.keywords || !result.keywords.length) result.keywords = data.keywords || ['ключевое слово'];

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Ошибка улучшения:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка' },
      { status: 500 }
    );
  }
}
