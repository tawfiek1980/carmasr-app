import { safeFetch } from './ssrf.js';

const PROVIDERS = {
  openai: { base: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', fallbacks: [], vision: ['gpt-4o-mini'] },
  groq: {
    base: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    fallbacks: ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'groq/compound', 'allam-2-7b'],
    vision: ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'meta-llama/llama-4-scout-17b-16e-instruct'],
  },
};

export function getAIProvider() {
  const forced = (process.env.AI_PROVIDER || '').toLowerCase();
  if (forced === 'groq') return 'groq';
  if (forced === 'openai') return 'openai';
  const key = getAIKey();
  if (key && key.startsWith('gsk_')) return 'groq';
  return 'openai';
}

export function getAIKey() {
  return process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
}

export function isAIEnabled() {
  return !!getAIKey();
}

function aiConfig() {
  const provider = getAIProvider();
  const p = PROVIDERS[provider] || PROVIDERS.openai;
  return {
    provider,
    base: p.base,
    model: process.env.AI_MODEL || p.defaultModel,
    fallbacks: p.fallbacks || [],
    vision: p.vision || [],
    key: getAIKey(),
  };
}

function aiModels(model) {
  const cfg = aiConfig();
  return [...new Set([model || cfg.model, ...(cfg.fallbacks || [])])];
}

function aiVisionModels(model) {
  const cfg = aiConfig();
  return [...new Set([model || cfg.vision[0] || cfg.model, ...(cfg.vision || [])])];
}

export function aiDisabledPayload() {
  return {
    ok: false,
    error: 'AI_NOT_CONFIGURED',
    message: 'الذكاء الاصطناعي غير مفعّل بعد — أضف GROQ_API_KEY أو OPENAI_API_KEY في إعدادات مشروع Vercel',
  };
}

