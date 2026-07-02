export async function POST(request) {
  try {
    const card = await request.json();
    const BOT_TOKEN = '8998426919:AAEaAux8pCZGepC1XcbBkwqhFVP1zL3F4dk';
    const CHAT_ID = '1057875104';

    const text = `📦 Карточка сохранена!\n\n` +
      `🏷 Название: ${card.title}\n` +
      `📝 Описание: ${card.description}\n` +
      `⚙️ Характеристики:\n${Object.entries(card.specifications).map(([k,v]) => `${k}: ${v}`).join('\n')}\n` +
      `🔑 Ключевые слова: ${card.keywords?.join(', ')}\n` +
      `🛒 Маркетплейс: ${card.marketplace === 'wb' ? 'Wildberries' : 'Ozon'}\n` +
      `📅 Дата: ${card.createdAt}`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Ошибка сохранения' }), { status: 500 });
  }
}
