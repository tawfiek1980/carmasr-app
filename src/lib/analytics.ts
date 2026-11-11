/**
 * analytics.ts - تتبع أحداث Firebase Analytics + تتبع مصدر الزائر (UTM / referrer)
 * كل الأحداث تُرسل ومعها معاملات الحملة عشان نعرف منين جه العميل.
 */
import { getAnalytics, logEvent, isSupported, type Analytics } from "firebase/analytics";
import app from "../firebase";

let cached: Analytics | null = null;
let supportedPromise: Promise<boolean> | null = null;

const SESSION_KEY = "tareeq_campaign";

export interface CampaignSource {
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  referrer: string;
}

/** يقرأ معاملات الحملة من الرابط (utm_*) أو من الرابط المحوّل وبيحفظها في الجلسة */
export function getCampaign(): CampaignSource {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  try {
    const params = new URLSearchParams(window.location.search);
    const source: CampaignSource = {
      source: params.get("utm_source") || "",
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      term: params.get("utm_term") || "",
      content: params.get("utm_content") || "",
      referrer: document.referrer || "",
    };
    if (source.source || source.referrer) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(source));
    }
    return source;
  } catch {
    return { source: "", medium: "", campaign: "", term: "", content: "", referrer: "" };
  }
}

/** معاملات الحملة بصيغة مناسبة لأحداث Analytics */
export function campaignParams(): Record<string, string> {
  const c = getCampaign();
  const out: Record<string, string> = {};
  if (c.source) out.campaign_source = c.source;
  if (c.medium) out.campaign_medium = c.medium;
  if (c.campaign) out.campaign_name = c.campaign;
  if (c.term) out.campaign_term = c.term;
  if (c.content) out.campaign_content = c.content;
  if (c.referrer) out.campaign_referrer = c.referrer;
  return out;
}

/** حقل جاهز للحفظ في Firestore (مصدر التسجيل) */
export function campaignForSignup(): Record<string, string> {
  const c = getCampaign();
  const out: Record<string, string> = {};
  if (c.source) out.signupSource = c.source;
  if (c.medium) out.signupMedium = c.medium;
  if (c.campaign) out.signupCampaign = c.campaign;
  if (c.referrer) out.signupReferrer = c.referrer;
  return out;
}

async function ensureAnalytics(): Promise<Analytics | null> {
  if (cached) return cached;
  if (!supportedPromise) {
    if (!window.requestIdleCallback) {
      await new Promise<void>(r => setTimeout(r, 2000));
    } else {
      await new Promise<void>(r => window.requestIdleCallback(() => r()));
    }
    supportedPromise = isSupported();
  }
  const ok = await supportedPromise;
  if (!ok) return null;
  try {
    cached = getAnalytics(app);
  } catch {
    cached = null;
  }
  return cached;
}

/** يرسل حدث مع معاملات الحملة المضافة تلقائيًا (لا يكسر التطبيق أبدًا) */
export async function trackEvent(name: string, params?: Record<string, unknown>): Promise<void> {
  try {
    const a = await ensureAnalytics();
    if (!a) return;
    logEvent(a, name, { ...campaignParams(), ...(params || {}) });
  } catch {
    /* Analytics لا يجب أن يكسر التطبيق أبدًا */
  }
}
