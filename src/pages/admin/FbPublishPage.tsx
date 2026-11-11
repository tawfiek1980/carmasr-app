import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import {
  Users, Upload, ClipboardPaste, Copy, ExternalLink, CheckCircle2, Circle,
  Trash2, RefreshCw, Search, Truck, Download, Image as ImageIcon,
  Play, SkipForward, Square, Loader2, Sparkles, AlertTriangle,
  ChevronDown, ChevronUp, Check, Globe, FileText, Link2,
} from 'lucide-react';
import { firebaseAuth } from '../../firebase';
import { listingsService } from '../../lib/firestoreService';
import { copyText, formatDate, formatDateTime, shareWithImage, shareUrl } from '../../lib/utils';
import { createZip, seoSlug } from '../../lib/zip';
import type { Listing } from '../../types';

type FbGroup = {
  id: string;
  url: string;
  name: string;
  enabled?: boolean;
  tag?: string;
  lastPostedAt?: string;
};

type Props = {
  getApiUrl: () => string;
  toast: (m: string, t?: any) => void;
};

const LS_GROUPS = 'fbGroups_local';
const LS_POSTED = 'fb_pub_posted_v1';
const LS_AD = 'fb_pub_ad_v1';
const LS_CURSOR = 'fb_pub_cursor_v1';
const LS_QUEUE = 'fb_pub_queue_v1';
const LS_TEXT = 'fb_pub_text_v1';
const LS_MODE = 'fb_pub_mode_v1';
const LS_DRAFT = 'fb_pub_draft_v1';
const LS_DRAFTS = 'mkt_drafts_v1';
const LS_VARIANTS = 'fb_pub_variants_v1';
const LS_LASTPOST = 'fb_pub_lastpost_v1';
const LS_DAILY = 'fb_pub_daily_v1';
const BATCH_SIZE = 10;
const SAFE_GAP_SEC = 40;   // فاصل مقترح بين كل بوست والتاني (حماية من البلوك)
const DAILY_CAP = 25;      // أقصى عدد بوستات في اليوم

/** كود سحب الجروبات — يشتغل من Console على صفحة جروباتك في فيسبوك */
const FB_SCRAPER = String.raw`(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const found = new Map();
  const collect = () => {
    document.querySelectorAll('a[href*="/groups/"]').forEach(a => {
      const href = a.getAttribute('href') || a.href || '';
      const m = href.match(/\/groups\/(\d{6,})/);
      if (!m) return;
      const id = m[1];
      const name = (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      const prev = found.get(id);
      if (!prev || (name && name.length > prev.length)) found.set(id, name || id);
    });
  };
  const scroll = () => {
    window.scrollTo(0, document.body.scrollHeight);
    const doc = document.scrollingElement || document.documentElement;
    if (doc) doc.scrollTop = doc.scrollHeight;
    const main = document.querySelector('[role="main"]');
    if (main && main.scrollHeight > main.clientHeight + 200) main.scrollTop = main.scrollHeight;
  };
  let lastHeight = -1, lastCount = -1, same = 0;
  for (let i = 0; i < 400; i++) {
    collect(); scroll();
    await sleep(650);
    const h = document.body.scrollHeight + (document.scrollingElement ? document.scrollingElement.scrollHeight : 0);
    if (h === lastHeight && found.size === lastCount) {
      same += 1;
      if (same >= 8) break;
    } else { same = 0; }
    lastHeight = h; lastCount = found.size;
  }
  collect();
  const rows = [...found.entries()];
  const text = rows.map(row => row[1] + ' | https://www.facebook.com/groups/' + row[0] + '/').join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      alert('تم تجهيز ' + rows.length + ' جروب ونسخهم ✓\nارجع للوحة كار مصر والصق في خانة الجروبات.');
      return;
    } catch (e) {}
  }
  prompt('انسخ القائمة (Ctrl+C) ثم الصقها في لوحة كار مصر:', text);
  alert('تم تجهيز ' + rows.length + ' جروب.');
})();`;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function parseGroups(text: string): FbGroup[] {
  const map = new Map<string, FbGroup>();
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const href = line.match(/\/groups\/(\d{5,})/);
    const bare = line.match(/(?:^|\D)(\d{6,})(?:\D|$)/);
    const id = href?.[1] || (!/https?:/i.test(line) ? bare?.[1] : undefined);
    if (!id) continue;
    // الاسم ممكن يكون «اسم | لينك» أو CSV «id,اسم,لينك» أو لينك بس
    let name = line.split('|')[0].trim().replace(/https?:\/\/\S+/g, '');
    const parts = name.split(/[,\t;]+/).map(s => s.trim()).filter(Boolean)
      .filter(p => !/^\d{5,}$/.test(p) && p.length > 1);
    name = parts.join(' ').trim();
    if (!name || /^\d+$/.test(name)) name = 'جروب ' + id;
    map.set(id, {
      id,
      name: name.slice(0, 140),
      url: `https://www.facebook.com/groups/${id}/`,
      enabled: true,
    });
  }
  return [...map.values()];
}

function hoursSince(value?: string): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (!Number.isFinite(t) || t <= 0) return null;
  return (Date.now() - t) / 3600000;
}

