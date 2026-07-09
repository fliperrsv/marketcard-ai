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

export async function POST(request: Request) {
  try {
    const { description, tone } = await request.json();

    if (!description) {
      return NextResponse.json(
        { success: false, error: 'Введите описание товара' },
        { status: 400 }
      );
    }

    const accessToken = await getGigaChatToken();
    console.log('✅ Токен GigaChat получен');

    const prompt = `
Ты — профессиональный SEO-копирайтер для маркетплейсов (Ozon, Wildberries, Яндекс.Маркет). Создай карточку товара, которая получит 90+ баллов по SEO-анализу.

Описание товара: "${description}"
Тональность: ${tone === 'деловой' ? 'деловая, факты, цифры' : tone === 'дружеский' ? 'дружелюбная, доверительная' : tone === 'креативный' ? 'креативная, эмоциональная' : 'научная, техническая'}

Жёсткие требования (каждое должно быть выполнено):

1. **Заголовок** (50-70 символов):
   - Включает УТП (уникальное торговое предложение, которое отличает товар от аналогов).
   - Содержит 2-3 ключевых слова.
   - Пример: "Смартфон с батареей на 2 дня и защитой Gorilla Glass 5".

2. **Описание** (140-160 символов):
   - Первое предложение — УТП и выгода для покупателя.
   - **Минимум 2 цифры/факта** (например, "автономность до 48 часов", "зарядка до 100% за 30 минут").
   - Короткие предложения (до 12 слов).
   - Упомянуть отзывы или рейтинг (например, "4.8 на Яндекс.Маркете").
   - Призыв к действию с указанием бонуса (например, "Оформите заказ и получите защитное стекло в подарок").

3. **Преимущества** (7-9 пунктов):
   - **Первый пункт** — прямое сравнение с конкурентами (например, "В отличие от других смартфонов, наша модель поддерживает ...").
   - **Минимум 4 пункта с цифрами и точными значениями** (например, "батарея 4500 мАч", "камера 108 МП", "защита IP68").
   - Остальные — решают боли покупателя (безопасность, долговечность, удобство, скорость).
   - Один пункт — отзывы/рейтинг (например, "Получил оценку 4.9 от пользователей за надёжность").

4. **Характеристики** (12-14 пунктов):
   - Максимально конкретные параметры с единицами измерения.
   - Добавить 2-3 специфических показателя (например, для смартфона — тип матрицы, частота обновления экрана, версия Bluetooth).
   - Полная комплектация с деталями.
   - Совместимость (например, с поддержкой Google Pay, NFC).

5. **Ключевые слова** (12-15 фраз):
   - Основные высокочастотные запросы (2-3).
   - Синонимы и вариации (например, "смартфон" → "телефон", "девайс", "гаджет").
   - Длинный хвост (фразы из 4+ слов, включая характеристики).
   - **Не повторять одинаковые ключевые слова в разных разделах.**

Важно: УТП должно быть чётким и конкретным, а не общим. Все цифры и факты должны быть правдоподобными. Не перегружайте текст одинаковыми ключевиками.

Ответ — только JSON без лишнего текста:
{
  "title": "строка",
  "description": "строка",
  "advantages": ["пункт 1", ...],
  "features": ["пункт 1", ...],
  "keywords": ["фраза 1", ...]
}`;

    const response = await axios({
      method: 'post',
      url: 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      data: {
        model: 'GigaChat-2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
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
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanContent);

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка генерации: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
