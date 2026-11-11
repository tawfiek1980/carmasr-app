const HASH_KEY = 'tareeq_admin_pin_hash';
const SESSION_KEY = 'tareeq_admin_unlocked';

async function toHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(`tareeq::${text}`);
  try {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 5381;
    for (let i = 0; i < data.length; i++) h = ((h << 5) + h + data[i]) >>> 0;
    return `fallback_${h.toString(16)}`;
  }
}

export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(HASH_KEY);
  } catch {
    return false;
  }
}

export async function setupPin(pin: string): Promise<void> {
  const hash = await toHash(pin.trim());
  localStorage.setItem(HASH_KEY, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(HASH_KEY);
    if (!stored) return false;
    const hash = await toHash(pin.trim());
    return hash === stored;
  } catch {
    return false;
  }
}

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markUnlocked(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function lockNow(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}