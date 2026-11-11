import { firebaseAuth } from '../firebase';
import { getApiUrl } from './config';

export interface ChannelCounts {
  whatsapp: number;
  call: number;
  tasehil: number;
  link: number;
}

export interface SellerListingStat {
  id: string;
  slug?: string;
  title: string;
  brand: string;
  model: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  weeklyImpressions: number;
  weeklyClicks: number;
  today: number;
  channels: ChannelCounts;
}

export interface SellerStats {
  totals: {
    listings: number;
    impressions: number;
    clicks: number;
    ctr: number;
    weeklyImpressions: number;
    weeklyClicks: number;
    channels: ChannelCounts;
  };
  items: SellerListingStat[];
  trend: { day: string; impressions: number; clicks: number }[];
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch { /* ignore */ }
  return headers;
}

export const statsService = {
  async getMyStats(): Promise<SellerStats | null> {
    const headers = await authHeaders();
    const resp = await fetch(`${getApiUrl()}/stats?action=stats`, { headers });
    const data = await resp.json().catch(() => null);
    return data?.ok ? (data as SellerStats) : null;
  },
};