async function requestChat({ messages, model, temperature, maxTokens, jsonMode }) {
  const { base, key } = aiConfig();
  if (!key) throw new Error('AI_NOT_CONFIGURED');

  const body = { model, messages, temperature, max_tokens: maxTokens };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI_ERROR_${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  if (!content) throw new Error('AI_EMPTY_RESPONSE');
  return content;
}

export async function aiChat({ messages, model, temperature = 0.4, maxTokens = 1200 }) {
  const models = aiModels(model);
  let lastErr;
  for (const mdl of models) {
    try {
      return await requestChat({ messages, model: mdl, temperature, maxTokens, jsonMode: false });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('AI_EMPTY_RESPONSE');
}

export async function aiJson({ system, prompt, schema, model, maxTokens = 1500 }) {
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `${prompt}\n\nأرجِع الرد كـ JSON صالح فقط (بدون أي كلام إضافي أو أكواد) مطابق لهذه البنية بالضبط:\n${JSON.stringify(schema)}`,
    },
  ];
  return completeJson({ messages, schema, maxTokens });
}

async function toDataUri(url, maxBytes = 4 * 1024 * 1024) {
  if (!/^https?:\/\//i.test(String(url))) return '';
  const src = String(url).trim();
  let fetchUrl = src;
  if (/\/res\.cloudinary\.com\/.*\/image\/upload\//i.test(src)) {
    fetchUrl = src.replace(/\/image\/upload\//i, '/image/upload/w_600,q_auto:eco,f_auto/');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await safeFetch(fetchUrl, { signal: ctrl.signal });
    if (!res.ok) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > maxBytes) return '';
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const mime = /^image\/(jpeg|png|webp|gif|bmp)$/.test(ct) ? ct : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export async function aiVisionJson({ system, prompt, images = [], schema, maxTokens = 1600 }) {
  if (!Array.isArray(images) || images.length === 0) {
    return aiJson({ system, prompt, schema, maxTokens });
  }
  const uris = (await Promise.all(images.slice(0, 2).map((u) => toDataUri(String(u).trim())))).filter(Boolean);
  if (!uris.length) throw new Error('AI_VISION_FAILED: no image readable (fetch/format)');
  const content = [
    {
      type: 'text',
      text: `${prompt}\n\nأرجِع الرد كـ JSON صالح فقط (بدون أي كلام إضافي أو أكواد) مطابق لهذه البنية بالضبط:\n${JSON.stringify(schema)}`,
    },
    ...uris.map((uri) => ({ type: 'image_url', image_url: { url: uri } })),
  ];
  return completeJson({ vision: true, messages: [{ role: 'system', content: system }, { role: 'user', content }], schema, maxTokens });
}

async function completeJson({ messages, schema, vision = false, model, maxTokens }) {
  const models = vision ? aiVisionModels(model) : aiModels(model);
  const repairModels = vision ? [...aiModels(model), ...aiVisionModels(model)] : models;

  const chatOnce = async (msgs, jsonMode, pool = models) => {
    let rateLimited = false;
    for (const mdl of pool) {
      try {
        const c = await requestChat({ messages: msgs, model: mdl, temperature: 0.2, maxTokens, jsonMode });
        if (c && c.trim()) return { model: mdl, content: c };
      } catch (e) {
        // 429 على موديل واحد مش معناه نفشل — بنجرب الموديل اللي بعده (حدود كل موديل منفصلة)
        if (String(e?.message || '').includes('AI_ERROR_429')) { rateLimited = true; continue; }
      }
    }
    if (rateLimited) throw new Error('AI_ERROR_429: rate limited');
    return null;
  };

  let attempt = (await chatOnce(messages, true)) || (await chatOnce(messages, false));
  if (attempt) {
    const parsed = safeParse(attempt.content);
    if (parsed !== undefined) return parsed;
  }

  // تمريرتا إصلاح: نرجّع النص المعطوب للذكاء ليصلِّحه لـ JSON صالح.
  for (let round = 1; round <= 2 && attempt && attempt.content; round++) {
    const repairMessages = [
      { role: 'system', content: 'أنت مساعد يصلّح JSON فقط. رجِّع نسخة JSON صالحة مطابقة للبنية المطلوبة بدون أي كلام إضافي أو أكواد.' },
      {
        role: 'user',
        content: `النص التالي يُفترض أنه JSON لكنه معطوب. أصلِحه وارجعه JSON منتظم صالح فقط، لا كلام قبله أو بعده، مطابقاً لهذه البنية:\n${JSON.stringify(schema)}\n\nالنص المعطوب:\n${attempt.content.slice(0, 3000)}`,
      },
    ];
    attempt = round === 1
      ? (await chatOnce(repairMessages, true, repairModels)) || (await chatOnce(repairMessages, false, repairModels))
      : await chatOnce(repairMessages, false, repairModels);
    if (attempt) {
      const reparsed = safeParse(attempt.content);
      if (reparsed !== undefined) return reparsed;
    }
  }

  throw new Error('AI_INVALID_JSON');
}

function stripCodeFences(content) {
  return String(content || '')
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json|JSON)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

function tryParseBalanced(text, from) {
  let depth = 0, inStr = false, esc = false;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(from, i + 1)); } catch { return undefined; }
      }
    }
  }
  return undefined;
}

function safeParse(content) {
  if (!content) return undefined;
  const text = stripCodeFences(content);
  try { return JSON.parse(text); } catch /* empty */ { /* نكمل */ }
  // ابحث عن أول كائن JSON متوازن متخلّصاً من أي نص محيط
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      const parsed = tryParseBalanced(text, i);
      if (parsed !== undefined) return parsed;
    }
  }
  // جرّب البناء سطراً سطراً
  const lines = text.split('\n');
  let buf = '';
  for (const line of lines) {
    buf += line;
    try { return JSON.parse(buf); } catch { /* مستمر */ }
  }
  return undefined;
}

export function handleAIError(error) {
  if (!error) return { ok: false, error: 'AI_UNKNOWN', message: 'خطأ غير متوقع' };
  const msg = String(error.message || error);
  if (msg.includes('AI_NOT_CONFIGURED')) return aiDisabledPayload();
  if (msg.includes('AI_INVALID_JSON')) return { ok: false, error: 'AI_INVALID_JSON', message: 'الرد غير صالح، حاول مرة أخرى' };
  if (msg.includes('AI_VISION_FAILED')) return { ok: false, error: 'AI_VISION_FAILED', message: 'تعذر قراءة الصور من مزود الذكاء الاصطناعي — أعد المحاولة أو أزل الصور' };
  if (msg.includes('AI_ERROR_429')) return { ok: false, error: 'AI_RATE_LIMIT', message: 'تم تجاوز حد الاستخدام، حاول بعد قليل' };
  return { ok: false, error: 'AI_ERROR', message: 'حدث خطأ أثناء معالجة الطلب' };
}
