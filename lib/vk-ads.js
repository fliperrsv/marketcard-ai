import axios from 'axios';
import { getVkAccessToken } from './vk-auth';

const VK_API_VERSION = '5.199';
const BASE_URL = 'https://api.vk.com/method';

export async function getCampaigns() {
  const accessToken = await getVkAccessToken();
  const response = await axios.get(`${BASE_URL}/ads.getCampaigns`, {
    params: {
      account_id: process.env.VK_ACCOUNT_ID,
      client_id: process.env.VK_CLIENT_ID,
      access_token: accessToken,
      v: VK_API_VERSION
    }
  });
  if (response.data.error) {
    throw new Error(`VK API error: ${response.data.error.error_msg}`);
  }
  return response.data.response;
}

export async function getCampaignStats(campaignId, dateFrom, dateTo) {
  const accessToken = await getVkAccessToken();
  const response = await axios.get(`${BASE_URL}/ads.getStatistics`, {
    params: {
      account_id: process.env.VK_ACCOUNT_ID,
      client_id: process.env.VK_CLIENT_ID,
      ids_type: 'campaign',
      ids: campaignId,
      period: 'day',
      date_from: dateFrom,
      date_to: dateTo,
      access_token: accessToken,
      v: VK_API_VERSION
    }
  });
  if (response.data.error) {
    throw new Error(`VK API error: ${response.data.error.error_msg}`);
  }
  return response.data.response;
}
