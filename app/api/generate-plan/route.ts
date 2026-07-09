import { NextResponse } from 'next/server';
import { runSimulation } from '../../../lib/runSimulation';
import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Твой Base64-ключ для GigaChat (clientId:secret)
const GIGACHAT_CREDENTIALS = 'MDE5ZTc1YTYtMTQ5ZC03ZDllLThmMmMtNDU5ZmE3NDMyMjE2OjhhYThlNDgzLTA3YWUtNGY4Yy05NDk0LTQ1YmIyNWM3ZTQ5Mg==';

// Функция получения токена GigaChat
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
    const { niche, city, budget } = await request.json();
    
    // Получаем токен GigaChat
    const accessToken = await getGigaChatToken();
    console.log('✅ Токен GigaChat получен');
    
    // Запускаем симуляцию с реальными данными
    const topCampaigns = await runSimulation({ niche, city, budget });
    
    // Формируем промпт
    let prompt = `Ты — профессиональный маркетинговый аналитик.
На основе 10 000 симуляций рекламных кампаний для ниши "${niche}" в городе ${city}
были выявлены лучшие стратегии. Бюджет: ${budget} ₽.

Вот топ-10 кампаний (по прибыли):\n`;

    topCampaigns.forEach((c: any, i: number) => {
      prompt += `
${i+1}. Ставка: ${c.bid} ₽ | CTR: ${c.ctr}% | Кликов: ${c.clicks} |
   Конверсий: ${c.conversions} | Прибыль: ${c.profit.toFixed(0)} ₽ | ROI: ${c.roi.toFixed(0)}%\n`;
    });

    prompt += `
На основе этих данных составь готовый план рекламной кампании:
1. **Рекомендуемая ставка за клик:**
2. **Прогноз по бюджету:** сколько кликов, конверсий и прибыли
3. **Текст объявления:** 3 заголовка + 2 описания
4. **Целевая аудитория:** возраст, интересы, гео
5. **Бюджет на 7 дней:** как распределить
6. **Прогноз ROI:** минимальный, средний, максимальный
Ответ структурируй как готовое коммерческое предложение.`;

    // Отправляем запрос в GigaChat
    const response = await axios({
      method: 'post',
      url: 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      data: {
        model: 'GigaChat-2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      httpsAgent: httpsAgent,
      timeout: 30000
    });

    const plan = response.data.choices?.[0]?.message?.content || 'Нет ответа от GigaChat';
    
    return NextResponse.json({ success: true, topCampaigns, plan });

  } catch (error) {
    console.error('❌ Ошибка:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
