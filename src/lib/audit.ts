const KEY = 'tareeq_admin_log';
const MAX = 200;

export interface AuditEntry {
  t: string;
  action: string;
  details: string;
}

export function getAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as AuditEntry[] : [];
  } catch {
    return [];
  }
}

export function logAdminAction(action: string, details?: string): void {
  try {
    const list = getAuditLog();
    list.push({ t: new Date().toISOString(), action, details: details || '' });
    const trimmed = list.slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export function clearAuditLog(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}