export default function FbPublishPage({ getApiUrl, toast }: Props) {
  const [groups, setGroups] = useState<FbGroup[]>([]);
  const [posted, setPosted] = useState<Record<string, string>>({});
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState('');
  const [syncMode, setSyncMode] = useState<'local' | 'server'>('local');

  const [ads, setAds] = useState<Listing[]>([]);
  const [loadingAds, setLoadingAds] = useState(true);
  const [adId, setAdId] = useState('');
  const [adSearch, setAdSearch] = useState('');
  const [showAllAds, setShowAllAds] = useState(false);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [queue, setQueue] = useState<string[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [groupFilter, setGroupFilter] = useState<'all' | 'todo' | 'done' | 'batch'>('all');

  // وضع البوست: إعلان (صور فقط) أو بوست نص جاهز من مركز التسويق
  const [pubMode, setPubMode] = useState<'image' | 'text'>(() => {
    try { return localStorage.getItem(LS_MODE) === 'text' ? 'text' : 'image'; } catch { return 'image'; }
  });
  const [pubText, setPubText] = useState<string>(() => {
    try { return localStorage.getItem(LS_TEXT) || ''; } catch { return ''; }
  });
  const [pubDraftId, setPubDraftId] = useState<string>(() => {
    try { return localStorage.getItem(LS_DRAFT) || ''; } catch { return ''; }
  });
  const isTextMode = pubMode === 'text';

  // نصوص مخصصة لكل جروب (من زر «ذكاء: نسخة لكل جروب» في مركز التسويق)
  const [variants, setVariants] = useState<Record<string, string>>(() => loadJson<Record<string, string>>(LS_VARIANTS, {}));
  const hasVariants = Object.keys(variants).length > 0;

  const textForGroup = useCallback((id?: string) => {
    const base = pubText.trim();
    if (!id) return base;
    const v = variants[String(id)];
    return v && v.trim() ? v.trim() : base;
  }, [pubText, variants]);

  // فاصل أمان بين البوستات + عدّاد اليوم (حماية من بلوك فيسبوك)
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [todayCount, setTodayCount] = useState<number>(() => {
    const d = loadJson<{ date?: string; count?: number }>(LS_DAILY, {});
    return d.date === new Date().toISOString().slice(0, 10) ? Number(d.count) || 0 : 0;
  });

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setTimeout(() => setCooldownLeft(cooldownLeft - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldownLeft]);

  // مزامنة النسخ المخصصة لو اتغيرت في تاب تاني
  useEffect(() => {
    const sync = () => setVariants(loadJson<Record<string, string>>(LS_VARIANTS, {}));
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const bumpDaily = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const prev = loadJson<{ date?: string; count?: number }>(LS_DAILY, {});
    const next = { date: today, count: (prev.date === today ? Number(prev.count) || 0 : 0) + 1 };
    saveJson(LS_DAILY, next);
    setTodayCount(next.count);
    try { localStorage.setItem(LS_LASTPOST, new Date().toISOString()); } catch { /* ignore */ }
  }, []);

  const clearTextMode = useCallback(() => {
    setPubMode('image');
    setPubText('');
    setPubDraftId('');
    try {
      localStorage.removeItem(LS_MODE);
      localStorage.removeItem(LS_TEXT);
      localStorage.removeItem(LS_DRAFT);
    } catch { /* ignore */ }
  }, []);

  // نقفل البوست الجاهز في مركز التسويق لما الدفعة تخلص
  const markDraftDone = useCallback(() => {
    if (!pubDraftId) return;
    try {
      const list = loadJson<Array<{ id?: string; doneAt?: string }>>(LS_DRAFTS, []);
      let changed = false;
      const next = list.map(d => {
        if (d && d.id === pubDraftId && !d.doneAt) {
          changed = true;
          return { ...d, doneAt: new Date().toISOString() };
        }
        return d;
      });
      if (changed) {
        saveJson(LS_DRAFTS, next);
        toast('اتقفل البوست الجاهز ✓ — اتعلم في مركز التسويق', 'success');
      }
    } catch { /* ignore */ }
  }, [pubDraftId, toast]);

  const [showHelp, setShowHelp] = useState(false);
  const [method, setMethod] = useState<'paste' | 'bookmark' | 'extension'>('paste');
  const [downloading, setDownloading] = useState(false);
  const [copyingImg, setCopyingImg] = useState(false);
  const [coolingHours] = useState<number>(() => {
    try { return Number(localStorage.getItem('fbCoolingHours')) || 20; } catch { return 20; }
  });

  const fileRef = useRef<HTMLInputElement | null>(null);
  const groupsRef = useRef<FbGroup[]>([]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);

  // ── helpers ────────────────────────────────────────────────────────────
  const api = useCallback(async (sub: string, extra: Record<string, any> = {}) => {
    if (!firebaseAuth.currentUser) return null;
    try {
      const token = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch(`${getApiUrl()}/whatsapp-notify?action=fb-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sub, ...extra }),
      });
      const data = await res.json().catch(() => null);
      return res.ok ? data : null;
    } catch {
      return null;
    }
  }, [getApiUrl]);

  const persistGroups = useCallback((next: FbGroup[]) => {
    setGroups(next);
    saveJson(LS_GROUPS, next);
  }, []);

  // ── load saved state ───────────────────────────────────────────────────
  useEffect(() => {
    const localGroups = loadJson<FbGroup[]>(LS_GROUPS, []);
    const localPosted = loadJson<Record<string, string>>(LS_POSTED, {});
    const savedAd = (() => { try { return localStorage.getItem(LS_AD) || ''; } catch { return ''; } })();
    if (localGroups.length) {
      setGroups(localGroups);
      const sel: Record<string, boolean> = {};
      localGroups.forEach(g => { if (g.enabled !== false) sel[g.id] = true; });
      setSelected(sel);
    }
    setPosted(localPosted);
    if (savedAd) setAdId(savedAd);
  }, []);

  // استكمال طابور جاي من زر «نشر على جروبات FB» في مركز التسويق
  useEffect(() => {
    let running = false;
    try { running = localStorage.getItem('fb_pub_running_v1') === '1'; } catch { /* ignore */ }
    const params = new URLSearchParams(window.location.search);
    if (!running && params.get('running') !== '1') return;
    try { localStorage.removeItem('fb_pub_running_v1'); } catch { /* ignore */ }
    const saved = loadJson<{ ids?: string[]; images?: string[]; text?: string; mode?: string; texts?: Record<string, string> }>(LS_QUEUE, {});
    let savedText = false;
    try { savedText = localStorage.getItem(LS_MODE) === 'text'; } catch { /* ignore */ }
    const savedTexts = savedText && saved.texts && typeof saved.texts === 'object' ? saved.texts : {};
    if (savedText && Object.keys(savedTexts).length) setVariants(savedTexts);
    if (Array.isArray(saved.ids) && saved.ids.length) {
      setQueue(saved.ids);
      setQIdx(0);
      setNote(savedText
        ? `الطابور جاهز: ${saved.ids.length} جروب — بوست نص جاهز${Object.keys(savedTexts).length ? ' (نسخة مخصصة لكل جروب)' : ''}. الصق النص (Ctrl+V) وانشر، وبعدها «نشرت — التالي».`
        : `الطابور جاهز: ${saved.ids.length} جروب — جروب ١ مفتوح. الصق الصورة وانشر، وبعدها «نشرت — التالي».`);
      // بلّغ الإضافة بالطابور كمان (بعد ما الـ bridge يجهز) عشان أزرار ✅/⏭ تظهر على تاب فيسبوك
      const payload = {
        source: 'tareeq-app', type: 'START_QUEUE', queue: saved.ids,
        images: savedText ? [] : (saved.images || []),
        text: savedText ? (saved.text || localStorage.getItem(LS_TEXT) || '') : '',
        texts: savedText ? savedTexts : {},
        mode: savedText ? 'text' : 'image', adTitle: '',
      };
      setTimeout(() => window.postMessage(payload, '*'), 1500);
    }
  }, []);

  // ── sync groups with server (best effort) ──────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!firebaseAuth.currentUser) { setSyncMode('local'); return; }
      const data = await api('list');
      if (!alive) return;
      if (data?.success && Array.isArray(data.groups) && data.groups.length) {
        const serverGroups = data.groups as FbGroup[];
        const byId = new Map(serverGroups.map(g => [g.id, g]));
        for (const g of groupsRef.current) if (!byId.has(g.id)) byId.set(g.id, g);
        const merged = [...byId.values()];
        setSyncMode('server');
        persistGroups(merged);
        const sel: Record<string, boolean> = {};
        merged.forEach(g => { if (g.enabled !== false) sel[g.id] = true; });
        setSelected(sel);
        if (merged.length > serverGroups.length) {
          void api('save', { urls: merged.map(g => g.url) });
        }
      } else if (groupsRef.current.length) {
        setSyncMode('server');
        void api('save', { urls: groupsRef.current.map(g => g.url) });
      }
    })();
    return () => { alive = false; };
  }, [api, persistGroups]);

  // ── load listings ──────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingAds(true);
      try {
        const all = await listingsService.getAll();
        if (!alive) return;
        const usable = (all || []).filter(l => Array.isArray(l.images) && l.images.length > 0);
        setAds(usable);
        setAdId(prev => {
          if (prev && usable.some(l => l.id === prev)) return prev;
          const first = usable.find(l => l.status === 'active') || usable[0];
          return first ? first.id : '';
        });
      } catch {
        if (alive) setAds([]);
      } finally {
        if (alive) setLoadingAds(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    try { if (adId) localStorage.setItem(LS_AD, adId); } catch { /* ignore */ }
  }, [adId]);

  const ad = useMemo(() => ads.find(l => l.id === adId) || null, [ads, adId]);
  const adImages = useMemo(() => (ad?.images || []).filter(Boolean), [ad]);

  // ابعت صور الإعلان للإضافة أول ما تحمّل (تنسخها لوحدها على تاب فيسبوك)
  useEffect(() => {
    if (isTextMode || !queue.length || qIdx !== 0 || !adImages.length) return;
    const t = setTimeout(() => {
      window.postMessage({ source: 'tareeq-app', type: 'START_QUEUE', queue, adTitle: ad?.title || '', images: adImages, mode: 'image' }, '*');
    }, 600);
    return () => clearTimeout(t);
  }, [isTextMode, queue, qIdx, adImages, ad]);

  // رابط الإعلان على المنصة — بيتحط مع نص الإعلان عشان العميل يوصله بسهولة
  const adLink = useMemo(() => (ad ? shareUrl('listing', ad.id) : ''), [ad]);

  // نص الإعلان المكتوب — للمراجعة والنسخ فقط (بوست فيسبوك صور فقط)
  const adText = useMemo(() => {
    if (!ad) return '';
    const specs = [ad.brand, ad.model, ad.year].filter(Boolean).join(' ');
    const place = [ad.governorate, ad.location].filter(Boolean).join(' - ');
    const contact = ad.contactPhone || ad.whatsappPhone || ad.userPhone || '';
    const lines = [
      ad.title,
      specs ? `المواصفات: ${specs}` : '',
      ad.description,
      ad.price ? `السعر: ${Number(ad.price).toLocaleString('ar-EG')} جنيه` : (ad.priceType === 'call' ? 'السعر: اتصل للسعر' : ''),
      place ? `المكان: ${place}` : '',
      contact ? `للتواصل: ${contact}` : '',
      adLink ? `رابط الإعلان: ${adLink}` : '',
    ];
    return lines.map(l => String(l || '').trim()).filter(Boolean).join('\n');
  }, [ad, adLink]);

  const filteredAds = useMemo(() => {
    const q = adSearch.trim().toLowerCase();
    return ads.filter(l => {
      if (!showAllAds && l.status !== 'active') return false;
      if (!q) return true;
      return `${l.title || ''} ${l.brand || ''} ${l.model || ''} ${l.governorate || ''}`.toLowerCase().includes(q);
    });
  }, [ads, adSearch, showAllAds]);

  const usableGroups = useMemo(() => groups.filter(g => g.enabled !== false), [groups]);
  const selectedIds = useMemo(() => usableGroups.filter(g => selected[g.id]).map(g => g.id), [usableGroups, selected]);
  const selectedCount = selectedIds.length;

  const currentId = queue[qIdx];
  const currentGroup = useMemo(() => groups.find(g => g.id === currentId) || null, [groups, currentId]);
  const doneCount = useMemo(() => queue.filter(id => posted[id]).length, [queue, posted]);

  // ── دفعات ١٠ جروبات بالتتابع (كل مرة ١٠ غيرهم) ────────────────────────
  const [cursor, setCursor] = useState<number>(() => {
    const n = Number(loadJson<number>(LS_CURSOR, 0));
    return Number.isFinite(n) && n > 0 ? n : 0;
  });

  const pickNextBatch = useCallback((): string[] => {
    const list = groupsRef.current.filter(g => g.enabled !== false);
    if (!list.length) return [];
    const start = cursor >= list.length ? 0 : cursor;
    const ordered = [...list.slice(start), ...list.slice(0, start)];
    const fresh = ordered.filter(g => !posted[g.id]);
    const batch = (fresh.length ? fresh : ordered).slice(0, BATCH_SIZE);
    return batch.map(g => g.id);
  }, [cursor, posted]);

  const moveCursor = useCallback((ids: string[]) => {
    const list = groupsRef.current.filter(g => g.enabled !== false);
    if (!list.length || !ids.length) return;
    let lastIdx = -1;
    for (let i = list.length - 1; i >= 0; i--) {
      if (ids.includes(list[i].id)) { lastIdx = i; break; }
    }
    const next = lastIdx + 1 >= list.length ? 0 : lastIdx + 1;
    setCursor(next);
    saveJson(LS_CURSOR, next);
  }, []);

  const selectNextBatch = useCallback(() => {
    const ids = pickNextBatch();
    if (!ids.length) { toast('ضيف جروبات الأول', 'error'); return; }
    const sel: Record<string, boolean> = {};
    ids.forEach(id => { sel[id] = true; });
    setSelected(sel);
    setGroupFilter('all');
    setNote(`اتحددوا ${ids.length} جروب — دول الـ${BATCH_SIZE} اللي دورهم (اللي لسه ما اتنشرش).`);
  }, [pickNextBatch, toast]);

  // ── عدّادات وحالة كل جروب ───────────────────────────────────────────────
  const postedCount = useMemo(
    () => usableGroups.filter(g => !!(g.lastPostedAt || posted[g.id])).length,
    [usableGroups, posted]
  );
  const remainingCount = usableGroups.length - postedCount;
  const queuedIds = useMemo(() => new Set(queue), [queue]);
  const visibleGroups = useMemo(() => {
    return groups.filter(g => {
      if (groupFilter === 'todo') return !(g.lastPostedAt || posted[g.id]);
      if (groupFilter === 'done') return !!(g.lastPostedAt || posted[g.id]);
      if (groupFilter === 'batch') return queuedIds.has(g.id);
      return true;
    });
  }, [groups, groupFilter, posted, queuedIds]);

  // ── groups actions ─────────────────────────────────────────────────────
  const addGroups = useCallback((raw?: string) => {
    const text = raw ?? paste;
    const parsed = parseGroups(text);
    if (!parsed.length) {
      setNote('مفيش لينكات جروبات فيسبوك في النص ده. الصق لينك جروب أو «اسم | لينك».');
      return;
    }
    const byId = new Map(groupsRef.current.map(g => [g.id, g]));
    let added = 0;
    for (const g of parsed) {
      if (!byId.has(g.id)) { byId.set(g.id, g); added += 1; }
    }
    const next = [...byId.values()];
    persistGroups(next);
    const sel = { ...selected };
    next.forEach(g => { if (g.enabled !== false && sel[g.id] === undefined) sel[g.id] = true; });
    setSelected(sel);
    setNote(`اتضاف ${added} جروب جديد — الإجمالي ${next.length} جروب.`);
    setPaste('');
    if (firebaseAuth.currentUser) void api('save', { urls: parsed.map(g => g.url) });
    toast(`اتضاف ${added} جروب — الإجمالي ${next.length}`, added ? 'success' : 'info');
  }, [paste, persistGroups, selected, api, toast]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      addGroups(text);
    } catch {
      setNote('تعذر قراءة الملف.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // لصق مباشر من صفحة فيسبوك — نقرأ HTML من الحافظة ونستخرج لينكات الجروبات
  const onPasteGroups = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData?.getData('text/html') || '';
    const plain = e.clipboardData?.getData('text/plain') || '';
    const lines: string[] = [];
    if (html) {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href') || '';
          const m = href.match(/\/groups\/(\d{5,})/);
          if (!m) return;
          const name = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
          lines.push(`${name || 'جروب ' + m[1]} | https://www.facebook.com/groups/${m[1]}/`);
        });
      } catch { /* ignore */ }
    }
    if (!lines.length && plain) {
      const urls = plain.match(/https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/groups\/\d{5,}\/?/g) || [];
      urls.forEach(u => lines.push(`جروب | ${u}`));
    }
    if (!lines.length) return; // نسيب اللصق العادي يكمل
    e.preventDefault();
    addGroups(lines.join('\n'));
  };

  const bookmarkletHref = useMemo(() => 'javascript:' + encodeURIComponent(FB_SCRAPER), []);
  // React بيحجب javascript: في href — بنحطها مباشرة على العنصر عشان السحب لشريط المفضلة يشتغل
  const setBookmarkRef = useCallback((el: HTMLAnchorElement | null) => {
    if (el) el.setAttribute('href', bookmarkletHref);
  }, [bookmarkletHref]);

  const removeGroup = (id: string) => {
    const next = groups.filter(g => g.id !== id);
    persistGroups(next);
    setSelected(s => { const c = { ...s }; delete c[id]; return c; });
    if (firebaseAuth.currentUser) void api('delete', { id });
  };

  const clearAllGroups = () => {
    if (!groups.length) return;
    if (!confirm(`حذف كل ${groups.length} جروب من القائمة؟`)) return;
    persistGroups([]);
    setSelected({});
    setNote('اتمسحت كل الجروبات من هذا الجهاز.');
  };

  const toggleGroup = (id: string) => {
    const nextEnabled = groups.find(g => g.id === id)?.enabled === false;
    const next = groups.map(g => g.id === id ? { ...g, enabled: nextEnabled } : g);
    persistGroups(next);
    if (firebaseAuth.currentUser) void api('toggle', { id, enabled: nextEnabled });
  };

  const toggleSelected = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const selectAll = (value: boolean) => {
    const sel: Record<string, boolean> = {};
    if (value) usableGroups.forEach(g => { sel[g.id] = true; });
    setSelected(sel);
  };

  const copyScraper = async () => {
    const ok = await copyText(FB_SCRAPER);
    toast(ok ? 'اتنسخ كود السحب ✓ — افتح فيسبوك ← F12 ← Console ← الصق ← Enter' : 'تعذر النسخ — استخدم زر «عرض الكود»', ok ? 'success' : 'error');
  };

  const openFbGroups = () => {
    window.open('https://www.facebook.com/groups/joins/', '_blank', 'noopener');
  };

  // ── صور فقط: بوستات فيسبوك بدون نص أو لينك ──────────────────────────
  const copyImageFromUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('bad');
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no ctx');
      ctx.drawImage(bitmap, 0, 0);
      const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('no png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return true;
    } catch {
      return false;
    }
  }, []);

  // مشاركة الصور فقط (موبايل/واتساب) — بدون نص أو لينك
  const shareAdWithImages = async () => {
    if (!ad) { toast('اختار إعلان الأول', 'error'); return; }
    if (!adImages.length) { toast('الإعلان مفيش فيه صور', 'error'); return; }
    const ok = await shareWithImage({
      title: ad.title,
      imageUrl: adImages[0],
    });
    if (ok) { toast('تم فتح المشاركة بالصور ✓', 'success'); return; }
    toast('المتصفح مش بيدعم إرفاق الصور — هنزّل الصور تفتحها وترفعها في المنشور', 'info');
    void downloadImages();
  };

  // اسم الملف الصديق للسيو: ماركة + موديل + سنة + قسم + محافظة + كود الإعلان
  const downloadBaseName = useCallback((l: Listing) => {
    const readable = seoSlug([
      l.brand, l.model, l.year, l.category, l.governorate, l.title,
    ].filter(Boolean).join(' '), 64) || 'tareeq-ad';
    const shortId = String(l.id || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    return shortId ? `${readable}-${shortId}` : readable;
  }, []);

  const imageExt = (blob: Blob, url: string) => {
    const type = String(blob.type || '').toLowerCase();
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    if (type.includes('avif')) return 'avif';
    if (type.includes('svg')) return 'svg';
    const fromUrl = String(url).match(/\.(jpe?g|png|webp|gif|avif)(?:\?|#|$)/i)?.[1];
    return (fromUrl || 'jpg').toLowerCase().replace('jpeg', 'jpg');
  };

  // تنزيل كل الصور مرة واحدة في ZIP — أسرع بكتير من 10 تنزيلات منفصلة
  const downloadImages = async () => {
    if (!ad) { toast('اختار إعلان الأول', 'error'); return; }
    const images = adImages;
    if (!images.length) { toast('الإعلان مفيش فيه صور', 'error'); return; }
    setDownloading(true);
    setNote(`جاري تحميل ${images.length} صورة وتجهيز ملف ZIP...`);
    const baseName = downloadBaseName(ad);
    try {
      const results = await Promise.allSettled(images.map(async (url, i) => {
        const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
        if (!res.ok) throw new Error('bad');
        const blob = await res.blob();
        return {
          name: `${baseName}-${String(i + 1).padStart(2, '0')}.${imageExt(blob, url)}`,
          data: new Uint8Array(await blob.arrayBuffer()),
        };
      }));
      const files: { name: string; data: Uint8Array }[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') files.push({ name: r.value.name, data: r.value.data });
      }
      const failed = results.length - files.length;
      if (!files.length) throw new Error('none');
      const href = URL.createObjectURL(createZip(files));
      const a = document.createElement('a');
      a.href = href;
      a.download = `${baseName}-images.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
      setNote(`تم تجهيز ZIP فيه ${files.length} صورة — اسم الملف: ${baseName}-images.zip`);
      toast(
        `تم تنزيل ${files.length} صورة في ملف ZIP${failed ? ` — ${failed} صورة تعذر تحميلها` : ''}`,
        'success'
      );
    } catch {
      setNote('تعذر تجهيز ZIP — بنفتح الصور واحدة واحدة.');
      toast('تعذر تجهيز ZIP — هنفتح الصور واحدة واحدة', 'error');
      images.forEach(url => window.open(url, '_blank', 'noopener'));
    } finally {
      setDownloading(false);
    }
  };

  // نسخ الصورة للحافظة — تلصقها مباشرة في منشور فيسبوك بـ Ctrl+V
  const copyImageAt = async (index = 0) => {
    if (!ad) { toast('اختار إعلان الأول', 'error'); return; }
    const url = adImages[index];
    if (!url) { toast('الإعلان مفيش فيه صور', 'error'); return; }
    setCopyingImg(true);
    const ok = await copyImageFromUrl(url);
    setCopyingImg(false);
    toast(
      ok ? 'اتنسخت الصورة ✓ — الصقها في المنشور بـ Ctrl+V' : 'المتصفح مش سامح بنسخ الصورة — استخدم «تنزيل الصور»',
      ok ? 'success' : 'error'
    );
  };

  const openAllImages = () => {
    if (!adImages.length) { toast('الإعلان مفيش فيه صور', 'error'); return; }
    adImages.slice(0, 8).forEach(url => window.open(url, '_blank', 'noopener'));
  };

  // ── bridge to Chrome extension (optional) for tab-to-tab publishing ────────
  const [extBridgeReady, setExtBridgeReady] = useState(false);
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== 'tareeq-ext') return;
      if (d.type === 'BRIDGE_READY') { setExtBridgeReady(true); return; }
      if (d.type === 'STARTED') {
        if (d.ok) setNote('بدأ الطابور في الإضافة (tab-to-tab) ✓');
        return;
      }
      if (d.type === 'ADVANCED' || d.type === 'SKIPPED') {
        const newPosted = d.posted || posted;
        setPosted(newPosted);
        saveJson(LS_POSTED, newPosted);
        persistGroups(groupsRef.current.map(g => (d.id && g.id === d.id) ? { ...g, lastPostedAt: newPosted[g.id] || g.lastPostedAt } : g));
        if (typeof d.idx === 'number') setQIdx(d.idx);
        if (d.done) {
          setQueue([]);
          setQIdx(0);
          if (d.type === 'ADVANCED' && isTextMode) markDraftDone();
          setNote('خلّصت كل جروبات الطابور ✓');
          toast('خلّصت كل جروبات الطابور ✓', 'success');
        }
        return;
      }
      if (d.type === 'STOPPED') {
        setQueue([]);
        setQIdx(0);
        setNote('اتوقف الطابور (من الإضافة).');
        return;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [posted, persistGroups, toast, isTextMode, markDraftDone]);

  const extStartQueue = useCallback((ids: string[]) => {
    // دايماً بنبلّغ الإضافة بالطابور — حتى لو الـ bridge لسه بيحمّل، الرسالة مش بتضر
    const imgs = isTextMode ? [] : adImages;
    const texts = isTextMode ? variants : {};
    window.postMessage({
      source: 'tareeq-app', type: 'START_QUEUE', queue: ids, adTitle: ad?.title || '',
      images: imgs, text: isTextMode ? pubText : '', texts, mode: isTextMode ? 'text' : 'image',
    }, '*');
    saveJson(LS_QUEUE, {
      ids, adId: ad?.id || '', images: imgs,
      text: isTextMode ? pubText : '', texts, mode: isTextMode ? 'text' : 'image',
      draftId: isTextMode ? pubDraftId : '', startedAt: new Date().toISOString(),
    });
    return true;
  }, [ad, adImages, isTextMode, pubText, variants, pubDraftId]);

  const extSync = useCallback((idx: number, nextPosted: Record<string, string>) => {
    window.postMessage({ source: 'tareeq-app', type: 'SYNC', idx, posted: nextPosted }, '*');
  }, []);

  // ── publishing queue ───────────────────────────────────────────────────
  const openGroup = useCallback((g: FbGroup | null, copyImage = true) => {
    if (!g) return;
    const target = /^\d+$/.test(String(g.id)) ? `https://www.facebook.com/groups/${g.id}/?tareeq=1` : String(g.url || '');
    // فتح التاب فورًا قبل أي await عشان مانع الإعلانات المنبثقة
    let win: Window | null = null;
    try { win = window.open(target, '_blank'); if (win) win.opener = null; } catch { /* ignore */ }
    if (!win) toast('لو التاب ما اتفتحش — اسمح بالنوافذ المنبثقة (Pop-ups) وجرب تاني', 'error');
    if (!copyImage) return;
    if (isTextMode) {
      const txt = textForGroup(g.id);
      if (!txt) { toast('البوست النصي فاضي — ابعته تاني من مركز التسويق', 'error'); return; }
      void copyText(txt).then(ok => {
        toast(
          ok
            ? '✅ التاب اتفتح والنص اتنسخ — الصقه في المنشور (Ctrl+V) وانشر'
            : '✅ التاب اتفتح — انسخ النص من الكارت اللي فوق',
          ok ? 'success' : 'info'
        );
      });
      return;
    }
    const first = adImages[0];
    if (!first) { toast('اتفتح الجروب — الإعلان مفيش فيه صور', 'info'); return; }
    void copyImageFromUrl(first).then(ok => {
      toast(
        ok
          ? '✅ التاب اتفتح والصورة اتنسخت — الصقها في المنشور (Ctrl+V) وانشر'
          : '✅ التاب اتفتح — نزّل الصور وارفعها من زر «صورة/فيديو» في المنشور',
        ok ? 'success' : 'info'
      );
    });
  }, [isTextMode, textForGroup, adImages, copyImageFromUrl, toast]);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!selectedCount) m.push('اختار جروب واحد على الأقل من الخطوة ١');
    if (isTextMode) {
      if (!pubText.trim()) m.push('البوست النصي فاضي — ابعته تاني من مركز التسويق');
    } else {
      if (!ad) m.push('اختار إعلان من الخطوة ٢');
      else if (!adImages.length) m.push('الإعلان المختار مفيش فيه صور — اختار إعلان فيه صور');
    }
    return m;
  }, [selectedCount, isTextMode, pubText, ad, adImages.length]);
  const canStart = missing.length === 0;

  const beginQueue = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setQueue(ids);
    setQIdx(0);
    extStartQueue(ids);
    const first = groupsRef.current.find(g => g.id === ids[0])
      || ({ id: ids[0], name: `جروب ${ids[0]}`, url: `https://www.facebook.com/groups/${ids[0]}/` } as FbGroup);
    openGroup(first, true);
  }, [extStartQueue, openGroup]);

  const startQueue = () => {
    if (!canStart) {
      setNote(missing.join(' — '));
      toast(missing[0] || 'كمّل البيانات الأول', 'error');
      return;
    }
    setNote(`بدأ النشر على ${selectedIds.length} جروب — صور الإعلان فقط بدون نص.`);
    beginQueue(selectedIds);
  };

  // دفعة جديدة: ١٠ جروبات اللي دورهم — بيفتح جروب ١ فورًا
  const startBatch = () => {
    if (isTextMode) {
      if (!pubText.trim()) { toast('البوست النصي فاضي — ابعته تاني من مركز التسويق', 'error'); return; }
    } else {
      if (!ad) { toast('اختار إعلان من الخطوة ٢ الأول', 'error'); return; }
      if (!adImages.length) { toast('الإعلان مفيش فيه صور — اختار إعلان فيه صور', 'error'); return; }
    }
    const ids = pickNextBatch();
    if (!ids.length) { toast('مفيش جروبات — ضيف جروبات في الخطوة ١', 'error'); return; }
    selectNextBatch();
    moveCursor(ids);
    setNote(isTextMode
      ? `دفعة جديدة: ${ids.length} جروب — بوست نص جاهز، هيفتح جروب ١ دلوقتي.`
      : `دفعة جديدة: ${ids.length} جروب — هيفتح جروب ١ دلوقتي.`);
    beginQueue(ids);
  };

  const stopQueue = () => {
    setQueue([]);
    setQIdx(0);
    setNote('اتوقف الطابور.');
  };

  const advance = useCallback((mark: boolean) => {
    const id = queue[qIdx];
    let nextPosted = posted;
    if (mark && id) {
      if (todayCount >= DAILY_CAP && !confirm(`نشرت ${todayCount} بوست النهارده — الحد الآمن ${DAILY_CAP} بوست. تحب تكمل؟`)) return;
      const stamp = new Date().toISOString();
      nextPosted = { ...posted, [id]: stamp };
      setPosted(nextPosted);
      saveJson(LS_POSTED, nextPosted);
      persistGroups(groupsRef.current.map(g => g.id === id ? { ...g, lastPostedAt: stamp } : g));
      if (firebaseAuth.currentUser) void api('mark', { id });
      bumpDaily();
      if (qIdx + 1 < queue.length) setCooldownLeft(SAFE_GAP_SEC);
    }
    const next = qIdx + 1;
    extSync(next, nextPosted);
    if (next >= queue.length) {
      setQueue([]);
      setQIdx(0);
      if (isTextMode) markDraftDone();
      const rest = groupsRef.current.filter(g => g.enabled !== false).length;
      setNote(rest
        ? 'خلّصت الـ10 ✓ — اضغط «ابدأ الـ10 اللي بعدهم» وهيفتح جروب ١ من الدفعة الجديدة.'
        : 'خلّصت كل جروبات الطابور ✓');
      toast('خلّصت الدفعة ✓', 'success');
      return;
    }
    setQIdx(next);
    const g = groupsRef.current.find(x => x.id === queue[next]) || null;
    openGroup(g);
  }, [queue, qIdx, posted, persistGroups, api, openGroup, toast, extSync, isTextMode, markDraftDone, todayCount, bumpDaily]);

  const markCurrent = () => {
    if (cooldownLeft > 0) {
      toast(`⏳ استنى ${cooldownLeft} ثانية (فاصل أمان بين البوستات) — أو اضغط «فتح دلوقتي»`, 'info');
      return;
    }
    void advance(true);
  };
  const skipCurrent = () => { void advance(false); };

  // keyboard shortcuts
  useEffect(() => {
    if (!queue.length) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space') {
        e.preventDefault();
        openGroup(currentGroup);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        advance(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        stopQueue();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        advance(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [queue.length, currentGroup, openGroup, advance]);

  // ── render ─────────────────────────────────────────────────────────────
  const stepBadge = (n: number) => (
    <span className="w-7 h-7 shrink-0 rounded-full bg-orange text-white text-sm font-extrabold flex items-center justify-center">{n}</span>
  );

  const card = 'bg-white dark:bg-[#101d2e] border border-[#e2e8f0] dark:border-[#26374d] rounded-2xl p-4 sm:p-5';

  // نص الجروب الحالي (نسخة مخصصة لو موجودة) + عدّاد اليوم
  const currentText = textForGroup(currentGroup?.id);
  const currentIsVariant = !!(currentGroup && variants[String(currentGroup.id)]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto" dir="rtl">

      {/* header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-orange" /> النشر على جروبات فيسبوك
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isTextMode
              ? <>بوست جاهز من مركز التسويق ← انشره <b>نص</b> على جروباتك يدوي واحد ورا التاني.</>
              : <>اسحب جروباتك ← اختار إعلان ← انشر <b>صور الإعلان فقط</b> (بدون نص أو لينك) يدوي واحد ورا التاني.</>}
          </p>
        </div>
        <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${extBridgeReady
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
          {extBridgeReady ? 'إضافة كروم: متصلة ✓ (نشر tab-to-tab)' : 'إضافة كروم: غير مثبتة (نشر يدوي)'}
        </span>
      </div>

      {note && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-xs font-bold text-blue-800 dark:text-blue-200 flex items-start gap-2">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{note}</span>
        </div>
      )}

      {/* ── step 1: groups ─────────────────────────────────────────────── */}
      <section className={card}>
        <div className="flex items-start gap-3 mb-4">
          {stepBadge(1)}
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">سحب جروبات فيسبوك</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              عندك {groups.length} جروب محفوظ — فيهم {usableGroups.length} جاهز للنشر.
            </p>
          </div>
          <button onClick={() => setShowHelp(v => !v)}
            className="text-xs font-bold text-gray-500 hover:text-orange flex items-center gap-1">
            {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} إزاي أسحب؟
          </button>
        </div>

        {showHelp && (
          <div className="mb-4 rounded-xl bg-gray-50 dark:bg-[#0b1626] border border-[#e2e8f0] dark:border-[#26374d] p-4 space-y-2 text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
            <p className="font-extrabold text-gray-900 dark:text-gray-100">لو عندك خبرة تقنية (اختياري):</p>
            <p>1. اضغط <b>«انسخ كود السحب»</b> → افتح فيسبوك → <b>F12</b> → <b>Console</b> → <b>Ctrl+V</b> → <b>Enter</b>.</p>
            <p>2. استنى لحد ما تظهر رسالة بعدد الجروبات → ارجع هنا والصق في «لصق مباشر».</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-bold">
              الطرق الثلاثة تحت مش محتاجة كود خالص — استخدمها لو مش مرتاح للـ Console.
            </p>
            <button onClick={copyScraper}
              className="inline-flex items-center gap-1.5 text-[11px] font-extrabold bg-orange text-white hover:bg-orange/90 px-3 py-1.5 rounded-lg">
              <Copy className="w-3 h-3" /> انسخ كود السحب (متقدم)
            </button>
          </div>
        )}

        {/* طر ق السحب بدون كود */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button onClick={() => setMethod('paste')}
            className={`text-[11px] font-extrabold py-2.5 rounded-xl border transition-colors ${method === 'paste' ? 'bg-orange text-white border-orange' : 'bg-white dark:bg-[#0b1626] text-gray-600 dark:text-gray-300 border-[#e2e8f0] dark:border-[#26374d] hover:border-orange'}`}>
            لصق مباشر
          </button>
          <button onClick={() => setMethod('bookmark')}
            className={`text-[11px] font-extrabold py-2.5 rounded-xl border transition-colors ${method === 'bookmark' ? 'bg-orange text-white border-orange' : 'bg-white dark:bg-[#0b1626] text-gray-600 dark:text-gray-300 border-[#e2e8f0] dark:border-[#26374d] hover:border-orange'}`}>
            زر السحب
          </button>
          <button onClick={() => setMethod('extension')}
            className={`text-[11px] font-extrabold py-2.5 rounded-xl border transition-colors ${method === 'extension' ? 'bg-orange text-white border-orange' : 'bg-white dark:bg-[#0b1626] text-gray-600 dark:text-gray-300 border-[#e2e8f0] dark:border-[#26374d] hover:border-orange'}`}>
            إضافة كروم
          </button>
        </div>

        {method === 'paste' && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 space-y-3">
            <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200">أسهل طريقة — بدون أي كود:</p>
            <ol className="text-[12px] leading-relaxed text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
              <li>اضغط <b>«افتح جروباتي في فيسبوك»</b> وسجّل دخول لو طلب.</li>
              <li>في تاب فيسبوك: <b>مرّر لأسفل</b> لحد ما تظهر كل الجروبات اللي عندك.</li>
              <li>اضغط <b>Ctrl+A</b> (تحديد الكل) ثم <b>Ctrl+C</b> (نسخ).</li>
              <li>ارجع هنا → اضغط <b>Ctrl+V</b> داخل الخانة تحت — الأسماء واللينكات هتتضاف لوحدها.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <button onClick={openFbGroups}
                className="flex items-center gap-1.5 text-xs font-extrabold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3.5 py-2 rounded-xl transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> افتح جروباتي في فيسبوك
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] px-3.5 py-2 rounded-xl hover:border-orange transition-colors">
                <Upload className="w-3.5 h-3.5" /> رفع ملف .txt
              </button>
            </div>
            <textarea
              value={paste}
              onChange={e => setPaste(e.target.value)}
              onPaste={onPasteGroups}
              rows={5}
              placeholder={'الصق هنا (Ctrl+V) — هنستخرج الجروبات تلقائيًا.\nأو اكتب/الصق لينكات: اسم الجروب | https://www.facebook.com/groups/123456789/'}
              className="w-full text-xs leading-relaxed border border-[#e2e8f0] dark:border-[#26374d] rounded-xl px-3 py-2.5 bg-white dark:bg-[#0b1626] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange resize-y"
            />
            <button onClick={() => addGroups()}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-2.5 rounded-xl transition-colors">
              <ClipboardPaste className="w-4 h-4" /> إضافة الجروبات من النص
            </button>
            <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">
              لو العدد ظهر قليل: ارجع لفيسبوك، مرّر لآخر القائمة، ثم كرر Ctrl+A / Ctrl+C.
            </p>
          </div>
        )}

        {method === 'bookmark' && (
          <div className="rounded-xl border border-orange/30 bg-orange/5 p-4 space-y-3">
            <p className="text-xs font-extrabold text-orange">زر السحب — تثبيت مرة واحدة بدون كود:</p>
            <ol className="text-[12px] leading-relaxed text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
              <li>اضغط <b>Ctrl+Shift+B</b> لإظهار شريط المفضلة (Bookmarks bar).</li>
              <li><b>اسحب الزر البرتقالي</b> اللي تحت وارميه على شريط المفضلة.</li>
              <li>افتح صفحة <b>جروباتك في فيسبوك</b>.</li>
              <li>اضغط زر <b>«سحب جروبات CarMasr»</b> من الشريط — هيسحب وينسخ القائمة لوحده.</li>
              <li>ارجع هنا → تبويب <b>«لصق مباشر»</b> → <b>Ctrl+V</b>.</li>
            </ol>
            <div className="flex flex-wrap gap-2 items-center">
              <a
                ref={setBookmarkRef}
                draggable
                onClick={(e) => { e.preventDefault(); toast('اسحب الزر لشريط المفضلة (مش تدوس عليه هنا) — اضغط Ctrl+Shift+B لإظهار الشريط', 'info'); }}
                className="cursor-grab active:cursor-grabbing select-none inline-flex items-center gap-1.5 text-xs font-extrabold bg-orange text-white px-4 py-2.5 rounded-xl shadow-sm hover:bg-orange/90">
                <Download className="w-4 h-4" /> سحب جروبات CarMasr (اسحبني)
              </a>
              <button onClick={() => setMethod('paste')}
                className="text-[11px] font-bold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] px-3 py-2 rounded-xl hover:border-orange">
                فتح تبويب اللصق
              </button>
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">
              لو الزر مش بيشتغل على فيسبوك (حماية المتصفح) — استخدم «إضافة كروم» أو «لصق مباشر».
            </p>
          </div>
        )}

        {method === 'extension' && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
            <p className="text-xs font-extrabold text-blue-800 dark:text-blue-200">إضافة كروم — بتسحب كل الجروبات بدقة:</p>
            <ol className="text-[12px] leading-relaxed text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
              <li>اضغط <b>«نزّل الإضافة»</b> وفك ضغط الملف.</li>
              <li>افتح <b>chrome://extensions</b> في كروم.</li>
              <li>فعّل <b>Developer mode</b> (أعلى اليمين) → اضغط <b>Load unpacked</b> → اختار الفولدر اللي فكيته.</li>
              <li>افتح <b>facebook.com/groups</b> → زر <b>«سحب جروبات CarMasr»</b> أسفل يمين الصفحة.</li>
              <li>هينزل ملف <b>tareeq-groups.txt</b> → ارفعه هنا بزر <b>«رفع ملف»</b>.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <a href="/tareeq-groups-extension.zip" download
                className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700">
                <Download className="w-4 h-4" /> نزّل الإضافة
              </a>
              <button onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] px-3.5 py-2.5 rounded-xl hover:border-orange">
                <Upload className="w-4 h-4" /> رفع ملف tareeq-groups.txt
              </button>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              الإضافة تقرأ الصفحة اللي انت مفتوح عليها بس — سجّل دخول فيسبوك وافتح صفحة «جروباتك» الأول.
            </p>
          </div>
        )}

        <input ref={fileRef} type="file" accept=".txt,.csv,.json" className="hidden" onChange={e => onFile(e.target.files?.[0] || null)} />

        {groups.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 flex-wrap">
                <Users className="w-4 h-4" />
                {groups.length} جروب — محدد {selectedCount}
                <span className="text-gray-300">|</span>
                <span className="text-orange">متبقي {remainingCount}</span>
                <span className="text-emerald-600 dark:text-emerald-400">اتنشر {postedCount}</span>
                <span className="text-indigo-600 dark:text-indigo-400">في الدفعة {queue.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={selectNextBatch} className="text-[11px] font-extrabold text-orange hover:underline">
                  الـ10 اللي دورهم ({cursor >= usableGroups.length ? 1 : cursor + 1})
                </button>
                <span className="text-gray-300">|</span>
                <button onClick={() => selectAll(true)} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline">تحديد الكل</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => selectAll(false)} className="text-[11px] font-bold text-gray-500 hover:underline">إلغاء التحديد</button>
                <span className="text-gray-300">|</span>
                <button onClick={clearAllGroups} className="text-[11px] font-bold text-red-500 hover:underline flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> حذف الكل
                </button>
              </div>
            </div>

            {/* فلتر حالة الجروبات — عشان تعرف خلّصت مين وفاضل مين */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {([
                ['all', `الكل ${groups.length}`],
                ['todo', `لسه ${remainingCount}`],
                ['done', `اتنشر ✓ ${postedCount}`],
                ['batch', `في الدفعة ${queue.length}`],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setGroupFilter(key)}
                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border transition-colors ${groupFilter === key
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                    : 'bg-white dark:bg-[#0b1626] text-gray-600 dark:text-gray-300 border-[#e2e8f0] dark:border-[#26374d] hover:border-orange'}`}>
                  {label}
                </button>
              ))}
              <span className="text-[10px] font-bold text-gray-400 mr-auto">
                {groupFilter === 'all' ? 'كل الجروبات' : groupFilter === 'todo' ? 'اللي لسه ما اتنشرش' : groupFilter === 'done' ? 'اللي اتنشر' : 'جروبات الدفعة الحالية'}
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {visibleGroups.length === 0 && (
                <p className="text-[11px] font-bold text-gray-400 text-center py-4">مفيش جروبات في الفلتر ده.</p>
              )}
              {visibleGroups.map(g => {
                const last = g.lastPostedAt || posted[g.id];
                const hrs = hoursSince(last);
                const cooling = hrs !== null && hrs < coolingHours;
                const inBatch = queuedIds.has(g.id);
                return (
                  <div key={g.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${g.enabled === false
                    ? 'opacity-50 border-[#e2e8f0] dark:border-[#26374d]'
                    : 'border-[#e2e8f0] dark:border-[#26374d] bg-gray-50/60 dark:bg-[#0b1626]/60'}`}>
                    <input type="checkbox" checked={!!selected[g.id]} onChange={() => toggleSelected(g.id)}
                      className="w-4 h-4 accent-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-gray-800 dark:text-gray-100 truncate">{g.name}</p>
                      <p className="text-[10px] text-gray-400 truncate" dir="ltr">{g.url}</p>
                    </div>
                    {inBatch ? (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        في الدفعة
                      </span>
                    ) : last ? (
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 ${cooling
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                        اتنشر ✓ {formatDate(last)}
                      </span>
                    ) : (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        لسه
                      </span>
                    )}
                    <button onClick={() => openGroup(g, false)} title="فتح الجروب"
                      className="p-1.5 text-gray-400 hover:text-blue-600 shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleGroup(g.id)} title={g.enabled === false ? 'تفعيل' : 'تعطيل'}
                      className="p-1.5 text-gray-400 hover:text-amber-600 shrink-0">
                      {g.enabled === false ? <Circle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => removeGroup(g.id)} title="حذف"
                      className="p-1.5 text-gray-400 hover:text-red-500 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── step 2: ad ─────────────────────────────────────────────────── */}
      <section className={card}>
        <div className="flex items-start gap-3 mb-4">
          {stepBadge(2)}
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              {isTextMode ? 'البوست الجاهز (نص)' : 'اختيار الإعلان'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isTextMode ? 'البوست النصي اللي جاي من مركز التسويق — بيتنسخ مع كل جروب.' : 'اختار إعلان جاهز — النص والصور بيتجهزوا تلقائي.'}
            </p>
          </div>
          <button onClick={async () => {
            setLoadingAds(true);
            try { setAds((await listingsService.getAll()).filter(l => l.images?.length)); }
            finally { setLoadingAds(false); }
          }} className={`text-xs font-bold text-gray-500 hover:text-orange flex items-center gap-1 ${isTextMode ? 'hidden' : ''}`}>
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAds ? 'animate-spin' : ''}`} /> تحديث
          </button>
        </div>

        {isTextMode ? (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/20 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-extrabold text-indigo-800 dark:text-indigo-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> بوست جاهز من مركز التسويق — نص
              </p>
              <button onClick={clearTextMode}
                className="text-[10px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] px-2.5 py-1.5 rounded-lg hover:border-orange">
                ارجع لوضع صور الإعلان
              </button>
            </div>
            <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-100 bg-white/70 dark:bg-[#081220] rounded-lg px-3 py-2 max-h-56 overflow-y-auto">
              {pubText || 'البوست النصي فاضي — ابعته تاني من مركز التسويق.'}
            </p>
            <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold">
              النص بيتنسخ تلقائيًا وانت بتفتح كل جروب — الصقه (Ctrl+V) وانشر. بعد ١٠ جروبات هيرجع لمركز التسويق متعلّم «تم».
            </p>
          </div>
        ) : (
          <>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input value={adSearch} onChange={e => setAdSearch(e.target.value)}
              placeholder="ابحث باسم الإعلان أو الماركة..."
              className="w-full text-xs border border-[#e2e8f0] dark:border-[#26374d] rounded-xl pr-9 pl-3 py-2.5 bg-white dark:bg-[#0b1626] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange" />
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={showAllAds} onChange={e => setShowAllAds(e.target.checked)} className="w-3.5 h-3.5 accent-orange" />
            اعرض غير النشط كمان
          </label>
        </div>

        {loadingAds ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري تحميل الإعلانات...
          </div>
        ) : filteredAds.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
            <Truck className="w-8 h-8 opacity-40" />
            مفيش إعلانات فيها صور مطابقة.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredAds.map(l => {
              const active = l.id === adId;
              return (
                <button key={l.id} onClick={() => setAdId(l.id)}
                  className={`text-right rounded-xl border overflow-hidden transition-all ${active
                    ? 'border-orange ring-2 ring-orange/30 bg-orange/5'
                    : 'border-[#e2e8f0] dark:border-[#26374d] hover:border-orange/60 bg-white dark:bg-[#0b1626]'}`}>
                  <div className="relative aspect-[4/3] bg-gray-100 dark:bg-[#0b1626]">
                    <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute bottom-1 left-1 text-[9px] font-extrabold bg-black/60 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ImageIcon className="w-2.5 h-2.5" /> {l.images.length}
                    </span>
                    {active && (
                      <span className="absolute top-1 right-1 bg-orange text-white rounded-full p-1">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-extrabold text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug">{l.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{l.governorate} • {l.status === 'active' ? 'نشط' : l.status}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {ad && (
          <div className="mt-4 rounded-xl border border-[#e2e8f0] dark:border-[#26374d] bg-gray-50/60 dark:bg-[#0b1626]/60 p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
              <div>
                <p className="text-xs font-extrabold text-gray-800 dark:text-gray-100">معاينة صور الإعلان</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                  بوست فيسبوك = {adImages.length} صورة فقط — بدون نص أو لينك
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={shareAdWithImages}
                  className="flex items-center gap-1 text-[11px] font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-lg">
                  <ImageIcon className="w-3 h-3" /> مشاركة بالصور
                </button>
                <button onClick={() => copyImageAt(0)} disabled={copyingImg || !adImages.length}
                  className="flex items-center gap-1 text-[11px] font-extrabold bg-sky-600 text-white hover:bg-sky-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {copyingImg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />} نسخ أول صورة
                </button>
                <button onClick={downloadImages} disabled={downloading || !adImages.length}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  تنزيل ZIP ({adImages.length})
                </button>
                <button onClick={async () => {
                  if (!adImages.length) return;
                  const ok = await copyText(adImages.join('\\n'));
                  toast(ok ? `اتنسخ ${adImages.length} رابط صورة ✓ — الصقها في الإضافة` : 'تعذر النسخ', ok ? 'success' : 'error');
                }} disabled={!adImages.length}
                  className="flex items-center gap-1 text-[11px] font-bold text-orange border border-orange/30 bg-orange/5 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  <Copy className="w-3 h-3" /> نسخ روابط الصور (للإضافة)
                </button>
              </div>
            </div>
            {adImages.length ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {adImages.slice(0, 12).map((src, i) => (
                  <div key={src + i} className="relative rounded-lg overflow-hidden border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626]">
                    <a href={src} target="_blank" rel="noopener noreferrer" title="فتح الصورة بالحجم الكامل">
                      <img src={src} alt={`صورة ${i + 1}`} loading="lazy" className="w-full aspect-square object-cover" />
                    </a>
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] font-bold px-1 rounded">{i + 1}</span>
                    <button onClick={() => copyImageAt(i)} title="نسخ الصورة"
                      className="absolute top-1 left-1 bg-black/60 hover:bg-sky-600 text-white p-1 rounded-md">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-[11px] font-bold text-red-600 dark:text-red-300">
                الإعلان ده مفيش فيه صور — اختار إعلان تاني عشان تقدر تنشر.
              </p>
            )}

            {/* نص الإعلان المكتوب — رجع تاني للمراجعة والنسخ */}
            <div className="mt-3 rounded-xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-orange" /> نص الإعلان المكتوب
                  <span className="text-[9px] font-bold text-gray-400">(للمراجعة فقط)</span>
                </p>
                <div className="flex items-center gap-1.5">
                  <button onClick={async () => {
                    const ok = await copyText(adLink);
                    toast(ok ? 'تم نسخ رابط الإعلان ✓' : 'تعذر النسخ', ok ? 'success' : 'error');
                  }} disabled={!adLink}
                    className="flex items-center gap-1 text-[10px] font-extrabold border border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                    <Link2 className="w-3 h-3" /> نسخ الرابط
                  </button>
                  <button onClick={async () => {
                    const ok = await copyText(adText);
                    toast(ok ? 'تم نسخ نص الإعلان مع الرابط ✓' : 'تعذر النسخ — حدد النص وانسخه يدوي', ok ? 'success' : 'error');
                  }} disabled={!adText}
                    className="flex items-center gap-1 text-[10px] font-extrabold bg-gray-800 dark:bg-[#13243a] text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                    <Copy className="w-3 h-3" /> نسخ النص + اللينك
                  </button>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-[#081220] rounded-lg px-3 py-2 max-h-44 overflow-y-auto">
                {adText || 'الإعلان مفيهوش نص مكتوب.'}
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold mt-1.5 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                بوست فيسبوك صور فقط — النص هنا للمراجعة والنسخ عند الحاجة، ومش بيتنشر تلقائي.
              </p>
            </div>

            <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold mt-2 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              الصق الصورة في المنشور بـ Ctrl+V. لو المتصفح مش سامح بالنسخ، نزّل ZIP (بأسماء جاهزة للسيو) وارفع الصور من زر «صورة/فيديو» في المنشور.
            </p>
          </div>
        )}
          </>
        )}
      </section>

      {/* ── step 3: publish queue ───────────────────────────────────────── */}
      <section className={card}>
        <div className="flex items-start gap-3 mb-4">
          {stepBadge(3)}
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              النشر اليدوي ({isTextMode ? 'نص جاهز' : 'صور فقط'})
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isTextMode
                ? '«نص + فتح» بيفتح الجروب وينسخ البوست — الصقه (Ctrl+V)، انشر، وبعدين «نشرت — التالي».'
                : '«صورة + فتح» بيفتح الجروب وينسخ أول صورة — الصقها (Ctrl+V) أو ارفع الصور، انشر، وبعدين «نشرت — التالي».'}
            </p>
          </div>
        </div>

        {!queue.length ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-gray-50 dark:bg-[#0b1626] border border-[#e2e8f0] dark:border-[#26374d] p-3 text-center">
                <p className="text-lg font-extrabold text-gray-900 dark:text-gray-100">{selectedCount}</p>
                <p className="text-[10px] text-gray-500">جروب محدد</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-[#0b1626] border border-[#e2e8f0] dark:border-[#26374d] p-3 text-center">
                <p className="text-lg font-extrabold text-emerald-600">{Object.keys(posted).length}</p>
                <p className="text-[10px] text-gray-500">اتنشر قبل كده</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-[#0b1626] border border-[#e2e8f0] dark:border-[#26374d] p-3 text-center">
                <p className="text-lg font-extrabold text-orange">{isTextMode ? 'نص' : (ad ? (ad.images?.length || 0) : 0)}</p>
                <p className="text-[10px] text-gray-500">{isTextMode ? 'بوست جاهز' : 'صور الإعلان'}</p>
              </div>
            </div>
            {/* فحص سريع قبل البدء — كل سطر بيقول الحالة بالظبط */}
            <div className="space-y-1.5 mb-3">
              <div className={`flex items-center gap-2 text-[11px] font-bold rounded-lg px-3 py-1.5 ${selectedCount ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20'}`}>
                {selectedCount ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                {selectedCount ? `${selectedCount} جروب محدد وجاهز` : 'محتاج تحدد جروب واحد على الأقل (الخطوة ١)'}
              </div>
              <div className={`flex items-center gap-2 text-[11px] font-bold rounded-lg px-3 py-1.5 ${isTextMode ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20' : 'hidden'}`}>
                {isTextMode && <CheckCircle2 className="w-3.5 h-3.5" />}
                {isTextMode && (pubText.trim() ? `بوست نص جاهز — ${pubText.trim().split(/\s+/).length} كلمة` : 'البوست النصي فاضي')}
              </div>
              {!isTextMode && (
                <>
                  <div className={`flex items-center gap-2 text-[11px] font-bold rounded-lg px-3 py-1.5 ${ad ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20'}`}>
                    {ad ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    {ad ? `الإعلان: ${ad.title}` : 'محتاج تختار إعلان (الخطوة ٢)'}
                  </div>
                  <div className={`flex items-center gap-2 text-[11px] font-bold rounded-lg px-3 py-1.5 ${adImages.length ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20'}`}>
                    {adImages.length ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    {adImages.length ? `${adImages.length} صورة جاهزة — البوست صور فقط` : 'محتاج إعلان فيه صور'}
                  </div>
                </>
              )}
            </div>

            <button onClick={startBatch}
              className="w-full flex items-center justify-center gap-2 font-extrabold text-sm py-3.5 rounded-xl bg-orange text-white hover:bg-orange/90 transition-colors mb-2">
              <Play className="w-4 h-4" /> ابدأ الـ{BATCH_SIZE} اللي دورهم — ويفتح جروب ١ حالًا
            </button>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center mb-3">
              بعد ما تنشر: اضغط «نشرت — التالي» (أو الزر الأخضر على تاب فيسبوك) → يفتح الجروب اللي بعده لوحده.
            </p>

            <button onClick={startQueue}
              className={`w-full flex items-center justify-center gap-2 font-extrabold text-sm py-3 rounded-xl transition-colors ${canStart
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-200 dark:bg-[#1b2a3d] text-gray-500 dark:text-gray-400'}`}>
              <Play className="w-4 h-4" /> ابدأ النشر ({selectedCount} جروب)
            </button>
            {!canStart && (
              <p className="text-[11px] text-red-500 font-bold mt-2 text-center">ناقص: {missing.join(' — ')}</p>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
                  الجروب {qIdx + 1} من {queue.length} — اتنشر {doneCount}
                </p>
                <span className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${todayCount >= DAILY_CAP
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'}`}>
                    النهارده: {todayCount} / {DAILY_CAP}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    {Math.round(((qIdx) / queue.length) * 100)}%
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50 overflow-hidden">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${Math.round(((qIdx) / queue.length) * 100)}%` }} />
              </div>
              <p className="mt-2 text-[13px] font-extrabold text-gray-900 dark:text-gray-100 truncate">
                {currentGroup?.name || '—'}
              </p>
              <p className="text-[10px] text-gray-500 truncate" dir="ltr">{currentGroup?.url}</p>
              {isTextMode ? (
                <div className="mt-3 rounded-lg bg-white/70 dark:bg-[#081220] border border-emerald-200 dark:border-emerald-800 p-2.5 space-y-2">
                  {currentIsVariant && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-gradient-to-l from-indigo-600 to-purple-600 text-white px-2 py-0.5 rounded-full">
                      <Sparkles className="w-2.5 h-2.5" /> نسخة مخصصة للجروب ده
                    </span>
                  )}
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-200 max-h-40 overflow-y-auto">{currentText || '—'}</p>
                  <button onClick={async () => {
                    const ok = await copyText(currentText);
                    toast(ok ? 'اتنسخ نص البوست ✓ — الصقه في المنشور (Ctrl+V)' : 'تعذر النسخ — حدد النص وانسخه يدوي', ok ? 'success' : 'error');
                  }} disabled={!currentText}
                    className="flex items-center gap-1 text-[10px] font-extrabold bg-sky-600 text-white hover:bg-sky-700 px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                    <Copy className="w-3 h-3" /> نسخ نص البوست
                  </button>
                </div>
              ) : (
                <>
                  {ad && (ad.images?.length || 0) > 0 && (
                    <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                      {ad.images.filter(Boolean).slice(0, 4).map((src, i) => (
                        <a key={src + i} href={src} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <img src={src} alt={`صورة ${i + 1}`} loading="lazy"
                            className="w-14 h-14 object-cover rounded-lg border border-emerald-200 dark:border-emerald-800" />
                        </a>
                      ))}
                      <button onClick={() => copyImageAt(0)} disabled={copyingImg}
                        className="shrink-0 flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-lg bg-sky-600 text-white text-[9px] font-bold disabled:opacity-50">
                        {copyingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                        نسخ الصورة
                      </button>
                      <button onClick={downloadImages} disabled={downloading}
                        className="shrink-0 flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-lg border border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 text-[9px] font-bold disabled:opacity-50">
                        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        ZIP
                      </button>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button onClick={async () => {
                      const ok = await copyText(adText);
                      toast(ok ? 'تم نسخ نص الإعلان مع الرابط ✓ — الصقه في المنشور لو حبيت' : 'تعذر النسخ', ok ? 'success' : 'error');
                    }} disabled={!adText}
                      className="flex items-center gap-1 text-[10px] font-extrabold bg-gray-800 dark:bg-[#13243a] text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                      <Copy className="w-3 h-3" /> نسخ النص + اللينك
                    </button>
                    <button onClick={async () => {
                      const ok = await copyText(adLink);
                      toast(ok ? 'تم نسخ رابط الإعلان ✓' : 'تعذر النسخ', ok ? 'success' : 'error');
                    }} disabled={!adLink}
                      className="flex items-center gap-1 text-[10px] font-extrabold border border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                      <Link2 className="w-3 h-3" /> رابط الإعلان
                    </button>
                    <span className="text-[9px] font-bold text-gray-400">اختياري — النشر التلقائي صور فقط</span>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button onClick={() => openGroup(currentGroup)}
                className="flex items-center justify-center gap-1.5 text-[11px] font-extrabold bg-orange text-white hover:bg-orange/90 py-2.5 rounded-xl">
                <Copy className="w-3.5 h-3.5" /> {isTextMode ? 'نص + فتح' : 'صورة + فتح'} <span className="opacity-70">(Space)</span>
              </button>
              <button onClick={markCurrent} disabled={cooldownLeft > 0}
                className={`flex items-center justify-center gap-1.5 text-[11px] font-extrabold py-2.5 rounded-xl transition-colors ${cooldownLeft > 0
                  ? 'bg-gray-300 dark:bg-[#1b2a3d] text-gray-600 dark:text-gray-300 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {cooldownLeft > 0 ? `⏳ استنى ${cooldownLeft} ث` : 'نشرت — التالي'}
                <span className="opacity-70">(Enter)</span>
              </button>
              <button onClick={skipCurrent}
                className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 py-2.5 rounded-xl">
                <SkipForward className="w-3.5 h-3.5" /> تخطي <span className="opacity-70">(S)</span>
              </button>
              <button onClick={stopQueue}
                className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 py-2.5 rounded-xl">
                <Square className="w-3.5 h-3.5" /> إيقاف <span className="opacity-70">(Esc)</span>
              </button>
            </div>

            {cooldownLeft > 0 && (
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
                <span>⏳ فاصل أمان {cooldownLeft} ثانية — فيسبوك ميحبّش النشر المتكرر السريع</span>
                <button onClick={() => { setCooldownLeft(0); void advance(true); }}
                  className="shrink-0 underline decoration-dotted">افتح دلوقتي</button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {!isTextMode && (
                <>
                  <button onClick={() => copyImageAt(0)} disabled={copyingImg || !adImages.length}
                    className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-3 py-2 rounded-lg hover:border-orange disabled:opacity-50">
                    {copyingImg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />} نسخ الصورة
                  </button>
                  <button onClick={downloadImages} disabled={downloading || !adImages.length}
                    className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-3 py-2 rounded-lg hover:border-orange disabled:opacity-50">
                    {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} تنزيل ZIP
                  </button>
                </>
              )}
              {isTextMode && (
                <button onClick={async () => {
                  const ok = await copyText(pubText);
                  toast(ok ? 'اتنسخ نص البوست ✓' : 'تعذر النسخ', ok ? 'success' : 'error');
                }} disabled={!pubText}
                  className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-3 py-2 rounded-lg hover:border-orange disabled:opacity-50">
                  <Copy className="w-3 h-3" /> نسخ نص البوست
                </button>
              )}
              <button onClick={() => { const g = currentGroup; if (g) openGroup(g, false); }}
                className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-3 py-2 rounded-lg hover:border-orange">
                <ExternalLink className="w-3 h-3" /> فتح الجروب فقط
              </button>
            </div>

            <div className="text-[10px] text-gray-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              اختصارات: Space = {isTextMode ? 'نص+فتح' : 'صورة+فتح'} · Enter = نشرت—التالي · S = تخطي · Esc = إيقاف
            </div>
          </div>
        )}
      </section>

      {/* last posted list */}
      {Object.keys(posted).length > 0 && (
        <section className={card}>
          <h3 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> آخر عمليات النشر
          </h3>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {Object.entries(posted)
              .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
              .slice(0, 30)
              .map(([id, at]) => {
                const g = groups.find(x => x.id === id);
                return (
                  <div key={id} className="flex items-center justify-between gap-2 text-[11px] rounded-lg border border-[#e2e8f0] dark:border-[#26374d] px-3 py-1.5">
                    <span className="font-bold text-gray-700 dark:text-gray-200 truncate">{g?.name || id}</span>
                    <span className="text-gray-400 shrink-0">{formatDateTime(at)}</span>
                  </div>
                );
              })}
          </div>
          <button onClick={() => {
            if (!confirm('تصفير سجل النشر على هذا الجهاز؟ (مش بيحذف الجروبات)')) return;
            setPosted({});
            saveJson(LS_POSTED, {});
          }} className="mt-3 text-[11px] font-bold text-gray-400 hover:text-red-500">
            تصفير السجل
          </button>
        </section>
      )}
    </div>
  );
}
