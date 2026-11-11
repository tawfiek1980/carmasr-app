import { firebaseAuth } from '../firebase';
import { getApiUrl } from './config';

export interface SavedSearchInput {
  query?: string;
  category?: string;
  governorate?: string;
  brand?: string;
  model?: string;
  maxPrice?: number | null;
  name?: string;
}

export interface SavedSearch extends SavedSearchInput {
  id: string;
  active: boolean;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch { /* ignore */ }
  return headers;
}

export const alertsService = {
  async saveSearch(input: SavedSearchInput): Promise<{ ok: boolean; id?: string; message?: string }> {
    const headers = await authHeaders();
    const resp = await fetch(`${getApiUrl()}/alerts?action=save`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return (await resp.json().catch(() => ({ ok: false, message: 'تعذّر الحفظ' }))) as { ok: boolean; id?: string; message?: string };
  },

  async listSavedSearches(): Promise<SavedSearch[]> {
    const headers = await authHeaders();
    const resp = await fetch(`${getApiUrl()}/alerts?action=list`, { headers });
    const data = await resp.json().catch(() => ({ ok: false, items: [] }));
    return data?.ok ? (data.items as SavedSearch[]) : [];
  },

  async deleteSavedSearch(id: string): Promise<boolean> {
    const headers = await authHeaders();
    const resp = await fetch(`${getApiUrl()}/alerts?action=unsave`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id }),
    });
    const data = await resp.json().catch(() => ({ ok: false }));
    return !!data?.ok;
  },
};