const WINDOW_MS = 60 * 1000;
const DEFAULT_MAX = 60;

const hits = new Map();

export function rateLimit(req, res, { max = DEFAULT_MAX, windowMs = WINDOW_MS, key } = {}) {
  const ip = (req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim()
    || req.headers['x-real-ip']
    || 'unknown';
  const id = `${key || (req.url || '/').split('?')[0]}|${ip}`;
  const now = Date.now();
  const entry = hits.get(id);

  if (!entry || entry.resetAt <= now) {
    hits.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count += 1;
  if (entry.count > max) {
    res.status(429).json({ error: 'كثرة الطلبات — حاول بعد قليل' });
    return false;
  }
  return true;
}

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
}, WINDOW_MS);
if (cleanup.unref) cleanup.unref();