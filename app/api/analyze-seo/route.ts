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
    const { url, text } = await request.json();

    const contentToAnalyze = text || 'Текст не передан';

    if (!text && !url) {
      return NextResponse.json(
        { success: false, error: 'Введите URL или текст для анализа' },
        { status: 400 }
      );
    }

    const accessToken = await getGigaChatToken();

    const prompt = `
Ты — SEO-эксперт для маркетплейсов (Ozon, Wildberries, Яндекс.Маркет).
Проанализируй следующий текст карточки товара и дай рекомендации по улучшению.

Текст для анализа:
"""
${contentToAnalyze.substring(0, 3000)}
"""

Ответ должен быть ТОЛЬКО JSON без лишнего текста, строго по схеме:
{
  "score": 75,
  "strengths": ["сильная сторона 1", "сильная сторона 2"],
  "weaknesses": ["слабое место 1", "слабое место 2"],
  "recommendations": ["рекомендация 1", "рекомендация 2", "рекомендация 3"]
}

Оценка (score) от 0 до 100.`;

    // Искусственная задержка, чтобы не флудить (опционально)
    await new Promise(resolve => setTimeout(resolve, 300));

    const response = await axios({
      method: 'post',
      url: 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      data: {
        model: 'GigaChat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 800
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

    return NextResponse.json({
      success: true,
      data: {
        score: result.score || 70,
        strengths: result.strengths || ['Хорошая структура текста'],
        weaknesses: result.weaknesses || ['Мало ключевых слов'],
        recommendations: result.recommendations || ['Добавьте больше ключевых слов в заголовок']
      }
    });

  } catch (error) {
    console.error('❌ Ошибка SEO-анализа:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка анализа: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
