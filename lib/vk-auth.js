import axios from 'axios';

const CLIENT_ID = process.env.VK_CLIENT_ID;
const CLIENT_SECRET = process.env.VK_CLIENT_SECRET;

export async function getVkAccessToken() {
  try {
    const response = await axios({
      method: 'post',
      url: 'https://ads.vk.com/api/v2/oauth2/token.json',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }).toString(),
      timeout: 10000
    });
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Ошибка получения токена VK:', error.response?.data || error.message);
    throw new Error('Не удалось получить токен VK Ads');
  }
}
