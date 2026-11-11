import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Users, Truck, Briefcase, Package, DollarSign,
  Flag, BarChart2, Settings, Phone, Share2, FileText, Menu, X,
  LogOut, ChevronRight, TrendingUp, CheckCircle, XCircle,
  Eye, RefreshCw, Search, Loader2, Bell, Edit, Save, Star, Trash2, KeyRound,
  ExternalLink, MessageCircle, Check, LayoutGrid, Landmark, MapPin, Plus, Target,
  MousePointerClick, Store, BadgeCheck, ShieldCheck, ScanSearch, UserCheck, UserX,
  Send, StickyNote, Copy, ClipboardCheck, Sparkles, Wand2, Bookmark,
  ClipboardPaste, Play, Square, CalendarClock, Download, Film, Upload, Megaphone
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "../../firebase";
import {
   listingsService, loadsService, jobsService,
   financeService, usersService, getAdminStats,
   passwordResetsService, notificationsService,
   paymentsService, exhibitionsService, bannerAdsService,
   financeCompaniesService, adAnalyticsService,
  } from '../../lib/firestoreService';
  import { useNotifications } from '../../contexts/NotificationContext';
import ImageUploader from '../../components/ImageUploader';
import { EXHIBITION_PLANS, getExhibitionPlan } from '../../lib/plans';
import type { Listing, Load, Job, FinanceRequest, User, PasswordResetRequest, Exhibition, BannerAd, Payment, FinanceCompany } from '../../types';
import { formatDateDMY, formatPhone, formatDateTime, cleanText, listingUrl, copyText, shareOnFacebook, buildAdTeaser, buildAdPageText, messengerMessageTarget, isFacebookLink } from '../../lib/utils';
import { getApiUrl } from '../../lib/config';
import TriageTab from '../../components/TriageTab';
import SendAdChat from '../SendAdChat';
import ServicesManager from '../../components/admin/ServicesManager';
import MerchantsManager from '../../components/admin/MerchantsManager';
import AdminNotes from './AdminNotes';
import SavedTitlesPanel from './SavedTitlesPanel';
import FbPublishPage from './FbPublishPage';
import MarketingPage from './MarketingPage';
import VideoStudio from './VideoStudio';
import { logAdminAction, getAuditLog, clearAuditLog } from '../../lib/audit';

// ── بناء روابط واتساب/ماسنجر لحظة الضغط من القيم الحالية ─────────────

/** تنظيف الرسالة من حروف التحويل � (U+FFFD) وكل الإيموجي 4-بايت (خارج BMP) ورموز التحكم/الصفرية العرض — لأن واتساب/ماسنجر تفسدها على بعض الأجهزة فتبان سبام */
/** الجروب في هدنة ٢٠ ساعة من آخر نشر؟ (دالة على مستوى الموديول لتفادي قواعد نقاء الرندر) */
const groupCooling = (g: { lastPostedAt?: string }) => {
  const t = Date.parse(String(g.lastPostedAt || ''));
  let hours = 20;
  try { hours = Number(localStorage.getItem('fbCoolingHours')) || 20; } catch {}
  return t > 0 && Date.now() - t < hours * 3600 * 1000;
};

function cleanMsg(v: string): string {
  return String(v || '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\uFEFF\u200D]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/\uFE0F/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** تطبيع رقم الموبايل للصيغة الدولية (010… → 2010…) */
function waNumber(phone: string): string {
  let n = String(phone || '').replace(/[^\d]/g, '');
  if (!n) return '';
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('0')) n = '20' + n.slice(1);
  else if (!n.startsWith('20')) n = '20' + n;
  return n;
}

/** روابط واتساب/ماسنجر حية من القیم الحالية — null لو النطيب مفقود */
function buildContactLinks(phone: string, facebook: string, message: string) {
  const enc = encodeURIComponent(cleanMsg(message).slice(0, 1500));
  const wa = waNumber(phone);
  const waLink = wa ? `https://api.whatsapp.com/send/?phone=${wa}&text=${enc}&type=phone_number&app_absent=0` : null;
  const msLink = messengerMessageTarget(facebook, cleanMsg(message));
  return { waLink, msLink };
}

type Tab = 'dashboard'|'tracking'|'users'|'listings'|'jobs'|'loads'|'finance'|'resets'|'exhibitions'|'exhibition-plans'|'bannerads'|'ad-stats'|'payments'|'fin-companies'|'ai-review'|'triage'|'sendad'|'fbpublish'|'marketing'|'video'|'merchants'|'notes'|'settings'|'savedtitles';

const nav: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id:'dashboard', label:'لوحة التحكم',   icon:LayoutDashboard },
  { id:'tracking',  label:'تتبع الحملات',  icon:Target },
  { id:'users',     label:'المستخدمون',     icon:Users },
  { id:'listings',  label:'الإعلانات',      icon:Truck },
  { id:'jobs',      label:'الوظائف',        icon:Briefcase },
  { id:'loads',     label:'الحمولات',       icon:Package },
  { id:'finance',   label:'التمويل',        icon:DollarSign },
  { id:'resets',    label:'طلبات كلمة المرور', icon:FileText },
  { id:'exhibitions', label:'المعارض',      icon:Store },
  { id:'exhibition-plans', label:'باقات المعارض', icon:BadgeCheck },
  { id:'bannerads', label:'إعلانات البانر', icon:Flag },
  { id:'ad-stats',  label:'إحصائيات الإعلانات', icon:MousePointerClick },
  { id:'payments',  label:'المدفوعات',      icon:BarChart2 },
  { id:'fin-companies', label:'شركات التمويل', icon:Landmark },
  { id:'ai-review',  label:'مراجعة AI',        icon:ShieldCheck },
  { id:'triage',     label:'تصنيف التذاكر',    icon:Target },
  { id:'sendad',     label:'النشر السريع',     icon:Send },
  { id:'fbpublish',  label:'النشر على فيسبوك', icon:Share2 },
  { id:'marketing',  label:'مركز التسويق',   icon:Megaphone },
  { id:'video',      label:'استوديو الفيديو',  icon:Film },
  { id:'merchants',  label:'التواصل مع التجار', icon:MessageCircle },
  { id:'savedtitles', label:'حافظة الروابط',     icon:Bookmark },
  { id:'notes',      label:'الملاحظات',        icon:StickyNote },
  { id:'settings',  label:'الإعدادات',      icon:Settings },
];

// ── small helpers ─────────────────────────────────────────────────────
const badge = (s: string) => {
  const m: Record<string,string> = {
    active:'bg-success/10 text-success', pending:'bg-yellow-100 text-yellow-700',
    rejected:'bg-danger/10 text-danger', sold:'bg-gray-100 text-gray-500',
    new:'bg-blue-100 text-blue-700', reviewing:'bg-yellow-100 text-yellow-700',
    approved:'bg-success/10 text-success', available:'bg-success/10 text-success',
    admin:'bg-orange/10 text-orange', individual:'bg-gray-100 text-gray-600',
    company:'bg-blue-100 text-blue-700',
  };
  const ar: Record<string,string> = {
    active:'نشط', pending:'معلق', rejected:'مرفوض', sold:'مُباع',
    new:'جديد', reviewing:'تحت المراجعة', approved:'موافَق عليه',
    available:'متاح', admin:'مدير', individual:'فرد', company:'شركة',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m[s]||'bg-gray-100 text-gray-600'}`}>{ar[s]||s}</span>;
};

const StatCard = ({ label, value, icon:Icon, color }: any) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <div className="text-2xl font-black text-gray-900">{value ?? <Loader2 className="w-5 h-5 animate-spin text-gray-300" />}</div>
      <div className="text-gray-500 text-sm">{label}</div>
    </div>
  </div>
);

const barChartColors = [
  'bg-gradient-to-l from-orange to-orange-300',
  'bg-gradient-to-l from-blue-500 to-blue-300',
  'bg-gradient-to-l from-green-500 to-green-300',
  'bg-gradient-to-l from-purple-500 to-purple-300',
  'bg-gradient-to-l from-amber-500 to-amber-300',
  'bg-gradient-to-l from-red-500 to-red-300',
  'bg-gradient-to-l from-teal-500 to-teal-300',
];

const statusLabels: Record<string, string> = {
  active: 'نشط', pending: 'معلق', rejected: 'مرفوض', sold: 'مباع', featured: 'مميز',
};

function chartBars(counts: Record<string, number>, labels?: Record<string, string>) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const maxCount = entries[0]?.[1] || 1;
  return entries.map(([key, count], i) => {
    const pct = Math.round((count / maxCount) * 100);
    const label = labels?.[key] || key;
    return (
      <div key={key}>
        <div className="flex justify-between text-sm mb-1">
          <span className={`px-1.5 py-0.5 rounded text-xs ${barChartColors[i]} text-white truncate max-w-[60%]`}>
            {label}
          </span>
          <span className="font-bold text-gray-900">{count}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barChartColors[i]}`}
            style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  });
}

const statusChartBars = (c: Record<string, number>) => chartBars(c, statusLabels);
const userTypeChartBars = (c: Record<string, number>) => chartBars(c, {
  user: 'مستخدم', company: 'شركة', admin: 'مدير', owner: 'مالك',
});
const jobTypeChartBars = (c: Record<string, number>) => chartBars(c);

const NOTES_KEY = 'tareeq_admin_notes';

const loadNotesStat = () => {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};

function NotesPipelineCard({ onOpen, onRefresh }: { onOpen: () => void; onRefresh?: () => void }) {
  const [notes, setNotes] = useState<any[]>(loadNotesStat());
  const statuses: { id: string; label: string; cls: string }[] = [
    { id: 'جديد', label: 'جديد', cls: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'قيد المتابعة', label: 'قيد المتابعة', cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    { id: 'متفق عليه', label: 'متفق عليه', cls: 'text-green-600 bg-green-50 border-green-200' },
    { id: 'ملغى', label: 'ملغى', cls: 'text-red-500 bg-red-50 border-red-200' },
  ];
  const total = notes.length;
  const open = notes.filter(n => n.status !== 'ملغى').length;
  const agreed = notes.filter(n => n.status === 'متفق عليه').length;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-orange" /> خط الصفقات (الملاحظات)
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => { setNotes(loadNotesStat()); onRefresh?.(); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-orange hover:bg-orange-50 transition-colors" title="تحديث">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onOpen}
            className="text-xs font-bold text-orange hover:bg-orange-50 px-2.5 py-1.5 rounded-lg transition-colors">
            فتح الدفتر
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
          <div className="text-2xl font-black text-gray-800">{total}</div>
          <div className="text-xs text-gray-500 mt-1">إجمالي</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-orange/5 border border-orange-200">
          <div className="text-2xl font-black text-orange-600">{open}</div>
          <div className="text-xs text-gray-500 mt-1">مفتوحة</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-green-50 border border-green-200">
          <div className="text-2xl font-black text-green-600">{agreed}</div>
          <div className="text-xs text-gray-500 mt-1">متفق عليه</div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3">
        {statuses.map(s => (
          <div key={s.id} className={`text-center p-2.5 rounded-xl border ${s.cls}`}>
            <div className="text-lg font-black">{notes.filter(n => n.status === s.id).length}</div>
            <div className="text-[11px] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditLogCard() {
  const [entries, setEntries] = useState(() => getAuditLog());
  const actionLabels: Record<string, string> = {
    admin_unlock: 'فتح اللوحة',
    admin_lock: 'قفل اللوحة',
    admin_pin_setup: 'تفعيل حماية PIN',
    listing_approved: 'موافقة على إعلان',
    listing_rejected: 'رفض إعلان',
    listing_deleted: 'حذف إعلان',
    listing_featured: 'تمييز إعلان',
    listing_unfeatured: 'إلغاء تمييز إعلان',
    listing_duplicated: 'تكرار إعلان',
    fb_share_copied: 'نسخ إعلان فيسبوك',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-orange" /> سجل عمليات الأدمن
        </h3>
        <button onClick={() => { clearAuditLog(); setEntries([]); }}
          className="text-xs text-danger hover:bg-danger/10 px-2.5 py-1.5 rounded-lg transition-colors">
          مسح السجل
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-gray-400 text-sm py-4 text-center">لا توجد عمليات مسجلة بعد</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {[...entries].reverse().slice(0, 14).map((e, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="text-gray-400 text-[11px] mt-0.5 shrink-0 font-mono">{formatDateTime(e.t)}</span>
              <span className="text-gray-700 font-semibold shrink-0">{actionLabels[e.action] || e.action}</span>
              {e.details && <span className="text-gray-500 text-xs truncate flex-1">{e.details}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────
// ── بطاقة طابور نشر الجروبات (مشتركة بين مودال النشر وتبويب جروبات فيسبوك) ──
type FbCampaignCardProps = {
  campaign: any;
  busy: boolean;
  onRefresh: () => void;
  onStart: () => void;
  onStop: () => void;
  onTick: () => void;
  onResume?: () => void;
  children?: any;
  hint?: string;
  hideHeader?: boolean;
};

function FbCampaignCard({ campaign, busy, onRefresh, onStart, onStop, onTick, onResume, children, hint, hideHeader }: FbCampaignCardProps) {
  return (
    <div className="rounded-2xl border border-[#edf1f4] dark:border-[#1d2c41] p-4 space-y-3">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-extrabold text-sm text-gray-700 dark:text-gray-200">
            <CalendarClock className="w-4 h-4 text-blue-600" /> طابور النشر التلقائي
          </div>
          <button onClick={onRefresh} disabled={busy}
            className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> تحديث
          </button>
        </div>
      )}
      {!hideHeader && (
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 leading-relaxed">
          {hint || 'علّم الجروبات اللي فوق واضغط «تشغيل الطابور» — النظام هينشر دفعة صغيرة كل يوم تلقائيًا لحد ما يخلّص، ضمن الحد اليومي والهدنة وبدون أي تكرار على نفس الجروب.'}
        </p>
      )}
      {children}
      {campaign ? (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/15 p-3 space-y-2.5">
          {(campaign.authError || campaign.status === 'error') && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 space-y-2">
              <p className="text-[11px] font-extrabold text-red-600 dark:text-red-400">⚠️ النشر واقف — {campaign.authError ? 'التوكن منتهي' : 'فيه مشكلة'}</p>
              {campaign.error && <p className="text-[11px] text-red-500 dark:text-red-300 leading-relaxed break-words" dir="ltr">{String(campaign.error)}</p>}
              <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                {campaign.authError
                  ? 'جدّد التوكن من كارت «توكن حسابك» فوق في نفس التبويب، وبعدين اضغط استئناف — الجروبات رجعت للدور ومتحرقتش.'
                  : 'شوف سبب الفشل تحت، وبعدين اضغط استئناف بعد ما تصلّحه.'}
              </p>
              {onResume && (
                <button onClick={onResume} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 text-[11px] font-extrabold text-white bg-red-600 hover:bg-red-700 py-2.5 rounded-xl transition-colors disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} استئناف الطابور
                </button>
              )}
            </div>
          )}
          <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">
            الإعلان: <b className="truncate">{campaign.listingTitle || '—'}</b><br />
            الحالة: <b className={campaign.status === 'running' ? 'text-emerald-600 dark:text-emerald-400' : campaign.status === 'done' ? 'text-blue-600 dark:text-blue-400' : campaign.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}>
              {({ running: 'شغّال ✓', done: 'خلّص كل الجروبات ✓', stopped: 'متوقف', error: 'فشل النشر كلّه ⚠️', idle: 'متوقف' } as any)[campaign.status] || campaign.status}
            </b>
            {' '}— نُشر <b>{campaign.doneCount ?? 0}</b> من <b>{campaign.total ?? 0}</b>
            {campaign.failedCount ? <span className="text-red-500"> (فشل {campaign.failedCount})</span> : null}
          </p>
          {campaign.failedCount > 0 && (campaign.failed || []).length > 0 && (
            <p className="text-[11px] font-extrabold text-red-600 dark:text-red-400 leading-relaxed">
              سبب الفشل الأخير: {String(campaign.failed[campaign.failed.length - 1].error || 'غير معروف')}
            </p>
          )}
          <div className="w-full h-2 rounded-full bg-white dark:bg-[#101d2e] border border-[#e2e8f0] dark:border-[#26374d] overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${campaign.total ? Math.max(3, Math.round(((campaign.total - (campaign.remainingCount ?? 0)) / campaign.total) * 100)) : 0}%` }} />
          </div>
          <div className="flex gap-2">
            <button onClick={onTick} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-60">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} دفعة الآن
            </button>
            {campaign.status === 'running' ? (
              <button onClick={onStop} disabled={busy}
                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-60">
                <Square className="w-3.5 h-3.5" /> إيقاف الطابور
              </button>
            ) : (
              <button onClick={onStart} disabled={busy}
                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-60">
                <Play className="w-3.5 h-3.5" /> تشغيل الطابور
              </button>
            )}
          </div>

          {/* تفاصيل ومراحل النشر */}
          <div className="space-y-2 pt-1">
            {campaign.lastTick && (
              <div className="rounded-lg bg-white dark:bg-[#101d2e] border border-[#e2e8f0] dark:border-[#26374d] p-2.5 text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed space-y-1">
                <p><b>آخر دفعة ({formatDateTime(campaign.lastTick.at)}):</b> نجح <b className="text-emerald-600 dark:text-emerald-400">{campaign.lastTick.posted ?? 0}</b> — فشل <b className="text-red-500">{campaign.lastTick.failed ?? 0}</b> — متبقى <b>{campaign.lastTick.remaining ?? 0}</b></p>
                {(campaign.lastTick.reasons || []).map((r: string, i: number) => <p key={i} className="text-amber-600 dark:text-amber-400">• {r}</p>)}
              </div>
            )}

            {(campaign.done || []).length > 0 && (
              <div className="rounded-lg bg-emerald-50/70 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800 p-2.5 text-[11px] space-y-1 text-gray-700 dark:text-gray-200">
                <p className="font-extrabold text-emerald-700 dark:text-emerald-400">✅ اتنشر ({campaign.done.length})</p>
                {campaign.done.slice(-6).reverse().map((d: any, i: number) => (
                  <p key={i} className="flex items-center justify-between gap-2">
                    <span className="truncate">{d.name || d.url}</span>
                    {d.postId && <a href={`https://www.facebook.com/${d.postId}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline shrink-0 font-bold">البوست ↗</a>}
                  </p>
                ))}
                {campaign.done.length > 6 && <p className="text-[10px] text-gray-400 dark:text-gray-500">وكمان {campaign.done.length - 6} جروب قبلهم</p>}
              </div>
            )}

            {(campaign.failed || []).length > 0 && (
              <div className="rounded-lg bg-red-50/70 dark:bg-red-900/15 border border-red-200 dark:border-red-800 p-2.5 text-[11px] space-y-1 text-gray-700 dark:text-gray-200">
                <p className="font-extrabold text-red-600 dark:text-red-400">❌ فشل ({campaign.failed.length}) — مش هيترّوا تاني</p>
                {campaign.failed.slice(-5).reverse().map((f: any, i: number) => (
                  <p key={i} className="truncate">{f.name || f.url} — <span className="text-red-500">{f.error || 'غير معروف'}</span></p>
                ))}
              </div>
            )}

            <div className="rounded-lg bg-blue-50/70 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800 p-2.5 text-[11px] space-y-1 text-gray-700 dark:text-gray-200">
              <p className="font-extrabold text-blue-600 dark:text-blue-400">⏳ في الدور ({campaign.remainingCount ?? 0}) — السقف {campaign.dailyCap || 30} باليوم</p>
              {(campaign.pending || []).slice(0, 5).map((p: any, i: number) => <p key={i} className="truncate">• {p.name || p.url}</p>)}
              {(campaign.remainingCount ?? 0) > 5 && <p className="text-[10px] text-gray-400 dark:text-gray-500">وكمان {campaign.remainingCount - 5} جروب مستنّيين دورهم</p>}
            </div>

            {(campaign.log || []).length > 0 && (
              <div className="rounded-lg bg-white dark:bg-[#101d2e] border border-[#e2e8f0] dark:border-[#26374d] p-2.5 text-[11px] space-y-0.5 text-gray-500 dark:text-gray-400">
                <p className="font-extrabold text-gray-600 dark:text-gray-300 mb-1">سجل الدفعات</p>
                {campaign.log.slice(0, 8).map((l: any, i: number) => (
                  <p key={i} className="truncate">{formatDateTime(l.at)} — نجح {l.posted ?? 0} / فشل {l.failed ?? 0} / متبقى {l.remaining ?? 0}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <button onClick={onStart} disabled={busy}
          className="w-full flex items-center justify-center gap-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 py-3 rounded-xl transition-colors disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} تشغيل الطابور على الجروبات المعلّمة
        </button>
      )}
    </div>
  );
}

// ── صندوق خطوة مرقّم — يخلي الصفحة مقسّمة وواضحة: ① التوكن ② الجروبات ③ النشر ──
function StepBox({ n, title, ok, bare, children }: { n: number; title: string; ok?: boolean; bare?: boolean; children: any }) {
  const num = (
    <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-extrabold shrink-0 ${ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300'}`}>{n}</span>
  );
  const label = (
    <>
      <h3 className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{title}</h3>
      {ok !== undefined && (
        <span className={`ms-auto text-[10px] font-extrabold px-2 py-1 rounded-lg shrink-0 ${ok ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400'}`}>
          {ok ? 'جاهز' : 'مطلوب'}
        </span>
      )}
    </>
  );
  if (bare) {
    return (
      <section className="space-y-3">
        <div className="rounded-2xl border border-[#edf1f4] dark:border-[#1d2c41] px-4 py-3 flex items-center gap-3">{num}{label}</div>
        {children}
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-[#edf1f4] dark:border-[#1d2c41] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-[#fafbfc] dark:bg-[#131f31] border-b border-[#edf1f4] dark:border-[#1d2c41]">{num}{label}</div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

/* أداة سحب الجروبات: كود الإشارة (bookmarklet) + نسخة الكونسول — تشتغل من متصفح الأدمن وهو مسجّل دخول فيسبوك */
const FB_GROUPS_BOOKMARKLET = String.raw`javascript:(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));const M=new Map();const G=()=>{document.querySelectorAll('a[href*="/groups/"]').forEach(a=>{const h=a.getAttribute('href')||a.href||'';const m=h.match(/\/groups\/(\d{5,})(?:\/|$|[?#])/);if(!m)return;const id=m[1];const t=(a.getAttribute('aria-label')||a.textContent||'').replace(/\s+/g,' ').trim().slice(0,120);const p=M.get(id);if(!p||(t&&t.length>p.n.length))M.set(id,{n:t||id});});};const sc=()=>{window.scrollTo(0,document.body.scrollHeight);const el=document.scrollingElement||document.documentElement;if(el)el.scrollTop=el.scrollHeight;const mn=document.querySelector('[role="main"]');if(mn&&mn.scrollHeight>mn.clientHeight+200)mn.scrollTop=mn.scrollHeight;};let last=-1,lastM=-1,same=0;for(let i=0;i<300;i++){G();sc();await S(550);const hh=document.body.scrollHeight+(document.scrollingElement?document.scrollingElement.scrollHeight:0);if(hh===last&&M.size===lastM){if(++same>=5)break;}else{same=0;}last=hh;lastM=M.size;}G();const rows=[...M.entries()];const txt=rows.map(e=>e[1].n+' | https://www.facebook.com/groups/'+e[0]+'/').join('\n');const done=()=>alert('تم تجهيز '+rows.length+' جروب ✓\nافتح لوحة الأدمن > جروبات فيسبوك > الصق في خانة اللصق > إضافة الكل');if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(()=>prompt('انسخ القائمة (Ctrl+C):',txt));}else{prompt('انسخ القائمة (Ctrl+C):',txt);}})();`;
const FB_GROUPS_SNIPPET = FB_GROUPS_BOOKMARKLET.replace(/^javascript:/, '');

function FbGroupsGrabCard({ toast }: { toast: (m: string, t?: any) => void }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [manual, setManual] = useState(false);
  useEffect(() => { if (ref.current) ref.current.setAttribute('href', FB_GROUPS_BOOKMARKLET); }, []);
  const copy = () => copyText(FB_GROUPS_SNIPPET).then(ok => {
    if (ok) toast('اتنسخ ✓ — افتح صفحة جروباتك على فيسبوك ← F12 → Console ← الصق ← Enter', 'success');
    else { setManual(true); toast('المتصفح منع النسخ — انسخ الكود من الصندوق اللي ظهر ↙', 'error'); }
  });
  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/15 p-3 space-y-2">
      <p className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
        <Wand2 className="w-3.5 h-3.5" /> اسحب كل جروباتك (اسم + لينك) مرة واحدة
      </p>
      <div className="rounded-lg bg-white dark:bg-[#101d2e] border border-indigo-100 dark:border-indigo-900 p-2.5 space-y-1">
        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200">الطريقة ١ — الأضمن (كونسول المتصفح):</p>
        <ol className="list-decimal ps-5 text-[11px] text-gray-600 dark:text-gray-300 space-y-0.5 leading-relaxed">
          <li>افتح <a href="https://www.facebook.com/groups/joins/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 underline">صفحة جروباتك على فيسبوك</a> (وأنت مسجّل دخول).</li>
          <li>اضغط <b dir="ltr">F12</b> (أو <b dir="ltr">Ctrl+Shift+I</b>) → تبويب <b dir="ltr">Console</b>.</li>
          <li>لو المتصفح طلب تكتب <b dir="ltr">allow pasting</b> — اكتبها واضغط Enter.</li>
          <li>دوس <b>«انسخ الكود»</b> تحت، الصقه في الكونسول واضغط Enter.</li>
          <li>هيعمل تمرير تلقائي ويجمع كل جروب وينسخهم — ارجع هنا والصقهم في الخانة تحت.</li>
        </ol>
      </div>
      <div className="rounded-lg bg-white dark:bg-[#101d2e] border border-indigo-100 dark:border-indigo-900 p-2.5 space-y-1.5">
        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200">الطريقة ٢ — إشارة (Bookmarklet):</p>
        <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">اسحب الزر الأزرق إلى شريط المفضلة/الإشارات، وبعدين افتح صفحة الجروبات ودوس عليه. (أو دوس عليه هنا عشان ينسخلك الكود وتلصقه في الكونسول)</p>
        <a ref={ref} draggable onClick={e => { e.preventDefault(); copy(); }} title="اسحبني إلى شريط الإشارات — أو دوس عليّا للنسخ"
          className="inline-flex items-center gap-1.5 cursor-grab active:cursor-grabbing select-none bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl">
          <Bookmark className="w-3.5 h-3.5" /> اسحب جروباتي
        </a>
      </div>
      <button type="button" onClick={copy}
        className="flex items-center gap-1.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition-colors">
        <Copy className="w-3.5 h-3.5" /> انسخ الكود
      </button>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">قراءة فقط من متصفحك (مفيش نشر، مفيش خطر على الحساب). لو الإشارة مش شغالة على فيسبوك، استخدم الطريقة ١.</p>
      {manual && (
        <div className="rounded-lg bg-white dark:bg-[#101d2e] border border-amber-300 dark:border-amber-700 p-2.5 space-y-2">
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">المتصفح منع النسخ التلقائي — اضغط جوّه الصندوق ثم <b dir="ltr">Ctrl+A</b> ثم <b dir="ltr">Ctrl+C</b> (أو على الموبايل اضغط مطوّل واختار تحديد الكل ← نسخ):</p>
          <textarea readOnly value={FB_GROUPS_SNIPPET} dir="ltr"
            onFocus={e => e.currentTarget.select()}
            className="w-full h-28 text-[10px] font-mono leading-tight p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/30 text-gray-700 dark:text-gray-300 resize-none" />
          <button type="button" onClick={() => setManual(false)}
            className="text-[11px] font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400">إغلاق</button>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast, unreadCount, notifications: adminNotifs } = useNotifications();
  const [tab, setTab]           = useState<Tab>('dashboard');
  const [page, setPage]         = useState(1);
  const [sideOpen, setSideOpen] = useState(false);
  const [stats, setStats]       = useState<any>(null);
  const [search, setSearch]     = useState('');

  const [users,    setUsers]    = useState<User[]>([]);
  const [trackUsers, setTrackUsers] = useState<User[]>([]);
  const [adStats, setAdStats] = useState<any>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [jobs,     setJobs]     = useState<Job[]>([]);
  const [loads,    setLoads]    = useState<Load[]>([]);
  const [finance,  setFinance]  = useState<FinanceRequest[]>([]);
  const [resets,   setResets]   = useState<PasswordResetRequest[]>([]);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [bannerAds, setBannerAds] = useState<BannerAd[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [finCompanies, setFinCompanies] = useState<FinanceCompany[]>([]);
  const [fbShareTip, setFbShareTip] = useState<{ listing: Listing; url: string } | null>(null);
  const [finCompanyForm, setFinCompanyForm] = useState({ name: '', description: '', rate: '', maxPeriod: '', phone: '', whatsapp: '', stars: 5, isFree: false });
  const [editFinId, setEditFinId] = useState<string | null>(null);
  const [showExhForm, setShowExhForm] = useState(false);
  const [exhForm, setExhForm] = useState({ name: '', description: '', logo: '', coverImage: '', governorate: '', city: '', contactPhone: '', whatsapp: '', plan: 'basic' as const, category: 'general' as 'general' | 'import', facebook: '', instagram: '', website: '', workingHours: '', googleMapsUrl: '' });
  const [editExhId, setEditExhId] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [aiScanLoading, setAiScanLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ stats?: any; recent?: any[]; commonMistakes?: any[] } | null>(null);

  // استوديو الفيديو: دمج إعلانات المعارض مع الإعلانات العادية في قائمة واحدة
  const videoAds = useMemo<Listing[]>(() => [
    ...listings,
    ...exhibitions.map(ex => {
      const imgs = [
        ex.coverImage,
        ex.logo,
        ...(ex.products || []).flatMap(p => (p.images && p.images.length ? p.images : (p.image ? [p.image] : []))),
      ].filter(Boolean) as string[];
      return {
        id: `exh:${ex.id}`,
        title: ex.name,
        images: imgs,
        governorate: ex.governorate,
        listingType: 'sale',
        price: undefined,
        priceType: 'call',
        contactPhone: ex.contactPhone,
        whatsappPhone: ex.whatsapp,
        advertiserName: ex.name,
        status: ex.status === 'active' ? 'active' : 'inactive',
      } as unknown as Listing;
    }),
  ], [listings, exhibitions]);

  // fix-ad modal: اقتراح إصلاحات عملية لإعلان يحتاج مراجعة
  const [fixModal, setFixModal] = useState<{ listing: Listing; fixes: { field: string; value: string | number | boolean; reason: string; fieldLabel?: string }[]; loading: boolean; applying: boolean } | null>(null);

  // reset password modal
  const [resetModal, setResetModal] = useState<{ email: string; phone: string } | null>(null);
  const [contactModal, setContactModal] = useState<{ id: string; name: string; phone: string; facebook: string; message: string; waLink?: string; msLink?: string; loading: boolean } | null>(null)
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoErr, setPromoErr] = useState('');
  const [promoVariants, setPromoVariants] = useState<{ label: string; text: string }[]>([]);

  // النشر الموحّد: صفحة + جروبات + إشعار المعلن (أداة النشر بالضغطة الواحدة)
  type FbGroup = { id: string; url: string; name: string; enabled?: boolean; tag?: string; createdAt?: number; lastPostedAt?: string };
  const [publishModal, setPublishModal] = useState<{ listing: Listing } | null>(null);
  const [fbGroups, setFbGroups] = useState<FbGroup[]>([]);
const [fbGroupsVisible, setFbGroupsVisible] = useState(50);
const [fbCoolingHours, setFbCoolingHours] = useState(() => { try { return Number(localStorage.getItem('fbCoolingHours')) || 20; } catch { return 20; } });
  const [pubSel, setPubSel] = useState<Record<string, boolean>>({});
  const [pubBusy, setPubBusy] = useState(false);
  const [pubResult, setPubResult] = useState<null | {
    success: boolean;
    listing?: { id: string; url: string; title: string };
    page?: any;
    groups?: any[];
    reasons?: string[];
    source?: string;
    sourceUsername?: string | null;
    sourceUrl?: string | null;
    contact?: { name: string; phone: string; facebook: string; message: string; waLink?: string | null; msLink?: string | null; needPhone?: boolean; needMessenger?: boolean };
    error?: string | null;
    message?: string;
  }>(null);
  const [pubMsg, setPubMsg] = useState('');
  const [pubPhone, setPubPhone] = useState('');
  const [pubFacebook, setPubFacebook] = useState('');
  const [pubGroupLink, setPubGroupLink] = useState('');
  const [pubGroupBusy, setPubGroupBusy] = useState(false);
  const [pubGroupMsg, setPubGroupMsg] = useState('');
  const [pubImportBusy, setPubImportBusy] = useState(false);
  const [pubImportTok, setPubImportTok] = useState('');
  const [pubFetchErr, setPubFetchErr] = useState('');
  const [pubErr, setPubErr] = useState('');
  const [pubLimits, setPubLimits] = useState<{ perRun: number; perDay: number }>({ perRun: 3, perDay: 15 });
  const [pubSource, setPubSource] = useState<{ source: string; username: string | null }>({ source: 'page', username: null });
  const [pubDiag, setPubDiag] = useState<any>(null);
  const [pubDiagBusy, setPubDiagBusy] = useState(false);
  const [pubCampaign, setPubCampaign] = useState<any>(null);
  const [pubCampaignBusy, setPubCampaignBusy] = useState(false);
  const [fbListId, setFbListId] = useState('');
  const [fbConn, setFbConn] = useState<any>(null);
  const [fbConnBusy, setFbConnBusy] = useState(false);
  const [fbConnMsg, setFbConnMsg] = useState('');
  const [fbTok, setFbTok] = useState('');
  const [tokOpen, setTokOpen] = useState(false);
  const [manualText, setManualText] = useState<any>(null);
  const [manualOpened, setManualOpened] = useState<Record<string, boolean>>({});
  const [manualDone, setManualDone] = useState<Record<string, boolean>>({});
  const [manualBusyId, setManualBusyId] = useState('');
  const [manualQueueIds, setManualQueueIds] = useState<string[]>([]);
  const [manualIdx, setManualIdx] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // send notification
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifUrl, setNotifUrl] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');

  useEffect(() => {
    if (!user || user.type !== 'admin') { navigate('/'); return; }
    loadStats();
  }, [user]);

  useEffect(() => { setPage(1); loadTab(); }, [tab]);

  useEffect(() => {
    const raw = searchParams.get('tab');
    const p = (raw === 'fbgroups' ? 'fbpublish' : raw) as Tab | null;
    if (p && nav.some(n => n.id === p)) setTab(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // نتيجة ربط فيسبوك بعد العودة من OAuth (?fb=ok|fail|e)
  useEffect(() => {
    const fb = searchParams.get('fb');
    if (!fb) return;
    if (fb === 'ok') toast('تم ربط فيسبوك بنجاح ✓ التوكن يعيش 60 يوم', 'success');
    else if (fb === 'fail') toast('فشل ربط فيسبوك — افتح تبويب «جروبات فيسبوك» وشوف الرسالة', 'error');
    else if (fb === 'e') toast('فيسبوك رفض الطلب', 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}?tab=${tab}`);
  }, [tab]);

  const loadStats = async () => {
    try { setStats(await getAdminStats()); } catch {}
  };

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === 'tracking')  setTrackUsers(await usersService.getSignupTracking());
      if (tab === 'ad-stats')  setAdStats(await adAnalyticsService.getOverview());
      if (tab === 'users')    setUsers(await usersService.getAll());
      if (tab === 'listings') setListings(await listingsService.getAll());
      if (tab === 'jobs')     setJobs(await jobsService.getAll());
      if (tab === 'loads')    setLoads(await loadsService.getAll());
      if (tab === 'finance')  setFinance(await financeService.getAll());
      if (tab === 'resets')   setResets(await passwordResetsService.getAll());
      if (tab === 'exhibitions') setExhibitions(await exhibitionsService.getAll());
      if (tab === 'exhibition-plans') setExhibitions(await exhibitionsService.getAll());
      if (tab === 'ai-review')    { setListings(await listingsService.getAll()); loadAIFeedback(); }
      if (tab === 'bannerads')   setBannerAds(await bannerAdsService.getAll());
      if (tab === 'payments')    setPayments(await paymentsService.getAll());
      if (tab === 'fin-companies') setFinCompanies(await financeCompaniesService.getAll());
      // fbgroups tab removed per user request
      if (tab === 'video')     { setListings(await listingsService.getAll()); setExhibitions(await exhibitionsService.getAll().catch(() => [])); }
    } catch {}
    setLoading(false);
  };

  const recordAIFeedback = async (docId: string, decision: 'approved' | 'rejected') => {
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      await fetch(`${getApiUrl()}/admin?action=ai-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ docId, collection: 'listings', decision }),
      });
    } catch {}
  };
  const loadAIFeedback = async () => {
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      const res = await fetch(`${getApiUrl()}/admin?action=ai-feedback-stats`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success) setAiFeedback({ stats: data.stats, recent: data.recent || [], commonMistakes: data.commonMistakes || [] });
    } catch {}
  };
  const approveListing = async (id: string) => {
    await recordAIFeedback(id, 'approved');
    await listingsService.update(id, { status: 'active', aiModeration: null } as any);
    setListings(p => p.map(l => l.id === id ? { ...l, status: 'active', aiModeration: null as any } : l));
    setStats((s: any) => s ? { ...s, pendingListings: Math.max(0,(s.pendingListings||0)-1), activeListings:(s.activeListings||0)+1 } : s);
    const listing = listings.find(l => l.id === id);
    logAdminAction('listing_approved', id);
    loadAIFeedback();
    if (listing) {
      await notificationsService.notifyUserListingApproved(listing.userId, { id: listing.id, title: listing.title });
    }
    toast("تمت الموافقة على الإعلان وإرسال إشعار للمستخدم", "success");
  };
  const rejectListing = async (id: string) => {
    await recordAIFeedback(id, 'rejected');
    await listingsService.update(id, { status: 'rejected', aiModeration: null } as any);
    setListings(p => p.map(l => l.id === id ? { ...l, status: 'rejected', aiModeration: null as any } : l));
    const listing = listings.find(l => l.id === id);
    logAdminAction('listing_rejected', id);
    loadAIFeedback();
    if (listing) {
      await notificationsService.notifyUserListingRejected(listing.userId, { id: listing.id, title: listing.title });
    }
    toast("تم رفض الإعلان وإرسال إشعار للمستخدم", "error");
  };
  const approveJob = async (id: string) => {
    await jobsService.update(id, { status: 'active' } as any);
    setJobs(p => p.map(j => j.id === id ? { ...j, status: 'active' } as any : j));
    const job = jobs.find(j => j.id === id);
    logAdminAction('job_approved', id);
    if (job) {
      await notificationsService.notifyUserJobApproved(job.userId, { id: job.id, title: job.title });
    }
    toast("تمت الموافقة على الوظيفة وإرسال إشعار للمستخدم", "success");
  };
  const rejectJob = async (id: string) => {
    await jobsService.update(id, { status: 'rejected' } as any);
    setJobs(p => p.map(j => j.id === id ? { ...j, status: 'rejected' } as any : j));
    const job = jobs.find(j => j.id === id);
    logAdminAction('job_rejected', id);
    if (job) {
      await notificationsService.notifyUserJobRejected(job.userId, { id: job.id, title: job.title });
    }
    toast("تم رفض الوظيفة وإرسال إشعار للمستخدم", "error");
  };
  // ── fix-ad: اقتراح إصلاحات عملية لإعلان مرفوض ─────────────────
  const proposeFix = async (listing: Listing) => {
    const m = (listing as any).aiModeration;
    setFixModal({ listing, fixes: [], loading: true, applying: false });
    try {
      const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : '';
      const res = await fetch(`${getApiUrl()}/ai/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          action: 'fix-ad',
          title: listing.title, description: listing.description, price: listing.price,
          category: listing.category, subcategory: listing.subcategory,
          governorate: listing.governorate, location: listing.location || '',
          brand: listing.brand || '', model: listing.model || '', year: String(listing.year || ''),
          condition: listing.condition || 'used', contactPhone: (listing as any).contactPhone || '',
          userPhone: (listing as any).userPhone || '', advertiserName: (listing as any).advertiserName || '',
          reasons: m?.reasons || [],
        }),
      });
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.fixes)) throw new Error(data.message || 'تعذر توليد الإصلاحات');
      const FIELD_LABELS: Record<string, string> = {
        title: 'العنوان', description: 'الوصف', price: 'السعر', currency: 'العملة',
        governorate: 'المحافظة', location: 'المكان', brand: 'الماركة', model: 'الموديل',
        year: 'سنة الصنع', condition: 'الحالة', contactPhone: 'رقم التواصل', advertiserName: 'اسم المعلن',
        category: 'الفئة', subcategory: 'التصنيف الفرعي',
      };
      setFixModal({ listing, fixes: data.fixes.slice(0, 6).map((f: any) => ({ ...f, fieldLabel: FIELD_LABELS[f.field] || f.field })), loading: false, applying: false });
    } catch (e: any) {
      toast(e?.message || 'تعذر توليد الإصلاحات', 'error');
      setFixModal(null);
    }
  };

  const applyFixesAndEdit = async () => {
    if (!fixModal) return;
    const { listing, fixes } = fixModal;
    setFixModal(f => f ? { ...f, applying: true } : null);
    try {
      const updates: Record<string, any> = {};
      for (const fix of fixes) {
        if (fix.field === 'price') updates.price = Number(fix.value) || 0;
        else if (fix.field === 'contactPhone') updates.contactPhone = String(fix.value);
        else if (fix.field === 'description') updates.description = String(fix.value);
        else if (fix.field === 'title') updates.title = String(fix.value);
        else if (fix.field === 'category') updates.category = String(fix.value);
        else if (fix.field === 'subcategory') updates.subcategory = String(fix.value);
        else if (fix.field === 'governorate') updates.governorate = String(fix.value);
        else if (fix.field === 'brand') updates.brand = String(fix.value);
        else if (fix.field === 'model') updates.model = String(fix.value);
        else if (fix.field === 'year') updates.year = Number(fix.value) || listing.year;
        else if (fix.field === 'condition') updates.condition = String(fix.value);
        else if (fix.field === 'advertiserName') updates.advertiserName = String(fix.value);
      }
      if (Object.keys(updates).length) {
        await listingsService.update(listing.id, updates as any);
        setListings(p => p.map(l => l.id === listing.id ? { ...l, ...updates } : l));
        toast(`تم تطبيق ${Object.keys(updates).length} إصلاحات — يُفتح تعديل الإعلان الآن`, 'success');
      }
      navigate(`/listing/${listing.id}/edit`);
    } catch (e: any) {
      toast(e?.message || 'تعذر تطبيق الإصلاحات', 'error');
      setFixModal(f => f ? { ...f, applying: false } : null);
    }
  };

  const requestContact = async (id: string, facebook: string, phone: string, save = false, name = '', messageOverride = '') => {
    setContactModal(m => ({ id: m?.id ?? id, name: m?.name ?? name, phone: m?.phone ?? phone, facebook: m?.facebook ?? facebook, message: m?.message ?? 'جارٍ تجهيز الرسالة...', waLink: m?.waLink, msLink: m?.msLink, loading: true }));
    try {
      const api = `${getApiUrl()}/contact-advertiser`;
      const body: Record<string, unknown> = { listingId: id };
      if (facebook !== undefined && facebook !== null) body.facebook = facebook;
      if (phone !== undefined && phone !== null) body.phone = phone;
      if (name !== undefined && name !== null && name !== '') body.name = name;
      if (save) body.save = true;
      if (messageOverride) body.message = messageOverride;
      const res = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await firebaseAuth.currentUser?.getIdToken()}`,
        },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      const data = (() => { try { return JSON.parse(raw); } catch { return null; } })();
      if (res.ok && data && data.success && data.advertiser) {
        setContactModal(m => m ? {
          ...m,
          name: data.advertiser.name || m.name,
          phone: data.advertiser.phone || '',
          facebook: data.advertiser.facebook || '',
          message: data.advertiser.message,
          waLink: data.advertiser.waLink,
          msLink: data.advertiser.msLink,
          loading: false,
        } : m);
      } else {
        const msg = data?.message || (res.ok ? 'فشل جلب بيانات المعلن' : `الخادم رد بـ HTTP ${res.status}`);
        setContactModal(m => m ? { ...m, message: msg, loading: false } : m);
      }
    } catch {
      setContactModal(m => m ? { ...m, message: 'تعذر الوصول للسيرفر (تحقق من اتصالك أو أعد المحاولة)', loading: false } : m);
    }
  };
  const openContactModal = async (id: string) => {
    const listing = listings.find(l => l.id === id);
    setContactModal({ id, name: listing?.userName || '', phone: listing?.contactPhone || listing?.userPhone || '', facebook: listing?.facebook || '', message: 'جارٍ تجهيز الرسالة...', loading: true });
    await requestContact(id, listing?.facebook || '', listing?.contactPhone || listing?.userPhone || '', false);
  };
  const genPromo = async () => {
    const m = contactModal;
    if (!m || promoBusy) return;
    setPromoBusy(true);
    setPromoErr('');
    try {
      const listing = listings.find(l => l.id === m.id);
      const body = {
        action: 'promo-draft',
        name: m.name || listing?.userName || '',
        listing: {
          title: listing?.title || '',
          brand: listing?.brand || '',
          model: listing?.model || '',
          year: listing?.year || '',
          governorate: listing?.governorate || '',
          price: typeof listing?.price === 'number' && listing.price > 0 ? listing.price : null,
        },
      };
      const res = await fetch(`${getApiUrl()}/ai/index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await firebaseAuth.currentUser?.getIdToken()}`,
        },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      const data = (() => { try { return JSON.parse(raw); } catch { return null; } })();
      if (!res.ok || !data?.ok || !Array.isArray(data.variants) || !data.variants.length) {
        setPromoErr(data?.message || 'الذكاء ما ولّدش رسالة — جرّب تاني');
        return;
      }
      const variants = (data.variants as { label: string; text: string }[]).map(v => ({ label: v.label, text: cleanMsg(v.text) }));
      setPromoVariants(variants);
      const pick = variants.find(v => v.label === data.recommended) || variants[0];
      setContactModal(mm => mm ? { ...mm, message: pick.text } : mm);
      toast('✨ اتعملت رسالة دعاية ذكية جديدة', 'success');
    } catch {
      setPromoErr('تعذر الوصول للسيرفر — جرّب تاني');
    } finally {
      setPromoBusy(false);
    }
  };

  // ── النشر الموحّد (صفحة + جروبات + إشعار المعلن) ──────────────────
  const loadFbGroupsAdmin = async () => {
    setPubFetchErr('');
    try {
      const raw = localStorage.getItem('fbGroups_local');
      if (raw) {
        const groups = JSON.parse(raw) as FbGroup[];
        setFbGroups(groups);
        setFbGroupsVisible(50);
        const sel: Record<string, boolean> = {};
        groups.forEach((g: FbGroup) => { sel[g.id] = true; });
        setPubSel(sel);
      }
    } catch {}
    if (firebaseAuth.currentUser) {
      try {
        const res = await fetch(getApiUrl() + '/whatsapp-notify?action=fb-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await firebaseAuth.currentUser.getIdToken() },
          body: JSON.stringify({ sub: 'list' }),
        });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.groups)) {
          setFbGroups(data.groups as FbGroup[]);
          setFbGroupsVisible(50);
          const sel: Record<string, boolean> = {};
          (data.groups as FbGroup[]).forEach((g: FbGroup) => { sel[g.id] = true; });
          setPubSel(sel);
          if (data.limits) setPubLimits(data.limits);
          setPubSource({ source: data.source || 'page', username: data.sourceUsername || null });
          try { localStorage.setItem('fbGroups_local', JSON.stringify(data.groups)); } catch {}
        } else if (!data?.success && !localStorage.getItem('fbGroups_local')) {
          setPubFetchErr((data as any)?.message || 'تعذّر تحميل الجروبات');
        }
      } catch (e) {
        if (!localStorage.getItem('fbGroups_local')) {
          setPubFetchErr('تعذر الاتصال بالسيرفر: ' + ((e as any)?.message || e));
        }
      }
    } else {
      if (!localStorage.getItem('fbGroups_local')) {
        setPubFetchErr('وضع محلي — سجّل دخولك كأدمن للمزامنة مع الخادم. أو أضف جروبات يدويًا (رفع ملف).');
      } else {
        setPubFetchErr('وضع محلي (بدون تسجيل دخول) — الجروبات من localStorage.');
      }
    }
  };

  const runFbDiag = async () => {
    setPubDiagBusy(true);
    setPubDiag(null);
    try {
      if (!firebaseAuth.currentUser) { setPubDiag({ error: 'سجّل دخولك كأدمن أولاً' }); return; }
      const res = await fetch(`${getApiUrl()}/whatsapp-notify?action=fb-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await firebaseAuth.currentUser.getIdToken()}` },
        body: JSON.stringify({ sub: 'diag' }),
      });
      const data = await res.json().catch(() => null);
      setPubDiag(data?.diag || { error: data?.message || 'تعذر التشخيص' });
    } catch {
      setPubDiag({ error: 'تعذر الوصول للسيرفر — تحقق من اتصالك' });
    } finally {
      setPubDiagBusy(false);
    }
  };

  // ── ربط فيسبوك (التوكن) ────────────────────────────────────────────
  const fbConnectApi = async (sub: string, extra: Record<string, any> = {}) => {
    if (!firebaseAuth.currentUser) { toast('سجّل دخولك كأدمن أولاً', 'error'); return null; }
    try {
      const res = await fetch(`${getApiUrl()}/whatsapp-notify?action=fb-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await firebaseAuth.currentUser.getIdToken()}` },
        body: JSON.stringify({ sub, ...extra }),
      });
      return await res.json().catch(() => null);
    } catch { return null; }
  };

  const loadFbConn = async () => {
    const d = await fbConnectApi('status');
    if (d?.success) setFbConn(d);
  };

  const startFbOAuth = () => {
    window.location.href = `${getApiUrl()}/whatsapp-notify?action=fb-connect`;
  };

  const saveFbConnToken = async () => {
    const t = fbTok.trim();
    if (!t) { setFbConnMsg('الصق التوكن الأول'); return; }
    setFbConnBusy(true); setFbConnMsg('');
    try {
      const d = await fbConnectApi('save-token', { accessToken: t });
      setFbConnMsg(d?.message || (d?.success ? 'تم ✓' : 'تعذر الحفظ'));
      if (d?.success) { setFbTok(''); setFbConnMsg(''); setTokOpen(false); toast(d.message, 'success'); loadFbConn(); loadCampaign(); }
    } finally { setFbConnBusy(false); }
  };

  const disconnectFb = async () => {
    if (!confirm('تفصل فيسبوك؟ هيرجع يستخدم توكن Vercel القديم (لو موجود).')) return;
    setFbConnBusy(true);
    try {
      const d = await fbConnectApi('disconnect');
      if (d?.success) { toast(d.message, 'success'); loadFbConn(); }
    } finally { setFbConnBusy(false); }
  };

  const openPublishModal = (listing: Listing) => {
    setPublishModal({ listing });
    setPubResult(null);
    setPubDiag(null);
    setPubMsg('');
    setPubPhone('');
    setPubFacebook('');
    setPubGroupLink('');
    setPubGroupMsg('');
    setPubCampaign(null);
    loadFbGroupsAdmin();
    loadCampaign();
  };

  const saveFbGroupAdmin = async () => {
    const urls = String(pubGroupLink || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!urls.length) { setPubGroupMsg('الصق لينك جروب واحد أو أكتر — أو كوبي قائمة كاملة وسيبني أستخرج كل اللينكات'); return; }
    setPubGroupBusy(true);
    setPubGroupMsg('');
    try {
      // Parse URLs
      const parsed = urls.map(u => {
        const m = u.match(/\/groups\/(\d{5,})/);
        return m ? { id: m[1], url: u, name: u.split('/').filter(Boolean).pop() || m[1], enabled: true, createdAt: Date.now() } : null;
      }).filter(Boolean) as FbGroup[];
      
      if (!parsed.length) { setPubGroupMsg('مفيش لينك جروب فيسبوك اتلقط'); return; }
      
      // Local mode (no Firebase Auth)
      if (!firebaseAuth.currentUser) {
        const existing = fbGroups;
        const existingIds = new Set(existing.map(g => g.id));
        const added: FbGroup[] = [];
        const skipped: string[] = [];
        parsed.forEach(g => {
          if (existingIds.has(g.id)) { skipped.push(g.id); }
          else { existing.push(g); added.push(g); }
        });
        setFbGroups([...existing]);
        setFbGroupsVisible(50);
        const sel: Record<string, boolean> = {};
        existing.forEach(g => { sel[g.id] = true; });
        setPubSel(sel);
        try { localStorage.setItem('fbGroups_local', JSON.stringify(existing)); } catch {}
        setPubGroupMsg(`اتضاف ${added.length} جروب ✓ (محلي) — موجود قبل كده: ${skipped.length}`);
        setPubGroupLink('');
        return;
      }
      
      // Server mode (Firebase Auth)
      const res = await fetch(`${getApiUrl()}/whatsapp-notify?action=fb-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await firebaseAuth.currentUser.getIdToken()}` },
        body: JSON.stringify({ sub: 'save', urls }),
      });
      const data = await res.json();
      if (data && data.success) {
        setPubGroupMsg(data.message || 'اتضافوا ✓');
        if (Array.isArray(data.groups)) {
          setFbGroups(data.groups as FbGroup[]);
          setFbGroupsVisible(50);
          const sel: Record<string, boolean> = {};
          (data.groups as FbGroup[]).forEach((g: FbGroup) => { sel[g.id] = true; });
          setPubSel(sel);
          try { localStorage.setItem('fbGroups_local', JSON.stringify(data.groups)); } catch {}
        }
        setPubGroupLink('');
      } else {
        setPubGroupMsg(data?.message || 'تعذر الإضافة');
      }
    } catch {
      setPubGroupMsg('تعذر الوصول للسيرفر');
    } finally {
      setPubGroupBusy(false);
    }
  };

  // استيراد جروبات من ملف نصي (.txt/.csv) — سطر لكل جروب (لينك أو "اسم<TAB>لينك")
  const importFbGroupsFromFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (!lines.length) { setPubGroupMsg('الملف فارغ'); return; }
      setPubGroupLink(prev => (prev ? prev.trim() + '\n' : '') + lines.join('\n'));
      setPubGroupMsg(`تم قراءة ${lines.length} سطر من الملف — اضغط «إضافة الكل» للحفظ`);
    } catch { setPubGroupMsg('تعذر قراءة الملف'); }
  };

  // استيراد كل جروبات الحساب من فيسبوك مرة واحدة (قراءة فقط — صفر خطر حظر)
  const importMyGroups = async () => {
    if (pubImportBusy) return;
    setPubImportBusy(true);
    setPubGroupMsg('');
    try {
      if (!firebaseAuth.currentUser) { setPubGroupMsg('سجّل دخولك كأدمن أولاً'); return; }
      const res = await fetch(`${getApiUrl()}/whatsapp-notify?action=fb-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await firebaseAuth.currentUser.getIdToken()}` },
        body: JSON.stringify({ sub: 'import-groups', token: String(pubImportTok || '').trim() }),
      });
      const data = await res.json();
      if (data && data.success) {
        setPubGroupMsg(data.message || 'اتجابوا ✓');
        toast(data.message || 'اتجابوا ✓', 'success');
        if (Array.isArray(data.groups)) {
          setFbGroups(data.groups as FbGroup[]);
          const sel: Record<string, boolean> = {};
          (data.groups as FbGroup[]).forEach((g: FbGroup) => { sel[g.id] = true; });
          setPubSel(sel);
        }
      } else {
        setPubGroupMsg(data?.message || 'تعذر الاستيراد');
        toast(data?.message || 'تعذر الاستيراد', 'error');
      }
    } catch {
      setPubGroupMsg('تعذر الوصول للسيرفر');
    } finally {
      setPubImportBusy(false);
    }
  };

  const deleteFbGroupAdmin = async (id: string) => {
    try {
      setFbGroups(p => { const n = p.filter(g => g.id !== id); try { localStorage.setItem('fbGroups_local', JSON.stringify(n)); } catch {} return n; });
      setPubSel(p => { const s = { ...p }; delete s[id]; return s; });
      if (!firebaseAuth.currentUser) return;
      const res = await fetch(`${getApiUrl()}/whatsapp-notify?action=fb-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await firebaseAuth.currentUser.getIdToken()}` },
        body: JSON.stringify({ sub: 'delete', id }),
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.groups)) {
        setFbGroups(data.groups as FbGroup[]);
        setFbGroupsVisible(50);
        const sel: Record<string, boolean> = {};
        (data.groups as FbGroup[]).forEach((g: FbGroup) => { sel[g.id] = true; });
        setPubSel(sel);
      }
    } catch {}
  };

  const toggleFbGroupAdmin = async (id: string) => {
    const cur = fbGroups.find(g => g.id === id);
    const next = !(cur?.enabled === false);
    setFbGroups(p => { const n = p.map(g => g.id === id ? { ...g, enabled: next } : g); try { localStorage.setItem('fbGroups_local', JSON.stringify(n)); } catch {} return n; });
    try {
      if (!firebaseAuth.currentUser) return;
      const res = await fetch(`${getApiUrl()}/whatsapp-notify?action=fb-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await firebaseAuth.currentUser.getIdToken()}` },
        body: JSON.stringify({ sub: 'toggle', id }),
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.groups)) setFbGroups(data.groups as FbGroup[]);
      else if (!data?.success) toast(data?.message || 'تعذر تغيير الحالة', 'error');
    } catch { toast('تعذر الوصول للسيرفر', 'error'); }

};

  const runPublishAd = async () => {
    const l = publishModal?.listing;
    if (!l || pubBusy) return;
    if (!firebaseAuth.currentUser) { toast('سجّل دخولك كأدمن أولاً', 'error'); return; }
    setPubBusy(true);
    setPubErr('');
    try {
      const groupIds = Object.keys(pubSel).filter(id => pubSel[id]);
      const res = await fetch(`${getApiUrl()}/whatsapp-notify?action=publish-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await firebaseAuth.currentUser.getIdToken()}` },
        body: JSON.stringify({ listingId: l.id, force: false, groupIds }),
      });
      const raw = await res.text();
      const data = (() => { try { return JSON.parse(raw); } catch { return null; } })();
      if (res.ok && data && data.success) {
        setPubResult(data);
        setPubMsg(data.contact?.message || '');
        setPubPhone(data.contact?.phone || '');
        setPubFacebook(data.contact?.facebook || '');
        // شيل العلّايمة من اللي اتنشروا عشان الدفعة الجاية تكمل من غير تكرار
        setPubSel(prev => {
          const s = { ...prev };
          (data.groups || []).forEach((g: any) => { if (g.ok === true) delete s[g.id]; });
          return s;
        });
        logAdminAction('listing_publish_ad', `${l.id} — ${l.title}`);
        setListings(await listingsService.getAll().catch(() => []));
        const groupCount = (data.groups || []).filter((g: any) => g.ok).length;
        const pageErr = data.page && !data.page.ok ? String(data.page.error || data.error || '').slice(0, 110) : '';
        const why = !(data.groups || []).length && (data.reasons || []).length ? ` — ${String(data.reasons[0]).slice(0, 90)}` : '';
        toast(`تم النشر: الصفحة ${data.page?.ok ? '✓' : '✗'}${pageErr ? ' — ' + pageErr : ''} + جروبات ${groupCount}/${(data.groups || []).length}${why}`, pageErr ? 'error' : 'success');
      } else {
        setPubErr(data?.message || `الخادم رد بـ HTTP ${res.status}`);
      }
    } catch {
      setPubErr('تعذر الوصول للسيرفر — تحقق من اتصالك');
    } finally {
      setPubBusy(false);
    }
  };

  // ── النشر التلقائي على الجروبات (طابور يشتغل لوحده) ──────────────────
  const fbCampaignApi = async (sub: string, extra: Record<string, any> = {}) => {
    if (!firebaseAuth.currentUser) { toast('سجّل دخولك كأدمن أولاً', 'error'); return null; }
    try {
      const res = await fetch(`${getApiUrl()}/whatsapp-notify?action=fb-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await firebaseAuth.currentUser.getIdToken()}` },
        body: JSON.stringify({ sub, ...extra }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) { toast('تعذر الوصول للسيرفر', 'error'); return null; }
      return data;
    } catch {
      toast('تعذر الوصول للسيرفر', 'error');
      return null;
    }
  };

  const loadCampaign = async () => {
    const data = await fbCampaignApi('campaign-status');
    if (data?.success) setPubCampaign(data.campaign || null);
  };

  const startCampaign = async (listingId?: string) => {
    const targetId = listingId || publishModal?.listing?.id;
    if (!targetId || pubCampaignBusy) return;
    if (!confirm('هيبدأ نشر تلقائي على الجروبات المعلّمة على دفعات آمنة (مش كلهم مرة واحدة) لحد ما يخلّص. تأكيد؟')) return;
    setPubCampaignBusy(true);
    try {
      const groupIds = Object.keys(pubSel).filter(id => pubSel[id]);
      const data = await fbCampaignApi('campaign-start', { listingId: targetId, groupIds });
      if (data?.success) { setPubCampaign(data.campaign); toast(data.message || 'الطابور بدأ', 'success'); }
      else toast(data?.message || 'تعذر بدء الطابور', 'error');
    } finally { setPubCampaignBusy(false); }
  };

  const stopCampaign = async () => {
    if (pubCampaignBusy) return;
    setPubCampaignBusy(true);
    try {
      const data = await fbCampaignApi('campaign-stop');
      if (data?.success) { setPubCampaign(data.campaign || null); toast('تم إيقاف الطابور', 'success'); }
    } finally { setPubCampaignBusy(false); }
  };

  const resumeCampaign = async () => {
    if (pubCampaignBusy) return;
    setPubCampaignBusy(true);
    try {
      const data = await fbCampaignApi('campaign-resume');
      if (data?.success) { setPubCampaign(data.campaign || null); toast(data.message || 'الطابور استأنف', 'success'); }
      else toast(data?.message || 'تعذر الاستئناف', 'error');
    } finally { setPubCampaignBusy(false); }
  };

  const tickCampaign = async () => {
    if (pubCampaignBusy) return;
    setPubCampaignBusy(true);
    try {
      const data = await fbCampaignApi('campaign-tick');
      if (data?.success) {
        setPubCampaign(data.campaign || null);
        const r = data.result || {};
        const reason = (r.reasons && r.reasons[0]) ? ` — ${r.reasons[0]}` : '';
        toast(`الدفعة: نشر ${r.posted || 0} + فشل ${r.failed || 0} — المتبقي ${r.remaining ?? '؟'}${reason}`, r.posted ? 'success' : 'error');
      }
    } finally { setPubCampaignBusy(false); }
  };

  // النشر اليدوي بدون توكن: نسخ نص البوست + فتح الجروب + تسجيل النشر
  const loadManualText = async () => {
    if (!fbListId) { toast('اختار الإعلان الأول', 'error'); return null; }
    const data = await fbCampaignApi('post-text', { listingId: fbListId });
    if (data?.success) { setManualText(data); return data; }
    toast(data?.message || 'تعذر تجهيز نص البوست', 'error');
    return null;
  };

  const copyAndOpenGroup = async (g: FbGroup) => {
    if (!fbListId) { toast('اختار الإعلان الأول', 'error'); return; }
    setManualBusyId(String(g.id));
    // فتح التاب فورًا (قبل أي await) عشان ميتحجبش من مانع الإعلانات المنبثقة
    const target = /^\d+$/.test(String(g.id)) ? `https://www.facebook.com/groups/${g.id}` : String(g.url || '');
    let win: Window | null = null;
    try { win = window.open(target, '_blank', 'noopener'); } catch { /* ignore */ }
    try {
      let t = manualText && manualText.id === fbListId ? manualText : null;
      if (!t) t = await loadManualText();
      if (!t) return;
      let ok = await copyText(t.text);
      if (!ok) {
        const ta = document.createElement('textarea');
        ta.value = t.text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        ta.remove();
      }
      if (!ok) {
        // المتصفح مانع الحافظة (متجر/إنب-app) — نعرض النص للنسخ اليدوي
        try { window.prompt('انسخ نص البوست (اضغط Ctrl+C أو انسخ الكل):', t.text); } catch { /* ignore */ }
      }
      if (win) { try { win.focus(); } catch { /* ignore */ } }
      setManualOpened(s => ({ ...s, [String(g.id)]: true }));
      toast(ok ? 'اتنسخ ✓ — الصقه في الجروب ودوس نشر' : 'الجروب اتفنح — انسخ النص الظاهر والصقه', ok ? 'success' : 'error');
    } finally { setManualBusyId(''); }
  };

  const markGroupPostedById = async (id: string) => {
    setManualBusyId(id);
    try {
      const data = await fbCampaignApi('mark', { id });
      if (data?.success) {
        setManualDone(s => ({ ...s, [id]: true }));
        if (Array.isArray(data.groups)) setFbGroups(data.groups as FbGroup[]);
        toast(data.message || 'اتسجل ✓', 'success');
        return true;
      }
      toast(data?.message || 'تعذر التسجيل', 'error');
      return false;
    } finally { setManualBusyId(''); }
  };

  const markGroupPosted = async (g: FbGroup) => { await markGroupPostedById(String(g.id)); };

  // وضع الطابور: انسخ+افتح الجروب بالترتيب، و«نشرت — التالي» تنسخ وتفتح اللي بعده تلقائيًا
  const startManualQueue = () => {
    if (!fbListId) { toast('اختار الإعلان الأول', 'error'); return; }
    const picked = fbGroups
      .filter(g => pubSel[g.id] && g.enabled !== false && !groupCooling(g));
    if (!picked.length) { toast('مفيش جروبات صالحة للنشر — يمكن كلها في هدنة', 'error'); return; }
    setManualQueueIds(picked.map(g => String(g.id)));
    setManualIdx(0);
    copyAndOpenGroup(picked[0]);
  };

  const stopManualQueue = () => { setManualQueueIds([]); setManualIdx(0); };

  const skipManualQueue = () => { void manualQueueStep(false); };

  const manualQueueDoneNext = () => { void manualQueueStep(true); };

  const manualQueueStep = async (markCurrent: boolean) => {
    const curId = manualQueueIds[manualIdx];
    if (markCurrent && curId) {
      const ok = await markGroupPostedById(curId);
      if (!ok) return;
    }
    const next = manualIdx + 1;
    if (next >= manualQueueIds.length) {
      setManualQueueIds([]);
      setManualIdx(0);
      toast('خلّصت كل جروبات الطابور ✓', 'success');
      return;
    }
    setManualIdx(next);
    const nxt = fbGroups.find(x => String(x.id) === manualQueueIds[next]);
    if (nxt) copyAndOpenGroup(nxt);
  };

  // اختصارات لوحة المفاتيح للطابور (Space=نسخ+فتح، Enter=نشرت—التالي، S=تخطي، Esc=إيقاف)
  useEffect(() => {
    if (!manualQueueIds.length) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const curId = manualQueueIds[manualIdx];
      if (e.code === 'Space') { e.preventDefault(); if (curId) { const cur = fbGroups.find(g => String(g.id) === curId); if (cur) copyAndOpenGroup(cur); } }
      else if (e.key === 'Enter') { e.preventDefault(); if (curId) manualQueueDoneNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); stopManualQueue(); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); skipManualQueue(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [manualQueueIds, manualIdx, fbGroups]);

  const toggleFeatured = async (id: string) => {
    const listing = listings.find(l => l.id === id);
    if (!listing) return;
    const newVal = !listing.featured;
    await listingsService.update(id, { featured: newVal });
    setListings(p => p.map(l => l.id === id ? { ...l, featured: newVal } : l));
    setStats((s: any) => s ? { ...s, featuredListings: (s.featuredListings||0) + (newVal ? 1 : -1) } : s);
    logAdminAction(newVal ? 'listing_featured' : 'listing_unfeatured', `${id} — ${listing.title}`);
    toast(newVal ? 'تم تمييز الإعلان كمميز' : 'تم إلغاء التمييز', 'success');
  };
  const deleteListing = async (id: string) => {
    if (!confirm('تأكيد الحذف؟')) return;
    const l = listings.find(x => x.id === id);
    if (l && String(id).startsWith('sample-')) {
      toast('هذا إعلان تجريبي (عرض) ولا يمكن حذفه — بياناتك المنشورة تُحذف من حسابك', 'error');
      return;
    }
    try {
      await listingsService.delete(id);
      setListings(p => p.filter(l => l.id !== id));
      logAdminAction('listing_deleted', id);
      toast('تم حذف الإعلان', 'success');
    } catch (e: any) {
      const msg = e?.code === 'permission-denied'
        ? 'حسابك مسجّل كأدمن في الموقع لكن صلاحية الحذف غير مفعّلة في قاعدة البيانات — تأكد أن حسابك في جدول المستخدمين نوعه admin'
        : (e?.message || 'تعذّر حذف الإعلان');
      toast(msg, 'error');
      console.error('deleteListing failed:', e);
    }
  };
  const duplicateListing = async (id: string) => {
    const l = listings.find(x => x.id === id);
    if (!l) return;
    try {
      const { id: _id, createdAt: _createdAt, status: _status, slug: _slug, featured: _featured, featuredUntil: _featuredUntil, fbPostedAt: _fbPostedAt, aiModeration: _aiModeration, views: _views, ...rest } = l as any;
      const copy = { ...rest, title: `${l.title} (تكرار)`, slug: `${l.slug || 'listing'}-copy-${Date.now()}`, status: 'pending' };
      const created = await listingsService.create(copy as any);
      logAdminAction('listing_duplicated', `${id} → ${created.id}`);
      toast('تم إنشاء نسخة من الإعلان (بحالة قيد المراجعة)', 'success');
    } catch {
      toast('تعذر تكرار الإعلان', 'error');
    }
  };

  const aiScan = async () => {
    setAiScanLoading(true);
    try {
      const targets = listings.filter(l => l.status === 'pending' || !(l as any).aiModeration).slice(0, 20);
      for (const l of targets) {
        try {
          const res = await fetch(`${getApiUrl()}/ai/index`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'moderate', title: l.title, description: l.description || '', category: l.category, price: l.price, userName: l.userName, contactPhone: l.contactPhone || '' }),
          });
          const data = await res.json();
          if (data.ok && data.verdict) {
            await listingsService.update(l.id, { aiModeration: { checkedAt: new Date().toISOString(), verdict: data.verdict, score: data.score || 0, reasons: data.reasons || [], categories: data.categories || [] } } as any);
          }
        } catch {}
      }
      setListings(await listingsService.getAll());
      toast(`تم فحص ${targets.length} إعلان بالذكاء الاصطناعي`, 'success');
    } catch {
      toast('تعذر إتمام الفحص', 'error');
    } finally { setAiScanLoading(false); }
  };
  const updateFinance = async (id: string, status: FinanceRequest['status']) => {
    await financeService.update(id, { status });
    setFinance(p => p.map(f => f.id === id ? { ...f, status } : f));
  };
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({ name: '', email: '', phone: '', governorate: '', type: undefined });

  const toggleAdmin = async (u: User) => {
    const newType = u.type === 'admin' ? 'individual' : 'admin';
    await usersService.update(u.id, { type: newType as any });
    setUsers(p => p.map(x => x.id === u.id ? { ...x, type: newType as any } : x));
    toast(u.type === 'admin' ? 'تم إلغاء صلاحية المدير' : 'تمت الترقية لمدير', 'success');
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${u.name}"؟\nسيتم حذف جميع بياناته و إعلاناته.`)) return;
    await usersService.delete(u.id);
    setUsers(p => p.filter(x => x.id !== u.id));
    toast(`تم حذف المستخدم ${u.name}`, 'error');
  };

  const openEditUser = (u: User) => {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, phone: u.phone, governorate: u.governorate, type: u.type });
  };

  const saveEditUser = async () => {
    if (!editUser) return;
    await usersService.update(editUser.id, editForm);
    setUsers(p => p.map(x => x.id === editUser.id ? { ...x, ...editForm } : x));
    setEditUser(null);
    toast('تم تحديث بيانات المستخدم', 'success');
  };

  const filtered = <T extends { title?: string; name?: string; origin?: string; userName?: string }>(arr: T[]) =>
    search ? arr.filter(x =>
      (x.title||x.name||x.origin||'').toLowerCase().includes(search.toLowerCase()) ||
      (x.userName||'').toLowerCase().includes(search.toLowerCase())
    ) : arr;

  const handleLogout = () => { logout(); navigate('/'); };

  const sendBroadcast = async () => {
    if (!notifTitle.trim()) { setNotifMsg('الرجاء إدخال عنوان الإشعار'); return; }
    setSendingNotif(true); setNotifMsg('');
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      if (!token) throw new Error('يجب تسجيل الدخول');
      const r = await fetch(`${getApiUrl()}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'send', title: notifTitle, body: notifBody, url: '/' }),
      });
      const d = await r.json();
      if (d.success) setNotifMsg(`تم إرسال الإشعار لـ ${d.sent} مستخدم`);
      else throw new Error(d.error || 'فشل الإرسال');
    } catch (e: any) { setNotifMsg(e.message || 'خطأ في الإرسال'); }
    finally { setSendingNotif(false); }
  };

  const sendTestNotif = async () => {
    if (!notifTitle.trim()) { setNotifMsg('الرجاء إدخال عنوان الإشعار'); return; }
    setSendingNotif(true); setNotifMsg('');
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      if (!token) throw new Error('يجب تسجيل الدخول');
      const r = await fetch(`${getApiUrl()}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'send', title: notifTitle, body: notifBody, url: notifUrl.trim() || '/', targetUserId: user?.id }),
      });
      const d = await r.json();
      if (d.success) setNotifMsg(`تم إرسال الإشعار التجريبي`);
      else throw new Error(d.error || 'فشل الإرسال');
    } catch (e: any) { setNotifMsg(e.message || 'خطأ في الإرسال'); }
    finally { setSendingNotif(false); }
  };

  const adminApiUpdate = async (collection: string, docId: string, data: any, action?: string) => {
    try {
      let token: string | null = null;
      try { token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : null; } catch {}
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (user?.id) headers['x-uid'] = user.id;
      const r = await fetch(`${getApiUrl()}/admin/update-doc`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ collection, docId, data, action }),
      });
      const d = await r.json().catch(() => null);
      if (d?.success) { toast('تم بنجاح', 'success'); loadTab(); }
      else toast(d?.message || `فشل (HTTP ${r.status})`, 'error');
    } catch { toast('خطأ في الاتصال', 'error'); }
  };

  const confirmPayment = async (paymentId: string, status: string) => {
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      if (!token) return;
      const r = await fetch(`${getApiUrl()}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'confirm', paymentId, status }),
      });
      const d = await r.json();
      if (d.success) { toast('تم تحديث حالة الدفع', 'success'); loadTab(); }
      else toast(d.message || 'فشل', 'error');
    } catch { toast('خطأ في الاتصال', 'error'); }
  };

  // ── Render tab content ───────────────────────────────────────────
  const renderContent = () => {
    if (loading && tab !== 'dashboard') return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );

    switch (tab) {

      // ── DASHBOARD ────────────────────────────────────────────────
      case 'dashboard': return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">نظرة عامة</h2>
            <button onClick={loadStats} className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-500 transition-colors">
              <RefreshCw className="w-4 h-4" /> تحديث
            </button>
          </div>

          {/* بطاقات الإحصائيات الأساسية */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="المستخدمون"     value={stats?.totalUsers}      icon={Users}       color="bg-blue-500" />
            <StatCard label="الإعلانات النشطة" value={stats?.activeListings} icon={Truck}       color="bg-orange-500" />
            <StatCard label="إعلانات معلقة"  value={stats?.pendingListings} icon={Bell}        color="bg-yellow-500" />
            <StatCard label="طلبات تمويل"    value={stats?.financeRequests} icon={DollarSign}  color="bg-green-500" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="حمولة"   value={stats?.totalLoads}   icon={Package}   color="bg-purple-500" />
            <StatCard label="الوظائف"    value={stats?.totalJobs}    icon={Briefcase} color="bg-teal-500" />
            <StatCard label="تمويل جديد" value={stats?.pendingFinance} icon={DollarSign} color="bg-red-500" />
            <StatCard label="إعلانات مميزة" value={stats?.featuredListings} icon={Star} color="bg-amber-500" />
            <StatCard label="إجمالي الإعلانات" value={stats?.totalListings} icon={BarChart2} color="bg-indigo-500" />
          </div>

          {/* الرسوم البيانية */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* توزيع الإعلانات حسب الحالة */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-orange" /> توزيع الإعلانات
              </h3>
              {stats?.listingStatusCount ? (
                <div className="space-y-3">
                  {statusChartBars(stats.listingStatusCount)}
                </div>
              ) : (
                <p className="text-gray-400 text-sm py-4 text-center">لا توجد بيانات</p>
              )}
            </div>

            {/* أكثر المحافظات نشاطاً */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange" /> أكثر المحافظات نشاطاً
              </h3>
              {stats?.topGovernorates?.length ? (
                <div className="space-y-3">
                  {stats.topGovernorates.map((g: any, i: number) => {
                    const maxCount = stats.topGovernorates[0]?.count || 1;
                    const pct = Math.round((g.count / maxCount) * 100);
                    return (
                      <div key={g.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">{g.name}</span>
                          <span className="font-bold text-gray-900">{g.count}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-l from-orange to-orange-300 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm py-4 text-center">لا توجد بيانات</p>
              )}
            </div>

            {/* أنواع المستخدمين */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange" /> أنواع المستخدمين
              </h3>
              {stats?.userTypeCount ? (
                <div className="space-y-3">
                  {userTypeChartBars(stats.userTypeCount)}
                </div>
              ) : (
                <p className="text-gray-400 text-sm py-4 text-center">لا توجد بيانات</p>
              )}
            </div>

            {/* توزيع الوظائف حسب التصنيف */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-orange" /> توزيع الوظائف
              </h3>
              {stats?.jobTypeCount ? (
                <div className="space-y-3">
                  {jobTypeChartBars(stats.jobTypeCount)}
                </div>
              ) : (
                <p className="text-gray-400 text-sm py-4 text-center">لا توجد بيانات</p>
              )}
            </div>
          </div>

          {/* أكثر التصنيفات */}
          {stats?.topCategories?.length ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange" /> أكثر التصنيفات في الإعلانات
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {stats.topCategories.map((c: any, i: number) => {
                  const colors = ['bg-orange', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500'];
                  return (
                    <div key={c.name} className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className={`w-8 h-8 rounded-lg ${colors[i]} text-white flex items-center justify-center text-sm font-bold mx-auto mb-2`}>
                        {i + 1}
                      </div>
                      <div className="text-sm font-bold text-gray-800 truncate">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.count} إعلان</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* مقاييس النمو */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* نمو المستخدمين */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange" /> نمو المستخدمين (آخر 30 يوم)
              </h3>
              {stats?.dailySignups?.length ? (
                <div className="flex items-end gap-1 h-24">
                  {stats.dailySignups.slice(-30).map((d: any, i: number) => {
                    const maxVal = Math.max(1, ...stats.dailySignups.map((x: any) => x.count));
                    const h = Math.max(4, Math.round((d.count / maxVal) * 100));
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                        <div className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t transition-all"
                          style={{ height: `${h}%` }} />
                        <span className="text-[9px] text-gray-400 hidden group-hover:block absolute -top-5 bg-gray-900 text-white px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap z-10">
                          {d.date}: {d.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm py-4 text-center">لا توجد بيانات كافية</p>
              )}
            </div>

            {/* نمو الإعلانات */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange" /> نمو الإعلانات (آخر 30 يوم)
              </h3>
              {stats?.dailyListings?.length ? (
                <div className="flex items-end gap-1 h-24">
                  {stats.dailyListings.slice(-30).map((d: any, i: number) => {
                    const maxVal = Math.max(1, ...stats.dailyListings.map((x: any) => x.count));
                    const h = Math.max(4, Math.round((d.count / maxVal) * 100));
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                        <div className="w-full bg-gradient-to-t from-orange to-orange-300 rounded-t transition-all"
                          style={{ height: `${h}%` }} />
                        <span className="text-[9px] text-gray-400 hidden group-hover:block absolute -top-5 bg-gray-900 text-white px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap z-10">
                          {d.date}: {d.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm py-4 text-center">لا توجد بيانات كافية</p>
              )}
            </div>
          </div>

          {/* ملخص الأداء */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-orange" /> ملخص الأداء
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'معدل التحويل', value: stats?.conversionRate ? `${stats.conversionRate}%` : '—', color: 'text-green-600' },
                { label: 'إجمالي المشاهدات', value: stats?.totalViews?.toLocaleString('ar-EG') || '—', color: 'text-blue-600' },
                { label: 'متوسط المشاهدات/إعلان', value: stats?.avgViewsPerListing || '—', color: 'text-purple-600' },
                { label: 'الإعلانات المباعة', value: stats?.soldListings || '—', color: 'text-red-600' },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <div className={`text-xl font-black ${m.color}`}>{m.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* إجراءات سريعة */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 mb-4">إجراءات سريعة</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label:'مراجعة الإعلانات', count: stats?.pendingListings, tab:'listings' as Tab, color:'bg-yellow-50 border-yellow-200' },
                { label:'طلبات تمويل جديدة', count: stats?.pendingFinance, tab:'finance' as Tab, color:'bg-blue-50 border-blue-200' },
                { label:'إدارة المستخدمين', count: stats?.totalUsers, tab:'users' as Tab, color:'bg-green-50 border-green-200' },
              ].map(a => (
                <button key={a.tab} onClick={() => setTab(a.tab)}
                  className={`p-4 rounded-xl border-2 text-right transition-colors hover:opacity-80 ${a.color}`}>
                  <div className="text-2xl font-black text-gray-800">{a.count ?? '—'}</div>
                  <div className="text-sm font-semibold text-gray-600 mt-1">{a.label}</div>
                </button>
              ))}
            </div>
            <SeedButton onSeeded={loadStats} />
          </div>

          <NotesPipelineCard onOpen={() => setTab('notes' as Tab)} onRefresh={loadStats} />
          <AuditLogCard />
        </div>
      );

      // ── LISTINGS ─────────────────────────────────────────────────
      case 'listings': {
        const filteredList = filtered(listings);
        const pageList = filteredList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        return (
        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-xl font-bold text-gray-900">إدارة الإعلانات</h2>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e=>setSearch(e.target.value)}
                className="border border-gray-200 rounded-xl pr-9 pl-4 py-2 text-sm focus:outline-none focus:border-orange-400 w-60"
                placeholder="بحث..." />
            </div>
          </div>
          {fbShareTip && (
            <div className="relative mb-4 overflow-hidden rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 shadow-sm">
              <button onClick={() => setFbShareTip(null)} className="absolute top-2.5 left-2.5 text-blue-400 hover:text-blue-600 rounded-lg p-0.5" title="إغلاق"><X className="w-4 h-4" /></button>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 pl-4">
                  <p className="flex items-center gap-2 font-bold text-blue-900 text-sm sm:text-base mb-1.5">
                    <span className="bg-blue-600 text-white rounded-lg p-1.5 shrink-0"><Share2 className="w-4 h-4" /></span>
                    انشر الإعلان على فيسبوك يدويًا بضغطة
                  </p>
                  <p className="text-blue-900 text-sm mb-2">📌 الإعلان: <b>{fbShareTip.listing.title}</b></p>
<ol className="text-xs text-blue-800 space-y-1">
                    <li><span className="font-bold">1)</span> اضغط <b>"نسخ نص الإعلان"</b> — النص بيتاخد في الكليببورد فورًا.</li>
                    <li><span className="font-bold">2)</span> روح لحائطك أو جروبك أو <b>صفحتك</b> → <b>"أنشئ منشور"</b> → اعمل <b>لصق (Ctrl+V)</b>.</li>
                    <li><span className="font-bold">3)</span> <b>أضِف صور العربية</b> من الألبوم → <b>نشر</b>.</li>
                  </ol>
                  <p className="text-[11px] text-blue-500 mt-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> من غير توكن — بيمشي على طول مهما كانت حالة التوكن.</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => {
                      const shareObj = { ...fbShareTip.listing, url: fbShareTip.url };
                      copyText(buildAdPageText(shareObj)).then(ok => { if (ok) toast('💾 اتنسخ نص المنصة كامل — اروح لفيس بوك → أنشئ منشور → لصق (Ctrl+V) → أضِف صور العربية → نشر', 'success'); });
                    }}
                    className="flex items-center justify-center gap-1.5 text-sm px-5 py-3 rounded-xl bg-white border-2 border-blue-600 text-blue-700 hover:bg-blue-50 font-bold shrink-0 transition-colors">
                    <Copy className="w-4 h-4" /> نسخ نص الإعلان
                  </button>
                <button
                  onClick={() => {
                    const shareObj = { ...fbShareTip.listing, url: fbShareTip.url };
                    window.open('https://www.facebook.com/mashroey.bns/', '_blank', 'noopener');
                    copyText(buildAdPageText(shareObj)).then(ok => { if (ok) toast('💾 اتنسخ نص الإعلان كامل — لصقه (Ctrl+V) في حسابك mashroey.bns → أضِف صور العربية → نشر', 'success'); });
                  }}
                  className="flex items-center justify-center gap-1.5 text-sm px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shrink-0 shadow-md shadow-blue-500/30 transition-colors">
                  <Share2 className="w-4 h-4" /> افتح فيسبوك + نسخ
                </button>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {pageList.map(l => (
              <div key={l.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-3">
                {l.images?.[0] && <img src={l.images[0]} alt="" className="w-20 h-16 object-cover rounded-xl flex-shrink-0" loading="lazy" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{l.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{l.userName} • {l.governorate} • {l.price?.toLocaleString('ar-EG')} جنيه</p>
                      {l.description && <p className="text-gray-600 text-xs mt-1 leading-relaxed line-clamp-2">{l.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {l.featured && <span className="text-xs bg-orange/10 text-orange font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Star className="w-3 h-3" />مميز</span>}
                      {(l as any).fbPostedAt && <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">فيسبوك ✓</span>}
                      {badge(l.status)}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {l.status === 'pending' && <>
                      <button onClick={() => approveListing(l.id)}
                        className="flex items-center gap-1 bg-success/10 hover:bg-success/20 text-success px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" /> موافقة
                      </button>
                      <button onClick={() => rejectListing(l.id)}
                        className="flex items-center gap-1 bg-danger/10 hover:bg-danger/20 text-danger px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> رفض
                      </button>
                    </>}
                    {l.status === 'rejected' && (
                      <button onClick={() => approveListing(l.id)}
                        className="flex items-center gap-1 bg-success/10 hover:bg-success/20 text-success px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" /> إعادة نشر
                      </button>
                    )}
                    <Link to={listingUrl(l.id, l.slug)} target="_blank"
                      className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      <Eye className="w-3.5 h-3.5" /> عرض
                    </Link>
{l.status === 'active' && <>
                      <button onClick={() => openPublishModal(l)}
                        title="نشر الإعلان على صفحة كار مصر + الجروبات المحفوظة + رسالة إشعار المعلن بالواتساب"
                        className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                        <Send className="w-3.5 h-3.5" /> نشر كامل
                      </button>
                      <button onClick={() => openContactModal(l.id)}
                        title="واتساب/ماسنجر لصاحب الإعلان + مشاركة الإعلان على صفحة كار مصر بكل صوره"
                        className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                        <Share2 className="w-3.5 h-3.5" /> المشاركات العامة
                      </button>
                    </>}
                    <Link to={`/listing/${l.id}/edit`}
                      className="flex items-center gap-1 bg-orange-50 hover:bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      <Edit className="w-3.5 h-3.5" /> تعديل
                    </Link>
                    <button onClick={() => toggleFeatured(l.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        l.featured ? 'bg-orange/10 hover:bg-orange/20 text-orange' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }`}>
                      <Star className={`w-3.5 h-3.5 ${l.featured ? 'fill-orange' : ''}`} /> {l.featured ? 'إلغاء التمييز' : 'مميز'}
                    </button>
                    <button onClick={() => duplicateListing(l.id)}
                      title="إنشاء نسخة من الإعلان (بحالة قيد المراجعة)"
                      className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      <Copy className="w-3.5 h-3.5" /> تكرار
                    </button>
                    <button onClick={() => deleteListing(l.id)}
                      className="flex items-center gap-1 bg-danger/10 hover:bg-danger/20 text-danger px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!pageList.length && <Empty label="إعلانات" />}
          </div>
          <Pagination page={page} total={filteredList.length} onChange={setPage} />
        </div>
      );}

      // ── CAMPAIGN TRACKING ────────────────────────────────────────
      case 'tracking': {
        const srcLabels: Record<string,string> = {
          facebook:'فيسبوك', group:'جروبات', whatsapp:'واتساب', tiktok:'تيك توك',
          google:'جوجل', instagram:'انستجرام', direct:'مباشر', organic:'مباشر',
        };
        const srcColor: Record<string,string> = {
          facebook:'bg-blue-500', group:'bg-purple-500', whatsapp:'bg-green-500',
          tiktok:'bg-rose-500', google:'bg-amber-500', instagram:'bg-pink-500',
        };
        const parseDate = (u: User): Date => {
          const c = (u as any).createdAt;
          if (!c) return new Date(0);
          if (typeof c === 'string') return new Date(c);
          if (typeof c.toDate === 'function') return c.toDate();
          if (c.seconds) return new Date(c.seconds * 1000);
          return new Date(0);
        };
        const weekKey = (d: Date) => {
          const day = (d.getDay() + 6) % 7;
          const monday = new Date(d); monday.setDate(d.getDate() - day);
          return `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
        };
        const weekLabel = (k: string) => {
          const [y, m, dd] = k.split('-').map(Number);
          return new Date(y, m-1, dd).toLocaleDateString('ar-EG', { day:'numeric', month:'short' });
        };

        const parsed: (User & { _d: Date })[] = trackUsers.map(u => ({ ...u, _d: parseDate(u) }));
        const bySource: Record<string, number> = {};
        const byWeek: Record<string, number> = {};
        parsed.forEach(u => {
          const src = u.signupSource || 'direct';
          bySource[src] = (bySource[src] || 0) + 1;
          const wk = weekKey(u._d);
          byWeek[wk] = (byWeek[wk] || 0) + 1;
        });
        const weeks = Object.keys(byWeek).sort();
        const lastWeeks = weeks.slice(-8);
        const weeklyChart = lastWeeks.map(k => ({ label: weekLabel(k), count: byWeek[k] }));
        const maxWeek = Math.max(1, ...weeklyChart.map(w => w.count));
        const sourcedCount = parsed.filter(u => u.signupSource || u.signupCampaign || u.signupReferrer).length;
        const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
        const pageTrack = parsed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

        return (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">تتبع الحملات</h2>
              <p className="text-sm text-gray-500">منين جه كل عميل سجّل — حسب رابط الحملة (UTM)</p>
            </div>
            <button onClick={loadTab} className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-500 transition-colors">
              <RefreshCw className="w-4 h-4" /> تحديث
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="إجمالي المسجلين" value={parsed.length} icon={Users} color="bg-blue-500" />
            <StatCard label="من حملات (UTM)" value={sourcedCount} icon={Target} color="bg-orange-500" />
            <StatCard label="أعلى مصدر" value={topSource ? (srcLabels[topSource[0]] || topSource[0]) : '—'} icon={TrendingUp} color="bg-green-500" />
            <StatCard label="آخر أسبوع" value={weeks.length ? byWeek[weeks[weeks.length-1]] : 0} icon={BarChart2} color="bg-purple-500" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-4">المسجلون حسب المصدر</h3>
            {Object.keys(bySource).length
              ? chartBars(bySource, srcLabels)
              : <Empty label="لا يوجد مسجلين بعد" />}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-4">المسجلون حسب الأسبوع (آخر 8 أسابيع)</h3>
            <div className="flex items-end gap-2 h-32">
              {weeklyChart.map(w => (
                <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-gray-700">{w.count}</span>
                  <div className="w-full bg-gradient-to-t from-orange to-orange-300 rounded-t-lg transition-all"
                    style={{ height: `${Math.max(8, Math.round((w.count / maxWeek) * 100))}%` }} />
                  <span className="text-[10px] text-gray-400">{w.label}</span>
                </div>
              ))}
              {!weeklyChart.length && <Empty label="لا يوجد مسجلين بعد" />}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-gray-900">أحدث المسجلين</h3>
              <span className="text-xs text-gray-400">كل الحسابات على التطبيق</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="text-right p-3">الاسم</th>
                    <th className="text-right p-3">التليفون</th>
                    <th className="text-right p-3">المحافظة</th>
                    <th className="text-right p-3">المصدر</th>
                    <th className="text-right p-3">الحملة</th>
                    <th className="text-right p-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {pageTrack.map(u => (
                    <tr key={u.id} className="border-t border-gray-100">
                      <td className="p-3 font-semibold text-gray-800">{u.name}</td>
                      <td className="p-3 text-gray-600" dir="ltr">{u.phone}</td>
                      <td className="p-3 text-gray-600">{u.governorate}</td>
                      <td className="p-3">
                        {u.signupSource ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${srcColor[u.signupSource] || 'bg-gray-500'}`}>
                            {srcLabels[u.signupSource] || u.signupSource}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">مباشر</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-600">{u.signupCampaign || u.signupMedium || '—'}</td>
                      <td className="p-3 text-gray-500">{formatDateDMY(u._d.toISOString())}</td>
                    </tr>
                  ))}
                  {!pageTrack.length && (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">لا توجد بيانات</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} total={parsed.length} onChange={setPage} />
        </div>
        );
      }

      // ── USERS ────────────────────────────────────────────────────
      case 'users': {
        const filteredUsers = users.filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
        const pageUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        return (
        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-xl font-bold text-gray-900">إدارة المستخدمين</h2>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e=>setSearch(e.target.value)}
                className="border border-gray-200 rounded-xl pr-9 pl-4 py-2 text-sm focus:outline-none focus:border-orange-400 w-60"
                placeholder="بحث..." />
            </div>
          </div>
          <div className="space-y-2">
            {pageUsers.map(u => (
              <div key={u.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {u.avatar
                    ? <img src={u.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
                    : <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">{u.name?.[0]}</div>
                  }
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                    <p className="text-gray-500 text-xs">{u.email} • {u.phone}</p>
                    <p className="text-gray-400 text-xs">{u.governorate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {badge(u.type)}
                  {u.id !== user?.id && (
                    <>
                      <button onClick={() => openEditUser(u)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors bg-blue-50 hover:bg-blue-100 text-blue-600">
                        <Edit className="w-3.5 h-3.5 inline ml-1" />تعديل
                      </button>
                      <button onClick={() => toggleAdmin(u)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                          u.type === 'admin'
                            ? 'bg-danger/10 hover:bg-danger/20 text-danger'
                            : 'bg-orange-50 hover:bg-orange-100 text-orange-600'}`}>
                        {u.type === 'admin' ? 'إلغاء الإدارة' : 'ترقية لمدير'}
                      </button>
                      <button onClick={() => deleteUser(u)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors bg-danger/10 hover:bg-danger/20 text-danger">
                        <Trash2 className="w-3.5 h-3.5 inline ml-1" />حذف
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!pageUsers.length && <Empty label="مستخدمين" />}
          </div>
          <Pagination page={page} total={filteredUsers.length} onChange={setPage} />
        </div>
      );}

      // ── FINANCE ──────────────────────────────────────────────────
      case 'finance': {
        const pageFinance = finance.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        return (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-5">طلبات التمويل</h2>
          <div className="space-y-3">
            {pageFinance.map(f => (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <p className="font-bold text-gray-800">{f.name}</p>
                    <p className="text-gray-500 text-sm">{f.phone} • {f.governorate}</p>
                  </div>
                  {badge(f.status)}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    ['نوع المركبة', f.vehicleType],
                    ['سعر المركبة', `${f.vehiclePrice?.toLocaleString('ar-EG')} جنيه`],
                    ['الدفعة المقدمة', `${f.downPayment?.toLocaleString('ar-EG')} جنيه`],
                  ].map(([k,v])=>(
                    <div key={k} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-400 mb-1">{k}</div>
                      <div className="text-sm font-semibold text-gray-700">{v}</div>
                    </div>
                  ))}
                </div>
                {f.status === 'new' && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => updateFinance(f.id, 'reviewing')}
                      className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                      قيد المراجعة
                    </button>
                    <button onClick={() => updateFinance(f.id, 'approved')}
                      className="bg-success/10 hover:bg-success/20 text-success px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                      <CheckCircle className="w-4 h-4 inline ml-1" />موافقة
                    </button>
                    <button onClick={() => updateFinance(f.id, 'rejected')}
                      className="bg-danger/10 hover:bg-danger/20 text-danger px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                      <XCircle className="w-4 h-4 inline ml-1" />رفض
                    </button>
                  </div>
                )}
                {f.status === 'reviewing' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateFinance(f.id, 'approved')}
                      className="bg-success/10 hover:bg-success/20 text-success px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                      موافقة نهائية
                    </button>
                    <button onClick={() => updateFinance(f.id, 'rejected')}
                      className="bg-danger/10 hover:bg-danger/20 text-danger px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                      رفض
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!pageFinance.length && <Empty label="طلبات تمويل" />}
          </div>
          <Pagination page={page} total={finance.length} onChange={setPage} />
        </div>
      );}

      // ── JOBS ─────────────────────────────────────────────────────
      case 'jobs': {
        const pageJobs = jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        return (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-5">إدارة الوظائف</h2>
          <div className="space-y-3">
            {pageJobs.map(j => (
              <div key={j.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">{j.title}</p>
                  <p className="text-gray-500 text-sm">{j.company} • {j.governorate} • {j.salary}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {badge(j.status)}
                  {j.status === 'pending' && (
                    <>
                      <button onClick={() => approveJob(j.id)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600">
                        <CheckCircle className="w-3.5 h-3.5" /> موافقة
                      </button>
                      <button onClick={() => rejectJob(j.id)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600">
                        <XCircle className="w-3.5 h-3.5" /> رفض
                      </button>
                    </>
                  )}
                  {j.status === 'rejected' && (
                    <button onClick={() => approveJob(j.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-success/10 hover:bg-success/20 text-success">
                      <RefreshCw className="w-3.5 h-3.5" /> إعادة نشر
                    </button>
                  )}
                  <button onClick={async () => { await jobsService.delete(j.id); setJobs(p=>p.filter(x=>x.id!==j.id)); }}
                    className="text-danger hover:text-red-700 p-1.5 rounded-lg hover:bg-danger/5 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {!pageJobs.length && <Empty label="وظائف" />}
          </div>
          <Pagination page={page} total={jobs.length} onChange={setPage} />
        </div>
      );}

      // ── LOADS ────────────────────────────────────────────────────
      case 'loads': {
        const pageLoads = loads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        return (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-5">إدارة حمولة</h2>
          <div className="space-y-3">
            {pageLoads.map(l => (
              <div key={l.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">{l.origin} ← {l.destination}</p>
                  <p className="text-gray-500 text-sm">{l.cargoType} • {l.vehicleType || 'أي عربية'} • {l.weight} طن • {l.price?.toLocaleString('ar-EG')} جنيه</p>
                  <p className="text-gray-400 text-xs">{l.userName} • {formatDateDMY(l.date)}</p>
                </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                  {badge(l.status)}
                  <Link to={`/load/${l.id}/edit`}
                    className="text-navy hover:text-orange p-1.5 rounded-lg hover:bg-orange/5 transition-colors">
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button onClick={async () => { await loadsService.delete(l.id); setLoads(p=>p.filter(x=>x.id!==l.id)); }}
                    className="text-danger hover:text-red-700 p-1.5 rounded-lg hover:bg-danger/5 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {!pageLoads.length && <Empty label="حمولات" />}
          </div>
          <Pagination page={page} total={loads.length} onChange={setPage} />
        </div>
      );}

      // ── PASSWORD RESETS ───────────────────────────────────────────
      case 'resets': {
        const pageResets = resets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        return (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-5">طلبات إعادة تعيين كلمة السر</h2>
          <div className="space-y-3">
            {pageResets.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800">
                    {r.userName || "مستخدم"} • {formatPhone(r.phone)}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">{r.email}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {formatDateTime(r.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {badge(r.status)}
                  {r.status === 'pending' && (
                    <>
                      <a href={`https://wa.me/20${r.phone}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-green-50 hover:bg-green-100 text-green-600 transition-colors flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" /> تواصل
                      </a>
                      <a href={`https://console.firebase.google.com/project/tareeq-d4dcc/authentication/users`} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors flex items-center gap-1">
                        <ExternalLink className="w-3.5 h-3.5" /> Firebase Auth
                      </a>
                      <button onClick={async () => {
                        if (!confirm('تأكيد إرسال رابط إعادة تعيين كلمة السر؟')) return;
                        try {
                          await sendPasswordResetEmail(firebaseAuth, r.email);
                          await passwordResetsService.update(r.id, { status: 'completed', completedAt: new Date().toISOString(), completedBy: user?.id });
                          setResets(p => p.map(x => x.id === r.id ? { ...x, status: 'completed' } : x));
                          toast('تم إرسال رابط إعادة التعيين', 'success');
                        } catch (e: any) {
                          toast('فشل إرسال الرابط: ' + (e.message || ''), 'error');
                        }
                      }}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-purple-50 hover:bg-purple-100 text-purple-600 transition-colors flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5" /> إعادة تعيين
                      </button>
                      <button onClick={() => { setResetModal({ email: r.email, phone: r.phone }); setNewPassword(''); }}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-orange/10 hover:bg-orange/20 text-orange transition-colors flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" /> تغيير كلمة السر
                      </button>
                      <button onClick={async () => {
                        if (!confirm('تأكيد إنهاء الطلب؟')) return;
                        await passwordResetsService.update(r.id, { status: 'completed', completedAt: new Date().toISOString(), completedBy: user?.id });
                        setResets(p => p.map(x => x.id === r.id ? { ...x, status: 'completed' } : x));
                        toast('تم إنهاء الطلب', 'success');
                      }}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-success/10 hover:bg-success/20 text-success transition-colors flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> تم التواصل
                      </button>
                      <button onClick={async () => {
                        if (!confirm('تأكيد إلغاء الطلب؟')) return;
                        await passwordResetsService.update(r.id, { status: 'cancelled' });
                        setResets(p => p.map(x => x.id === r.id ? { ...x, status: 'cancelled' } : x));
                        toast('تم إلغاء الطلب', 'info');
                      }}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                        إلغاء
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!pageResets.length && <Empty label="طلبات إعادة تعيين" />}
          </div>
          <Pagination page={page} total={resets.length} onChange={setPage} />
        </div>
      );}

      // ── SETTINGS ──────────────────────────────────────────────────
      case 'exhibition-plans': return (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">أنواع اشتراكات المعارض</h2>
            <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
              إجمالي المعارض: {exhibitions.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {EXHIBITION_PLANS.map(p => {
              const count = exhibitions.filter(ex => ex.plan === p.id).length;
              const isVip = p.id === 'vip';
              const PIcon = p.icon;
              return (
                <div key={p.id} className={`relative rounded-2xl border-2 p-5 ${
                  isVip
                    ? 'bg-gradient-to-br from-navy to-navy-light text-white border-amber-300/60 shadow-lg shadow-amber-400/10'
                    : 'bg-white border-gray-200'
                }`}>
                  {p.badge && (
                    <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap ${
                      isVip ? 'bg-amber-400 text-navy' : 'bg-orange text-white'
                    }`}>
                      {p.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isVip ? 'bg-amber-400 text-navy' : p.id === 'free' ? 'bg-green-100 text-green-600' : p.id === 'premium' ? 'bg-orange/10 text-orange' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <PIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`font-bold ${isVip ? 'text-white' : 'text-gray-900'}`}>{p.name}</p>
                      <p className={`text-[10px] ${isVip ? 'text-gray-300' : 'text-gray-400'}`}>الترتيب: {p.rank + 1} من 4</p>
                    </div>
                  </div>
                  <p className={`font-black text-lg ${isVip ? 'text-amber-300' : 'text-orange'}`}>
                    {p.price === 0 ? 'مجاني' : `${p.price} ج`}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <div className={`flex items-center justify-between text-xs ${isVip ? 'text-gray-200' : 'text-gray-600'}`}>
                      <span>المنتجات</span>
                      <span className="font-bold">{`حتى ${p.maxProducts}`}</span>
                    </div>
                    <div className={`flex items-center justify-between text-xs ${isVip ? 'text-gray-200' : 'text-gray-600'}`}>
                      <span>الشعار</span>
                      <span className={`font-bold ${p.allowsLogo ? 'text-success' : 'text-gray-400'}`}>{p.allowsLogo ? 'متاح' : '—'}</span>
                    </div>
                    <div className={`flex items-center justify-between text-xs ${isVip ? 'text-gray-200' : 'text-gray-600'}`}>
                      <span>صورة الغلاف</span>
                      <span className={`font-bold ${p.allowsCover ? 'text-success' : 'text-gray-400'}`}>{p.allowsCover ? 'متاحة' : '—'}</span>
                    </div>
                    <div className={`flex items-center justify-between text-xs ${isVip ? 'text-gray-200' : 'text-gray-600'}`}>
                      <span>روابط التواصل</span>
                      <span className={`font-bold ${p.allowsSocial ? 'text-success' : 'text-gray-400'}`}>{p.allowsSocial ? 'متاحة' : '—'}</span>
                    </div>
                    <div className={`flex items-center justify-between text-xs ${isVip ? 'text-gray-200' : 'text-gray-600'}`}>
                      <span>مستوى التمييز</span>
                      <span className="font-bold">{p.highlight === 'none' ? '—' : p.highlight === 'simple' ? 'بسيط' : p.highlight === 'strong' ? 'واضح' : 'قوي'}</span>
                    </div>
                    <div className={`flex items-center justify-between text-xs ${isVip ? 'text-gray-200' : 'text-gray-600'}`}>
                      <span>المعروضون عليها</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  </div>
                  <div className={`mt-3 pt-3 border-t ${isVip ? 'border-white/10' : 'border-gray-100'}`}>
                    <p className={`text-[11px] font-bold mb-1 ${isVip ? 'text-gray-200' : 'text-gray-500'}`}>المزايا:</p>
                    <ul className="space-y-1">
                      {p.features.slice(0, 5).map((f, i) => (
                        <li key={i} className={`flex items-center gap-1.5 text-[11px] ${isVip ? 'text-gray-200' : 'text-gray-600'}`}>
                          <CheckCircle className={`w-3 h-3 flex-shrink-0 ${isVip ? 'text-amber-300' : 'text-success'}`} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

      case 'exhibitions': return (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">إدارة المعارض</h2>
            <button onClick={() => { setShowExhForm(!showExhForm); if (!showExhForm) { setEditExhId(null); setExhForm({ name: '', description: '', logo: '', coverImage: '', governorate: '', city: '', contactPhone: '', whatsapp: '', plan: 'basic', category: 'general', facebook: '', instagram: '', website: '', workingHours: '', googleMapsUrl: '' }); } }}
              className="flex items-center gap-1 text-sm bg-orange hover:bg-orange-dark text-white px-3 py-1.5 rounded-xl transition-colors">
              {showExhForm ? 'إلغاء' : <><Plus className="w-4 h-4" /> إضافة معرض</>}
            </button>
          </div>

          {showExhForm && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-bold text-gray-700">{editExhId ? 'تعديل معرض' : 'إضافة معرض جديد'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">الاسم *</label>
                  <input value={exhForm.name} onChange={e => setExhForm(f => ({...f, name: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">المحافظة</label>
                  <input value={exhForm.governorate} onChange={e => setExhForm(f => ({...f, governorate: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">المدينة</label>
                  <input value={exhForm.city} onChange={e => setExhForm(f => ({...f, city: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">رقم التواصل</label>
                  <input value={exhForm.contactPhone} onChange={e => setExhForm(f => ({...f, contactPhone: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">واتساب</label>
                  <input value={exhForm.whatsapp} onChange={e => setExhForm(f => ({...f, whatsapp: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">الباقة</label>
                    <select value={exhForm.plan} onChange={e => setExhForm(f => ({...f, plan: e.target.value as any}))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange">
                      {EXHIBITION_PLANS.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.price > 0 ? ` (${p.price} ج)` : ''}</option>
                      ))}
                    </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">نوع المعرض</label>
                    <select value={exhForm.category} onChange={e => setExhForm(f => ({...f, category: e.target.value as 'general' | 'import'}))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange">
                      <option value="general">معرض محلي</option>
                      <option value="import">معرض استيراد</option>
                    </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">الوصف</label>
                  <textarea value={exhForm.description} onChange={e => setExhForm(f => ({...f, description: e.target.value}))} rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">لوجو (رفع صورة من جهازك)</label>
                  <ImageUploader images={exhForm.logo ? [exhForm.logo] : []} onChange={urls => setExhForm(f => ({...f, logo: urls[0] || ''}))} max={1} folder="exhibitions" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">صورة غلاف (رفع صورة من جهازك)</label>
                  <ImageUploader images={exhForm.coverImage ? [exhForm.coverImage] : []} onChange={urls => setExhForm(f => ({...f, coverImage: urls[0] || ''}))} max={1} folder="exhibitions" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">فيسبوك</label>
                  <input value={exhForm.facebook} onChange={e => setExhForm(f => ({...f, facebook: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">انستجرام</label>
                  <input value={exhForm.instagram} onChange={e => setExhForm(f => ({...f, instagram: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">موقع إلكتروني</label>
                  <input value={exhForm.website} onChange={e => setExhForm(f => ({...f, website: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ساعات العمل</label>
                  <input value={exhForm.workingHours} onChange={e => setExhForm(f => ({...f, workingHours: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">رابط الخريطة</label>
                  <input value={exhForm.googleMapsUrl} onChange={e => setExhForm(f => ({...f, googleMapsUrl: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" dir="ltr" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={async () => {
                  if (!exhForm.name) { alert('الاسم مطلوب'); return; }
                  const cleaned = {
                    ...exhForm,
                    name: cleanText(exhForm.name),
                    description: cleanText(exhForm.description),
                    city: cleanText(exhForm.city),
                    governorate: cleanText(exhForm.governorate),
                  };
                  try {
                    if (editExhId) {
                      await exhibitionsService.update(editExhId, cleaned);
                    } else {
                      await exhibitionsService.create({ ...cleaned, userId: user?.id || '', status: 'active' });
                    }
                    setShowExhForm(false); setEditExhId(null);
                    setExhForm({ name: '', description: '', logo: '', coverImage: '', governorate: '', city: '', contactPhone: '', whatsapp: '', plan: 'basic', category: 'general', facebook: '', instagram: '', website: '', workingHours: '', googleMapsUrl: '' });
                    loadTab();
                  } catch (e: any) {
                    alert('فشل حفظ المعرض: ' + (e?.message || e));
                  }
                }} className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-semibold text-sm">{editExhId ? 'حفظ' : 'إضافة'}</button>
                {editExhId && <button onClick={() => { setShowExhForm(false); setEditExhId(null); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm">إلغاء</button>}
              </div>
            </div>
          )}

          {exhibitions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد معارض</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {exhibitions.map(ex => (
                <div key={ex.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
                  <div className="flex justify-between items-start">
                    <Link to={`/exhibitions/${ex.id}`} className="font-bold text-gray-900 hover:text-orange transition-colors">{ex.name}</Link>
                    {badge(ex.status)}
                  </div>
                  <p className="text-sm text-gray-500">{ex.category === 'import' ? 'استيراد · ' : ''}{ex.governorate}{ex.city ? ` - ${ex.city}` : ''} · {ex.plan === 'free' ? 'مجاني' : ex.plan === 'vip' ? 'VIP' : ex.plan === 'premium' ? 'متقدم' : 'أساسي'}</p>
                  <p className="text-sm text-gray-600">{ex.contactPhone}</p>
                  <p className="text-xs text-gray-400">المستخدم: {ex.userId?.slice(0,8)}… · {ex.createdAt?.slice(0,10)}</p>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => adminApiUpdate('exhibitions', ex.id, { status: ex.status === 'active' ? 'inactive' : 'active' })} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">{ex.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>
                    <button onClick={() => { setEditExhId(ex.id); setExhForm({ name: ex.name, description: ex.description || '', logo: ex.logo || '', coverImage: ex.coverImage || '', governorate: ex.governorate || '', city: ex.city || '', contactPhone: ex.contactPhone || '', whatsapp: ex.whatsapp || '', plan: (ex.plan as any) || 'basic', category: (ex.category as any) || 'general', facebook: ex.facebook || '', instagram: ex.instagram || '', website: ex.website || '', workingHours: ex.workingHours || '', googleMapsUrl: ex.googleMapsUrl || '' }); setShowExhForm(true); }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">تعديل</button>
                    <button onClick={() => adminApiUpdate('exhibitions', ex.id, {}, 'delete')} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">حذف</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      case 'ai-review': return (
        <div className="space-y-5">
          {aiFeedback?.stats && (
            <div className="bg-gradient-to-l from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-sm text-gray-800">تُعلّم الآلة من قراراتك</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-purple-100 p-3">
                  <div className="text-2xl font-bold text-gray-900">{aiFeedback.stats.total ?? 0}</div>
                  <div className="text-xs text-gray-500 mt-0.5">قرارات مسجلة</div>
                </div>
                <div className="bg-white rounded-xl border border-purple-100 p-3">
                  <div className="text-2xl font-bold text-green-600">{aiFeedback.stats.accuracy != null ? `${aiFeedback.stats.accuracy}%` : '—'}</div>
                  <div className="text-xs text-gray-500 mt-0.5">دقة قرارات الآلة</div>
                </div>
                <div className="bg-white rounded-xl border border-purple-100 p-3">
                  <div className="text-2xl font-bold text-gray-900">{aiFeedback.stats.correct ?? 0}</div>
                  <div className="text-xs text-gray-500 mt-0.5">موافقات صحيحة</div>
                </div>
                <div className="bg-white rounded-xl border border-red-100 p-3">
                  <div className="text-2xl font-bold text-red-600">{aiFeedback.stats.wrong ?? 0}</div>
                  <div className="text-xs text-gray-500 mt-0.5">أخطاء يتعلّم منها</div>
                </div>
              </div>
              {(aiFeedback.commonMistakes?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-gray-600 mb-1">أكثر أسباب الأخطاء تكراراً:</p>
                  <div className="flex flex-wrap gap-2">
                    {(aiFeedback.commonMistakes ?? []).map((m, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white border border-red-100 text-red-600">{m.reason} ×{m.count}</span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-3">
                كل موافقة/رفض منك لأي إعلان مراجَع آلياً بيتسجل كبيانات تدريب، والمراجعات الجديدة بتشوف أخطاءك السابقة وتتجنبها.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">مراجعة الذكاء الاصطناعي</h2>
            <button onClick={aiScan} disabled={aiScanLoading}
              className="flex items-center gap-2 text-sm bg-orange hover:bg-orange-dark text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-60">
              {aiScanLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الفحص...</> : <><ScanSearch className="w-4 h-4" /> فحص الإعلانات بالذكاء الاصطناعي</>}
            </button>
          </div>
          <p className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-xl p-3">
            المراجعة الآلية تعمل تلقائياً عند نشر أي إعلان جديد (نص + صور): الإعلان الممتثل يُنشر فورياً، والمشكوك فيه يُرسل للمراجعة الإدارية، والمخالف يُرفض. هنا ترى الإعلانات التي تحتاج مراجعة إدارية.
          </p>
          {(() => {
            const flagged = listings
              .filter(l => { const m = (l as any).aiModeration; return m && (m.verdict === 'rejected' || m.verdict === 'undetermined' || m.verdict === 'block' || m.verdict === 'review'); })
              .sort((a, b) => ((b as any).aiModeration?.score || 0) - ((a as any).aiModeration?.score || 0));
            if (flagged.length === 0) return <p className="text-gray-500 text-center py-10">لا توجد إعلانات تحتاج مراجعة</p>;
            return (
              <div className="space-y-3">
                {flagged.map(l => {
                  const m = (l as any).aiModeration;
                  return (
                    <div key={l.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.verdict === 'rejected' || m.verdict === 'block' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                              {m.verdict === 'rejected' || m.verdict === 'block' ? 'محتوى مرفوض' : 'يحتاج مراجعة'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">خطورة {m.score || 0}%</span>
                            <span className="text-xs text-gray-400">{l.category} · {l.governorate}</span>
                          </div>
                          <Link to={listingUrl(l.id, l.slug)} className="font-bold text-gray-900 hover:text-orange mt-1 inline-block">{l.title}</Link>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{l.createdAt?.slice(0, 10)}</span>
                      </div>
                      {l.description && <p className="text-sm text-gray-600">{l.description.slice(0, 180)}</p>}
                      {m.reasons?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {m.reasons.map((r: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100">{r}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => proposeFix(l)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-purple-500 text-white hover:bg-purple-600"><Wand2 className="w-3.5 h-3.5" /> حل</button>
                        <button onClick={() => approveListing(l.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600"><Check className="w-3.5 h-3.5" /> موافقة</button>
                        <button onClick={() => rejectListing(l.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600"><XCircle className="w-3.5 h-3.5" /> رفض</button>
                        <button onClick={() => deleteListing(l.id)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">حذف</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      );

      case 'bannerads': return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-gray-900">الإعلانات المدفوعة</h2>          {bannerAds.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد إعلانات</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {bannerAds.map(ad => (
                <div key={ad.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-gray-900">{ad.companyName}</h4>
                    {badge(ad.status)}
                  </div>
                  <p className="text-sm text-gray-500">{ad.position} · {ad.price} ج.م</p>
                  {ad.linkUrl && <p className="text-xs text-blue-500 truncate">{ad.linkUrl}</p>}
                  <p className="text-xs text-gray-400">المستخدم: {ad.userId?.slice(0,8)}… · {ad.createdAt?.slice(0,10)}</p>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => adminApiUpdate('bannerAds', ad.id, { status: ad.status === 'active' ? 'inactive' : 'active' })} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">{ad.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>
                    <button onClick={() => adminApiUpdate('bannerAds', ad.id, {}, 'delete')} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">حذف</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      // ── AD STATS (نقرات/مشاهدات الإعلانات) ─────────────────────────
      case 'ad-stats': {
        const srcLabels: Record<string, string> = {
          facebook: 'فيس بوك', group: 'جروبات', whatsapp: 'واتساب', tiktok: 'تيك توك',
          google: 'جوجل', instagram: 'انستجرام', direct: 'مباشر', click: 'نقر بطاقة',
          phone: 'اتصال', 'ad-link': 'رابط إعلان', link: 'رابط',
        };
        const s = adStats || { totalClicks: 0, totalImpressions: 0, ctr: 0, listings: [], sources: [], days: [] };
        return (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">إحصائيات الإعلانات</h2>
              <p className="text-sm text-gray-500">النقرات والمشاهدات لكل إعلان وكل مصدر (من adAnalytics)</p>
            </div>
            <button onClick={loadTab} className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-500 transition-colors">
              <RefreshCw className="w-4 h-4" /> تحديث
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="إجمالي النقرات" value={s.totalClicks} icon={MousePointerClick} color="bg-orange-500" />
            <StatCard label="إجمالي المشاهدات" value={s.totalImpressions} icon={Eye} color="bg-blue-500" />
            <StatCard label="معدل النقر CTR" value={`${s.ctr}%`} icon={TrendingUp} color="bg-green-500" />
            <StatCard label="مصادر التتبع" value={s.sources.length} icon={Target} color="bg-purple-500" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-4">النقرات حسب المصدر</h3>
            {s.sources.length ? chartBars(Object.fromEntries(s.sources.map((x: any) => [x.source, x.clicks])), srcLabels) : <Empty label="لا توجد بيانات بعد" />}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-4">آخر 14 يوم</h3>
            <div className="flex items-end gap-2 h-32">
              {s.days.map((d: any) => {
                const total = d.clicks + d.impressions;
                const max = Math.max(1, ...s.days.map((x: any) => x.clicks + x.impressions));
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.clicks} نقر / ${d.impressions} مشاهدة`}>
                    <span className="text-xs font-bold text-gray-700">{total}</span>
                    <div className="w-full bg-gradient-to-t from-orange to-orange-300 rounded-t-lg" style={{ height: `${Math.max(6, Math.round((total / max) * 100))}%` }} />
                    <span className="text-[9px] text-gray-400">{d.day.slice(5)}</span>
                  </div>
                );
              })}
              {!s.days.length && <Empty label="لا توجد بيانات بعد" />}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">أداء كل إعلان</h3>
              <span className="text-xs text-gray-400">{s.listings.length} إعلان</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="text-right p-3">الإعلان</th>
                    <th className="text-right p-3">النقرات</th>
                    <th className="text-right p-3">المشاهدات</th>
                    <th className="text-right p-3">CTR</th>
                    <th className="text-right p-3">آخر نشاط</th>
                  </tr>
                </thead>
                <tbody>
                  {s.listings.map((l: any) => (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="p-3 font-semibold text-gray-800 max-w-[240px] truncate">{l.title}</td>
                      <td className="p-3 text-gray-600 font-bold text-orange">{l.clicks}</td>
                      <td className="p-3 text-gray-600">{l.impressions}</td>
                      <td className="p-3 text-gray-600">{l.impressions ? Math.round((l.clicks / l.impressions) * 1000) / 10 : 0}%</td>
                      <td className="p-3 text-gray-500 text-xs">{l.last ? formatDateDMY(l.last) : '—'}</td>
                    </tr>
                  ))}
                  {!s.listings.length && (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">لا توجد بيانات بعد — النقرات والمشاهدات بتتجمع هنا تلقائيًا</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        );
      }

      case 'payments': return (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">المدفوعات</h2>
            <button onClick={async () => {
              try {
                const token = await firebaseAuth.currentUser?.getIdToken();
                if (!token) return;
                const r = await fetch(`${getApiUrl()}/cleanup-expired`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                });
                const d = await r.json();
                if (d.success) toast(d.message, 'success');
                else toast(d.message || 'فشلت العملية', 'error');
              } catch { toast('خطأ في الاتصال', 'error'); }
            }}
              className="text-xs px-3 py-1.5 rounded-xl bg-orange/10 text-orange hover:bg-orange/20 font-semibold transition-colors">
              تنظيف الإعلانات المنتهية
            </button>
          </div>
          {payments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد مدفوعات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-xs">
                    <th className="text-right p-3">المستخدم</th>
                    <th className="text-right p-3">النوع</th>
                    <th className="text-right p-3">المبلغ</th>
                    <th className="text-right p-3">إثبات الدفع</th>
                    <th className="text-right p-3">الحالة</th>
                    <th className="text-right p-3">التاريخ</th>
                    <th className="text-right p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-semibold text-gray-800">{p.userName}</div>
                        <div className="text-gray-400 text-xs">{p.userEmail}</div>
                      </td>
                      <td className="p-3 text-gray-600">{p.type === 'featured_listing' ? 'مميز' : p.type === 'exhibition' ? 'معرض' : 'إعلان'}</td>
                      <td className="p-3 font-semibold text-gray-800">{p.amount} ج.م</td>
                      <td className="p-3">
                        {p.proofImage ? (
                          <a href={p.proofImage} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-orange/10 text-orange hover:bg-orange/20 transition-colors">
                            <Eye className="w-3.5 h-3.5" /> عرض
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3">{badge(p.status)}</td>
                      <td className="p-3 text-gray-500 text-xs">{p.createdAt?.slice(0,10)}</td>
                      <td className="p-3">
                        {p.status === 'pending' ? (
                          <div className="flex gap-1">
                            <button onClick={() => confirmPayment(p.id, 'paid')} className="text-xs px-2 py-1 rounded bg-success/10 text-success hover:bg-success/20">تأكيد</button>
                            <button onClick={() => confirmPayment(p.id, 'cancelled')} className="text-xs px-2 py-1 rounded bg-danger/10 text-danger hover:bg-danger/20">إلغاء</button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );

      case 'fin-companies': return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-gray-900">شركات التمويل</h2>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-bold text-gray-700">{editFinId ? 'تعديل شركة' : 'إضافة شركة جديدة'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <input value={finCompanyForm.name} onChange={e=>setFinCompanyForm(f=>({...f,name:e.target.value}))} placeholder="اسم الشركة" className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
              <input value={finCompanyForm.rate} onChange={e=>setFinCompanyForm(f=>({...f,rate:e.target.value}))} placeholder="نسبة التمويل (مثال: من 10%)" className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
              <input value={finCompanyForm.maxPeriod} onChange={e=>setFinCompanyForm(f=>({...f,maxPeriod:e.target.value}))} placeholder="المدة القصوى (مثال: 84 شهر)" className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
              <input value={finCompanyForm.phone} onChange={e=>setFinCompanyForm(f=>({...f,phone:e.target.value}))} placeholder="رقم الهاتف" className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
              <input value={finCompanyForm.whatsapp} onChange={e=>setFinCompanyForm(f=>({...f,whatsapp:e.target.value}))} placeholder="واتساب" className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">التقييم:</span>
                {[1,2,3,4,5].map(s=><button key={s} onClick={()=>setFinCompanyForm(f=>({...f,stars:s}))} className={`w-8 h-8 rounded-lg text-sm font-bold ${finCompanyForm.stars >= s ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>{s}</button>)}
              </div>
            </div>
            <textarea value={finCompanyForm.description} onChange={e=>setFinCompanyForm(f=>({...f,description:e.target.value}))} placeholder="وصف الشركة" rows={2} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={finCompanyForm.isFree} onChange={e=>setFinCompanyForm(f=>({...f,isFree:e.target.checked}))} className="w-4 h-4 rounded border-gray-300 text-orange focus:ring-orange" />
                مجاني (مشترك غير مدفوع)
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={async () => {
                if (!finCompanyForm.name) return;
                if (editFinId) {
                  await financeCompaniesService.update(editFinId, finCompanyForm);
                } else {
                  await financeCompaniesService.create(finCompanyForm as any);
                }
                setEditFinId(null); setFinCompanyForm({ name: '', description: '', rate: '', maxPeriod: '', phone: '', whatsapp: '', stars: 5, isFree: false });
                loadTab();
              }} className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-semibold text-sm">{editFinId ? 'حفظ التعديلات' : 'إضافة'}</button>
              {editFinId && <button onClick={() => { setEditFinId(null); setFinCompanyForm({ name: '', description: '', rate: '', maxPeriod: '', phone: '', whatsapp: '', stars: 5, isFree: false }); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm">إلغاء</button>}
            </div>
          </div>
          {finCompanies.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد شركات تمويل</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {finCompanies.map(fc => (
                <div key={fc.id} className={`bg-white rounded-2xl border p-5 ${fc.isFree ? 'border-amber-300' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-900">{fc.name}</h4>
                    <div className="flex gap-1">
                      {fc.isFree && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">مجاني</span>}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{fc.description}</p>
                  <div className="flex gap-3 text-xs text-gray-600 mb-3">
                    <span>نسبة: <strong>{fc.rate}</strong></span>
                    <span>المدة: <strong>{fc.maxPeriod}</strong></span>
                    <span>⭐ {fc.stars}/5</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditFinId(fc.id); setFinCompanyForm({ name: fc.name, description: fc.description || '', rate: fc.rate, maxPeriod: fc.maxPeriod, phone: fc.phone, whatsapp: fc.whatsapp, stars: fc.stars, isFree: fc.isFree || false }); }} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">تعديل</button>
                    <button onClick={async () => { if (confirm('حذف?')) { await financeCompaniesService.remove(fc.id); loadTab(); } }} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">حذف</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      case 'triage': return <TriageTab getApiUrl={getApiUrl} />;

      case 'sendad': return <SendAdChat directPublish />;

      case 'fbpublish': return <FbPublishPage getApiUrl={getApiUrl} toast={toast} />;

      case 'marketing': return <MarketingPage toast={toast} />;

      case 'video': return <VideoStudio listings={videoAds} toast={toast} />;

      case 'merchants': return <MerchantsManager getApiUrl={getApiUrl} />;

      case 'savedtitles': return <SavedTitlesPanel getApiUrl={getApiUrl} />;

      case 'notes': return <AdminNotes />;

      case 'settings': return (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-gray-900">إعدادات النظام</h2>
          <ServicesManager />
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-bold text-gray-700">معلومات المدير</h3>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg">
                {user?.name?.[0]}
              </div>
              <div>
                <p className="font-bold text-gray-800">{user?.name}</p>
                <p className="text-gray-500 text-sm">{user?.email}</p>
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold">مدير النظام</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <h3 className="font-bold text-gray-700 mb-4">إحصائيات سريعة</h3>
            {[
              ['إجمالي المستخدمين', stats?.totalUsers],
              ['إجمالي الإعلانات', stats?.totalListings],
              ['الإعلانات النشطة', stats?.activeListings],
              ['إعلانات معلقة للمراجعة', stats?.pendingListings],
              ['طلبات التمويل', stats?.financeRequests],
            ].map(([k,v])=>(
              <div key={k as string} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-600 text-sm">{k}</span>
                <span className="font-bold text-gray-800">{v ?? '—'}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-bold text-gray-700">إرسال إشعار للمستخدمين</h3>
            <input value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} placeholder="عنوان الإشعار" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
            <textarea value={notifBody} onChange={e=>setNotifBody(e.target.value)} placeholder="نص الإشعار" rows={3} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
            <input value={notifUrl} onChange={e=>setNotifUrl(e.target.value)} placeholder="رابط الفتح عند الضغط (اختياري) — مثال: /listing/abc123" dir="ltr" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
            <div className="flex gap-2">
              <button onClick={sendBroadcast} disabled={sendingNotif} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                {sendingNotif ? 'جارٍ الإرسال...' : 'إرسال للجميع'}
              </button>
              <button onClick={sendTestNotif} disabled={sendingNotif} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                إرسال تجريبي
              </button>
            </div>
            {notifMsg && <p className={`text-sm ${notifMsg.includes('تم') ? 'text-green-600' : 'text-red-500'}`}>{notifMsg}</p>}
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 border border-red-200 hover:bg-red-50 text-red-500 py-3 rounded-2xl font-semibold transition-colors">
            <LogOut className="w-5 h-5" /> تسجيل الخروج
          </button>
        </div>
      );

      default: return null;
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex">
      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 bg-[#0D1B2A] text-white flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static ${sideOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 p-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-white">كار مصر</div>
            <div className="text-xs text-gray-400">لوحة الإدارة</div>
          </div>
          <button className="lg:hidden text-gray-400 hover:text-white" onClick={() => setSideOpen(false)}><X className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {nav.map(item => (
            <button key={item.id} onClick={() => { setTab(item.id); setSideOpen(false); setSearch(''); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm mb-1 transition-colors ${
                tab === item.id ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {item.id === 'listings' && !!stats?.pendingListings && (
                <span className="mr-auto bg-yellow-400 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {stats.pendingListings}
                </span>
              )}
              {item.id === 'finance' && !!stats?.pendingFinance && (
                <span className="mr-auto bg-blue-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {stats.pendingFinance}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
              <div className="text-xs text-gray-400 truncate">{user?.email}</div>
            </div>
          </div>
          <div className="flex gap-1">
            <Link to="/" className="flex-1 text-center text-xs text-gray-400 hover:text-white py-2 rounded-lg hover:bg-white/5 transition-colors">
              الموقع
            </Link>
            <button onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1 text-xs text-red-400 hover:text-white py-2 rounded-lg hover:bg-white/5 transition-colors">
              <LogOut className="w-3.5 h-3.5" /> خروج
            </button>
          </div>
        </div>
      </aside>

      {sideOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSideOpen(false)} />}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => setSideOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-gray-800">{nav.find(n => n.id === tab)?.label}</h1>
          <div className="mr-auto flex items-center gap-2">
            <button onClick={() => setTab('listings')} className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={loadTab} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>

      {/* ── Edit User Modal ── */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">تعديل بيانات المستخدم</h3>
            <div className="space-y-3">
              {(['name','email','phone','governorate'] as const).map(field => (
                <div key={field}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    {field === 'name' ? 'الاسم' : field === 'email' ? 'البريد' : field === 'phone' ? 'الهاتف' : 'المحافظة'}
                  </label>
                  <input value={editForm[field]} onChange={e => setEditForm(f => ({...f, [field]: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">نوع الحساب</label>
                <select value={editForm.type} onChange={e => setEditForm(f => ({...f, type: e.target.value as User['type']}))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange">
                  <option value="individual">فرد</option>
                  <option value="company">شركة</option>
                  <option value="dealer">معرض</option>
                  <option value="workshop">مركز صيانة</option>
                  <option value="admin">مدير</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditUser(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                إلغاء
              </button>
              <button onClick={saveEditUser}
                className="flex-1 bg-orange hover:bg-orange-dark text-white py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Reset Modal ── */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setResetModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">تغيير كلمة السر</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newPassword || !resetModal) return;
              setResetting(true);
              try {
                const token = await firebaseAuth.currentUser?.getIdToken();
                if (!token) throw new Error('يجب تسجيل الدخول أولاً');
                const resp = await fetch(`${getApiUrl()}/admin-change-password`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ email: resetModal.email, phone: resetModal.phone, newPassword }),
                });
                const data = await resp.json();
                if (!data.success) throw new Error(data.message);
                await passwordResetsService.update(
                  resets.find(r => r.email === resetModal.email)?.id || '',
                  { status: 'completed', completedAt: new Date().toISOString(), completedBy: user?.id }
                );
                setResets(p => p.map(x => x.email === resetModal.email ? { ...x, status: 'completed' } : x));
                setResetModal(null);
                setNewPassword('');
                toast('تم تغيير كلمة السر بنجاح', 'success');
              } catch (e: any) {
                toast('فشل تغيير كلمة السر: ' + (e.details || e.message || ''), 'error');
              } finally {
                setResetting(false);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">البريد الإلكتروني</label>
                  <input value={resetModal.email} readOnly
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">رقم الهاتف</label>
                  <input value={resetModal.phone} readOnly
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">كلمة السر الجديدة</label>
                  <input type="password" value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange"
                    placeholder="أدخل كلمة السر الجديدة" required />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setResetModal(null)}
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                  إلغاء
                </button>
                <button type="submit" disabled={resetting}
                  className="flex-1 bg-orange hover:bg-orange-dark text-white py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {resetting ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري...</> : <><KeyRound className="w-4 h-4" /> حفظ</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {contactModal && (
        <div className="fixed inset-0 bg-[#0d1b2a]/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setContactModal(null)}>
          <div className="bg-white dark:bg-[#142033] rounded-t-3xl sm:rounded-3xl w-full max-w-xl shadow-2xl border border-[#e2e8f0] dark:border-[#26374d] flex flex-col max-h-[94vh] overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* header — store style */}
            <div className="p-5 sm:p-6 pb-4 border-b border-[#edf1f4] dark:border-[#1d2c41] bg-gradient-to-b from-[#f8fbfe] to-white dark:from-[#16243a] dark:to-[#142033]">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0d1b2a] to-[#16324a] text-white flex items-center justify-center shadow-lg flex-shrink-0">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-50 flex items-center gap-2 flex-wrap">
                    المشاركات العامة
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 border border-green-100 rounded-full px-2.5 py-0.5 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                      <BadgeCheck className="w-3.5 h-3.5" /> رسمي
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">تواصل مع صاحب الإعلان (واتساب/ماسنجر) + مشاركة الإعلان على صفحة كار مصر بكل صوره</p>
                </div>
                <button onClick={() => setContactModal(null)} aria-label="إغلاق"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#1d2c41] text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#26374d] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-[11px] font-semibold bg-white dark:bg-[#1d2c41] border border-[#edf1f4] dark:border-[#26374d] text-gray-600 dark:text-gray-300 rounded-full px-3 py-1">
                  {contactModal.name ? <>المرسل إلى: <b className="text-gray-900 dark:text-gray-100">{contactModal.name}</b></> : 'الاسم غير محدد'}
                </span>
                {contactModal.phone && (
                  <span className="text-[11px] font-semibold bg-white dark:bg-[#1d2c41] border border-[#edf1f4] dark:border-[#26374d] text-gray-600 dark:text-gray-300 rounded-full px-3 py-1" dir="ltr">{contactModal.phone}</span>
                )}
              </div>
            </div>

            {/* body — scrollable */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">

              {/* AI magic card */}
              <div className="rounded-2xl overflow-hidden border border-[#7c3aed]/20 dark:border-[#5b21b6]/40 shadow-lg shadow-purple-200/50 dark:shadow-none">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 font-extrabold text-sm text-purple-700 dark:text-purple-300">
                      <Sparkles className="w-5 h-5" /> رسالة دعاية ذكية
                    </div>
                    <button onClick={genPromo} disabled={promoBusy}
                      className="flex items-center gap-1.5 bg-gradient-to-br from-[#7c3aed] to-[#4c1d95] text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg shadow-purple-500/30 hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-60 disabled:hover:translate-y-0">
                      {promoBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التوليد...</> : <><Wand2 className="w-4 h-4" /> ولّد بالذكاء</>}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                    يكتب ٣ صيغ مصرية جاهزة (تجديد / ترقية مميزة / بيع أسرع) حسب بيانات الإعلان — اختار الأقرب وعدّل براحتك.
                  </p>
                  {promoErr && (
                    <p className="mt-2 text-[11px] font-bold text-red-500 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> {promoErr}
                    </p>
                  )}
                  {promoVariants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {promoVariants.map((v, i) => (
                        <button key={i} onClick={() => setContactModal(m => m ? { ...m, message: v.text } : m)}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-full border border-purple-200 dark:border-[#5b21b6]/60 text-purple-700 dark:text-purple-300 bg-white dark:bg-[#1b1e3f] hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors">
                          {v.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* message — editable card */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">💬 الرسالة (عدّلها براحتك قبل الإرسال)</label>
                </div>
                <textarea
                  value={contactModal.message}
                  onChange={e => setContactModal(m => m ? { ...m, message: e.target.value } : m)}
                  rows={6} disabled={contactModal.loading}
                  placeholder="جارٍ تجهيز الرسالة..."
                  className="w-full border border-[#e2e8f0] dark:border-[#26374d] rounded-2xl px-4 py-3 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#101d2e] focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-60 leading-relaxed resize-none" />
              </div>

              {/* advertiser data */}
              <div className="rounded-2xl border border-[#edf1f4] dark:border-[#1d2c41] p-4 space-y-3 bg-gradient-to-b from-[#fbfdff] to-white dark:from-[#152033] dark:to-[#142033]">
                <p className="text-[11px] font-extrabold text-gray-500 dark:text-gray-400">📋 بيانات المعلن — تُحفظ على الإعلان</p>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">👤 اسم المعلن</label>
                  <input value={contactModal.name} onChange={e => setContactModal(m => m ? { ...m, name: e.target.value } : m)}
                    placeholder="اكتب اسم المعلن ..." disabled={contactModal.loading}
                    className="w-full border border-[#e2e8f0] dark:border-[#26374d] rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#101d2e] focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">📘 لينك فيسبوك المعلن</label>
                  <input dir="ltr" value={contactModal.facebook} onChange={e => setContactModal(m => m ? { ...m, facebook: e.target.value } : m)}
                    placeholder="https://facebook.com/... أو m.me/..." disabled={contactModal.loading}
                    className="w-full text-left border border-[#e2e8f0] dark:border-[#26374d] rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#101d2e] focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">📞 رقم موبايل المعلن</label>
                  <input dir="ltr" value={contactModal.phone} onChange={e => setContactModal(m => m ? { ...m, phone: e.target.value } : m)}
                    placeholder="01000000000" disabled={contactModal.loading}
                    className="w-full text-left border border-[#e2e8f0] dark:border-[#26374d] rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#101d2e] focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={() => contactModal && requestContact(contactModal.id, contactModal.facebook, contactModal.phone, true, contactModal.name)}
                    disabled={contactModal.loading}
                    className="flex items-center gap-1.5 text-xs font-bold border border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 bg-white dark:bg-[#101d2e] px-3.5 py-2 rounded-full hover:border-green-400 hover:text-green-600 dark:hover:text-green-300 transition-colors disabled:opacity-50">
                    <Check className="w-4 h-4" /> حفظ بيانات المعلن
                  </button>
                </div>
              </div>
            </div>

            {/* footer — action pills */}
            <div className="px-6 pb-6 pt-1 space-y-2.5">
              {contactModal.message?.startsWith('فشل') || contactModal.message?.startsWith('الخادم رد') || contactModal.message?.startsWith('خطأ في السيرفر') || contactModal.message?.startsWith('تعذر') || contactModal.message === 'حدث خطأ في الاتصال بالسيرفر' ? (
                <p className="text-sm text-red-500 font-semibold">{contactModal.message}</p>
              ) : (
                <>
                  {!contactModal.loading && (() => {
                    const { waLink, msLink } = buildContactLinks(contactModal.phone, contactModal.facebook, contactModal.message);
                    const fbPost = !msLink && isFacebookLink(contactModal.facebook) ? contactModal.facebook : null;
                    return (
                      <>
                        <button onClick={() => waLink && window.open(waLink, '_blank', 'noopener')}
                          className={`flex items-center justify-center gap-2 w-full bg-gradient-to-l from-[#01875f] to-emerald-600 hover:from-[#017a53] hover:to-emerald-700 text-white py-3.5 rounded-2xl font-extrabold shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 hover:shadow-xl transition-all ${!waLink && 'opacity-40 pointer-events-none'}`}>
                          <Phone className="w-4 h-4" /> إرسال عبر واتساب
                        </button>
                        <button onClick={() => (msLink || fbPost) && window.open(msLink || fbPost || undefined, '_blank', 'noopener')}
                          className={`flex items-center justify-center gap-2 w-full bg-gradient-to-l from-[#1a73e8] to-blue-500 hover:from-[#1765cc] hover:to-blue-600 text-white py-3.5 rounded-2xl font-extrabold shadow-lg shadow-blue-500/25 hover:-translate-y-0.5 hover:shadow-xl transition-all ${!msLink && !fbPost && 'opacity-40 pointer-events-none'}`}>
                          <MessageCircle className="w-4 h-4" /> {msLink ? 'إرسال عبر ماسنجر' : fbPost ? 'فتح المعلن على فيسبوك' : 'إرسال عبر ماسنجر'}
                        </button>
                        {!waLink && (
                          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 text-center -mt-1">
                            أضف رقم المعلن (01…) لتفعيل واتساب
                          </p>
                        )}
                        {!msLink && (
                          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 text-center -mt-1">
                            {fbPost ? 'ماسنجر مش متاح للحساب ده — الزرار فتح منشور المعلن في فيسبوك، تقدر تكلمه من هناك' : 'أضف لينك فيسبوك صحيح للمعلن لتفعيل ماسنجر (لينكات الجروبات لا تعمل)'}
                          </p>
                        )}
                        <button onClick={() => navigator.clipboard?.writeText(contactModal.message).then(() => toast('تم نسخ الرسالة', 'success'))}
                          className="flex items-center justify-center gap-2 w-full bg-gray-100 dark:bg-[#1d2c41] hover:bg-gray-200 dark:hover:bg-[#26374d] text-gray-700 dark:text-gray-200 py-3 rounded-2xl font-bold transition-colors">
                          <FileText className="w-4 h-4" /> نسخ الرسالة
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
              <button onClick={() => { setContactModal(null); setPromoVariants([]); setPromoErr(''); }}
                className="w-full text-center text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 py-1 transition-colors">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      {publishModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !pubBusy && setPublishModal(null)}>
          <div className="bg-white dark:bg-[#142033] rounded-3xl w-full max-w-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#26374d] flex flex-col max-h-[94vh] overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-[#edf1f4] dark:border-[#1d2c41] bg-gradient-to-b from-[#f8fbfe] to-white dark:from-[#16243a] dark:to-[#142033]">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-600 text-white flex items-center justify-center shadow-lg flex-shrink-0">
                  <Send className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-50">النشر بالضغطة الواحدة</h3>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{publishModal.listing.title}</p>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 flex-wrap">
                    <CheckCircle className="w-3 h-3" /> ١) صفحة كار مصر • ٢) الجروبات • ٣) إشعار المعلن المجاني
                  </p>
                </div>
                <button onClick={() => setPublishModal(null)} aria-label="إغلاق"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#1d2c41] text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#26374d] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              {pubErr && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-sm font-semibold px-4 py-3">{pubErr}</div>
              )}
              {pubFetchErr && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-300 text-sm font-semibold px-4 py-3">{pubFetchErr}</div>
              )}
              {!pubResult && (
                <div className={`rounded-xl px-4 py-3 text-[11px] font-bold flex items-start gap-2 leading-relaxed ${pubSource.source === 'profile'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'}`}>
                  <Send className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {pubSource.source === 'profile'
                    ? <>النشر باسم <b>حسابك المباشر {pubSource.username || 'mashroey.bns'}</b> — الجروبات هتتنشر منه مباشرة</>
                    : <>النشر باسم <b>صفحة TareeqEG</b> — ولو عايز تنشر على حسابك شخصيًا استخدم زر «نسخ + افتح فيسبوك» اللي تحت</>}
                </div>
              )}

              {!pubResult ? (
                <>
                  {/* جروبات النشر */}
                  <div className="rounded-2xl border border-[#edf1f4] dark:border-[#1d2c41] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-extrabold text-sm text-gray-700 dark:text-gray-200">
                        <Users className="w-4 h-4 text-emerald-600" /> جروبات النشر
                        <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">(علّم الجروبات اللي تنشر فيها)</span>
                      </div>
                      <button onClick={runFbDiag} disabled={pubDiagBusy}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 shrink-0">
                        {pubDiagBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />} تشخيص النشر
                      </button>
                    </div>
                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> حماية الحساب: {pubLimits.perRun || 3} جروبات بالدورة + {pubLimits.perDay || 15} باليوم — الباقي يتأجل للدورة اللي بعدها
                    </p>
                    {pubDiag && (
                      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/15 p-3 text-[11px] space-y-1.5 leading-relaxed">
                        {pubDiag.error ? (
                          <p className="font-bold text-red-600 dark:text-red-400">✗ {pubDiag.error}</p>
                        ) : (
                          <>
                            <p className="font-extrabold text-gray-700 dark:text-gray-200">نتيجة التشخيص — نسخة Graph {pubDiag.graph}</p>
                            <p className="text-gray-600 dark:text-gray-300">
                              {pubDiag.tokenSource ? '✓' : '✗'} مصدر التوكن: <b>{pubDiag.tokenSource === 'stored' ? 'المحفوظ في التطبيق' : pubDiag.tokenSource === 'env' ? 'FB_PAGE_ACCESS_TOKEN في Vercel' : 'مفيش توكن خالص'}</b>
                              {pubDiag.tokenLength ? ` (${pubDiag.tokenLength} حرف)` : ''}
                            </p>
                            <p className={pubDiag.tokenCheck?.ok ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                              {pubDiag.tokenCheck?.ok ? `✓ التوكن شغال — ${pubDiag.tokenCheck.name || pubDiag.tokenCheck.id}` : `✗ التوكن: ${pubDiag.tokenCheck?.error || 'غير صالح'}`}
                            </p>
                            {pubDiag.pageCheck && (
                              <p className={pubDiag.pageCheck.ok ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                                {pubDiag.pageCheck.ok ? `✓ صفحة ${pubDiag.pageUsername} — ${pubDiag.pageCheck.name} (id ${pubDiag.pageCheck.id})` : `✗ صفحة ${pubDiag.pageUsername}: ${pubDiag.pageCheck.error}`}
                              </p>
                            )}
                            <p className="text-gray-600 dark:text-gray-300">
                              الجروبات: <b>{pubDiag.groups?.total ?? '؟'}</b> محفوظة — {pubDiag.groups?.enabled ?? 0} مفعّلة — {pubDiag.groups?.cooling ?? 0} في هدنة
                              {pubDiag.groups?.error ? ` — ✗ ${pubDiag.groups.error}` : ''}
                            </p>
                            <p className="text-gray-600 dark:text-gray-300">توكن الشخصي: {pubDiag.userToken}</p>
                            {!pubDiag.tokenCheck?.ok && !pubDiag.tokenSource && (
                              <p className="font-bold text-amber-700 dark:text-amber-400">لازم تضيف FB_PAGE_ACCESS_TOKEN في Vercel ← Settings → Environment Variables، وبعدين Deployments → Redeploy</p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {fbGroups.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                        مفيش جروبات محفوظة — الصق لينك جروب أو عدّة لينكات من تحت (سطر لكل واحد) واضغط «إضافة الكل»، واللي بيفتح معاه الصفحة نضيفه فورًا. <b className="text-amber-600 dark:text-amber-400">تنبيه:</b> صفحة TareeqEG لازم تكون عضو في الجروب قبل النشر.
                      </p>
                    )}

                    <FbGroupsGrabCard toast={toast} />
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {fbGroups.map(g => (
                        <div key={g.id} className="flex items-center justify-between gap-2 bg-white dark:bg-[#101d2e] border border-[#e2e8f0] dark:border-[#26374d] rounded-xl px-3 py-2">
                          <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                            <input type="checkbox" checked={!!pubSel[g.id]} onChange={e => setPubSel(s => ({ ...s, [g.id]: e.target.checked }))}
                              className="w-4 h-4 accent-emerald-600" />
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">{g.name}</span>
                      <input type="text" value={g.tag || ''} placeholder="tag" onChange={e => { const v = e.target.value; setFbGroups(p => p.map(x => x.id === g.id ? { ...x, tag: v } : x)); }} onBlur={e => { const tag = e.target.value.trim(); setFbGroups(p => p.map(x => x.id === g.id ? { ...x, tag } : x)); const u = firebaseAuth.currentUser; if (!u) return; u.getIdToken().then(tok => fetch(`${getApiUrl()}/whatsapp-notify?action=fb-groups`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` }, body: JSON.stringify({ sub: 'tag', id: g.id, tag }) }).then(r => r.json()).then(data => { if (data && data.success && Array.isArray(data.groups)) setFbGroups(data.groups as FbGroup[]); }).catch(() => {})).catch(() => {}); }} className="w-16 text-[10px] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 bg-white dark:bg-[#101d2e] focus:outline-none focus:border-orange" />
                            {(() => { const t = Date.parse(String(g.lastPostedAt || '')); const cooling = t > 0 && Date.now() - t < fbCoolingHours * 3600 * 1000; return cooling
                              ? <span className="text-[9px] font-extrabold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded shrink-0">هدنة</span>
                              : null; })()}
                            <a href={g.url} target="_blank" rel="noreferrer" dir="ltr"
                              className="text-[10px] text-blue-500 hover:underline truncate hidden sm:inline">{g.url}</a>
                          </label>
                          <button onClick={() => deleteFbGroupAdmin(g.id)} title="حذف الجروب"
                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">⚠️ استيراد API مبقى شغّال — فيسبوك شال صلاحية <b dir="ltr">groups_access_member_info</b> في ٢٠٢٤. استخدم «السحب السريع» (Bookmarklet) فوق، أو الصق اللينكات تحت.</p>
                    <textarea dir="ltr" value={pubImportTok} onChange={e => setPubImportTok(e.target.value)} rows={2}
                      placeholder="EAAB... (توكن الاستيراد — اختياري)"
                      className="w-full text-left text-xs border border-[#e2e8f0] dark:border-[#26374d] rounded-xl px-3 py-2 bg-white dark:bg-[#101d2e] focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-1.5" />
                    <button onClick={importMyGroups} disabled={pubImportBusy}
                      className="w-full flex items-center justify-center gap-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2.5 rounded-xl transition-colors disabled:opacity-60">
                      {pubImportBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} استورد كل جروباتي من فيسبوك (مرة واحدة)
                    </button>
                    <div>
                      <textarea dir="ltr" value={pubGroupLink} onChange={e => setPubGroupLink(e.target.value)} rows={8} placeholder={'الصق لينك جروب أو أكتر هنا —\nhttps://www.facebook.com/groups/123456789/\nhttps://www.facebook.com/groups/abcdef/'}
                        className="w-full text-left border border-[#e2e8f0] dark:border-[#26374d] rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#101d2e] focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">استخراج تلقائي لكل لينكات الجروبات من أي نص تلصقه — اِلصق قائمتك كاملة لو عايز.</p>
                        <button onClick={saveFbGroupAdmin} disabled={pubGroupBusy}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-60 shrink-0">
                          {pubGroupBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إضافة الكل
                        </button>
                      </div>
                    </div>
                    {pubGroupMsg && <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{pubGroupMsg}</p>}
                  </div>

                  <FbCampaignCard
                    campaign={pubCampaign}
                    busy={pubCampaignBusy}
                    onRefresh={loadCampaign}
                    onStart={() => startCampaign()}
                    onStop={stopCampaign}
                    onTick={tickCampaign}
                    onResume={resumeCampaign}
                  />
                </>
              ) : (
                <>
                  {/* نتيجة النشر */}
                  <div className="space-y-2.5">
                    <div className="text-sm font-extrabold text-gray-700 dark:text-gray-200">نظرة على اللي حصل</div>

                    {pubResult.reasons && pubResult.reasons.length > 0 && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] font-bold px-4 py-3 space-y-1 leading-relaxed">
                        {pubResult.reasons.map((r: string, i: number) => <p key={i}>⚠️ {r}</p>)}
                      </div>
                    )}

                    {/* الصفحة */}
                    <div className="rounded-xl border border-[#edf1f4] dark:border-[#1d2c41] p-3.5 flex items-start gap-2.5">
                      {pubResult.page?.ok ? <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-gray-800 dark:text-gray-100">
                          {pubResult.source === 'profile'
                            ? `حسابك المباشر ${pubResult.sourceUsername || 'mashroey.bns'}`
                            : 'صفحة TareeqEG'}{'. '}
                          {pubResult.page?.postId && <a href={`https://www.facebook.com/${pubResult.page.postId}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">عرض البوست ↗</a>}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                          {pubResult.page?.ok
                            ? (pubResult.page.alreadyPosted ? 'الإعلان منشور من قبل — متكررش.' : `اتنشر ✓ (${pubResult.page.images ?? 0} صور)`)
                            : (pubResult.page ? pubResult.page.error : (pubResult.error || 'مفيش توكن فيسبوك — اضغط «ربط فيسبوك» من اللوحة أو جدّد FB_PAGE_ACCESS_TOKEN في إعدادات Vercel'))}
                        </p>
                      </div>
                    </div>

                    {/* الجروبات */}
                    <div className="rounded-xl border border-[#edf1f4] dark:border-[#1d2c41] p-3.5 space-y-1.5">
                      <p className="text-xs font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-600" /> الجروبات ({pubResult.groups?.length ?? 0}) — ناجح {(pubResult.groups || []).filter((g: any) => g.ok).length}
                      </p>
                      {(pubResult.groups?.length ?? 0) === 0 && <p className="text-[11px] text-gray-400 dark:text-gray-500">مافيش جروبات محددة في المرة دي</p>}
                      {pubResult.groups?.map((g: any, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          {g.ok === null || g.deferred
                            ? <Loader2 className="w-4 h-4 text-amber-500 mt-0.5 shrink-0 animate-spin" />
                            : g.ok
                              ? <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                              : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">{g.name}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                              {g.ok === null || g.deferred
                                ? <span className="text-amber-600 dark:text-amber-400">{g.error || 'اتأجل للدفعة الجاية'}</span>
                                : g.ok ? <>اتنشر ✓ {g.postId && <a href={`https://www.facebook.com/${g.postId}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">عرض البوست ↗</a>}</> : g.error}
                            </p>
                          </div>
                        </div>
                      ))}
                      {pubResult.groups?.some((g: any) => g.ok === false) && (
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 leading-relaxed">
                          ملاحظة: لو الجروب رفض — تأكد إن صفحة TareeqEG عضو في الجروب وإن الجروب بيسمح بالنشر باسم الصفحات (مش كله بيسمح).
                        </p>
                      )}
                    </div>

                    {/* إشعار المعلن */}
                    <div className="rounded-2xl border border-[#edf1f4] dark:border-[#1d2c41] p-4 bg-gradient-to-b from-[#fbfdff] to-white dark:from-[#152033] dark:to-[#142033]">
                      <p className="text-xs font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-1.5 mb-2">
                        <Phone className="w-4 h-4 text-green-600" /> إشعار المعلن بالإعلان المجاني{pubResult.contact?.name ? ` — ${pubResult.contact.name}` : ''}
                      </p>
                      <textarea value={pubMsg} onChange={e => setPubMsg(e.target.value)} rows={5}
                        className="w-full border border-[#e2e8f0] dark:border-[#26374d] rounded-2xl px-4 py-3 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-[#101d2e] focus:outline-none focus:ring-2 focus:ring-green-400 leading-relaxed resize-none" />
                      {(() => { const { waLink, msLink } = buildContactLinks(pubPhone, pubFacebook, pubMsg); return (
                        <div className="flex flex-col gap-2 mt-3">
                          <button onClick={() => waLink && window.open(waLink, '_blank', 'noopener')}
                            className={`flex items-center justify-center gap-2 w-full bg-gradient-to-l from-[#01875f] to-emerald-600 hover:from-[#017a53] hover:to-emerald-700 text-white py-3 rounded-2xl font-extrabold shadow-lg shadow-emerald-500/25 transition-all ${!waLink && 'opacity-40 pointer-events-none'}`}>
                            <Phone className="w-4 h-4" /> إرسال عبر واتساب
                          </button>
                          <button onClick={() => msLink && window.open(msLink, '_blank', 'noopener')}
                            className={`flex items-center justify-center gap-2 w-full bg-gradient-to-l from-[#1a73e8] to-blue-500 hover:from-[#1765cc] hover:to-blue-600 text-white py-3 rounded-2xl font-extrabold shadow-lg shadow-blue-500/25 transition-all ${!msLink && 'opacity-40 pointer-events-none'}`}>
                            <MessageCircle className="w-4 h-4" /> إرسال عبر ماسنجر
                          </button>
                          {!waLink && <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 text-center">أضف رقم المعلن (01…) على مخزن الإعلان لتفعيل واتساب</p>}
                          {!msLink && <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 text-center">أضف لينك فيسبوك صحيح للمعلن لتفعيل ماسنجر</p>}
                          <button onClick={() => navigator.clipboard?.writeText(pubMsg).then(() => toast('تم نسخ الرسالة', 'success'))}
                            className="flex items-center justify-center gap-2 w-full bg-gray-100 dark:bg-[#1d2c41] hover:bg-gray-200 dark:hover:bg-[#26374d] text-gray-700 dark:text-gray-200 py-2.5 rounded-2xl font-bold transition-colors">
                            <FileText className="w-4 h-4" /> نسخ الرسالة
                          </button>
                        </div>
                      ); })()}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* footer */}
            <div className="px-6 pb-6 pt-1">
              {!pubResult ? (
                  <button onClick={runPublishAd} disabled={pubBusy}
                    className="flex items-center justify-center gap-2 w-full bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-2xl font-extrabold shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-60 disabled:hover:translate-y-0">
                    {pubBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ النشر...</> : <><Send className="w-4 h-4" /> نشر الإعلان كاملاً</>}
                  </button>
              ) : (
<button onClick={() => { setPubResult(null); setPubErr(''); }} disabled={pubBusy}
                    className="flex items-center justify-center gap-2 w-full bg-gray-100 dark:bg-[#1d2c41] hover:bg-gray-200 dark:hover:bg-[#26374d] text-gray-700 dark:text-gray-200 py-3 rounded-2xl font-bold transition-colors">
                    <RefreshCw className="w-4 h-4" /> نشر الدفعة الجاية (المتأجلة من اللي فات)
                  </button>
              )}
              <button onClick={() => setPublishModal(null)}
                className="w-full text-center text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 py-2 transition-colors">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      {fixModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !fixModal.applying && setFixModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2"><Wand2 className="w-5 h-5 text-purple-500" /> إصلاح الإعلان بالذكاء الاصطناعي</h3>
            {fixModal.loading ? (
              <div className="py-10 flex flex-col items-center gap-3 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                <p className="text-sm">يحلّل الإعلان ويُجهّز إصلاحات عملية...</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-1 truncate">{fixModal.listing.title}</p>
                {fixModal.fixes.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">لا توجد إصلاحات آلية مقترحة — الإعلان يحتاج مراجعة يدوية من المحرر.</p>
                ) : (
                  <div className="space-y-2 my-4">
                    {fixModal.fixes.map((fix, i) => (
                      <div key={i} className="border border-purple-100 bg-purple-50/50 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-purple-700 mb-1">{fix.fieldLabel || fix.field}</p>
                            <p className="text-sm text-gray-800 break-words whitespace-pre-line">{String(fix.value).slice(0, 400)}</p>
                            <p className="text-[11px] text-gray-500 mt-1">{fix.reason}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setFixModal(null)} disabled={fixModal.applying}
                    className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
                    إلغاء
                  </button>
                  <button onClick={applyFixesAndEdit} disabled={fixModal.applying || fixModal.fixes.length === 0}
                    className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {fixModal.applying ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التطبيق...</> : <><Wand2 className="w-4 h-4" /> تطبيق الإصلاحات وفتح التعديل</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SeedButton({ onSeeded }: { onSeeded: () => void }) {
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSeed = async () => {
    if (!confirm('سيتم إنشاء إعلانات تجريبية في كل الأقسام. هل أنت متأكد؟')) return;
    setSeeding(true);
    setResult(null);
    try {
      const { seedData } = await import('../../lib/firestoreService');
      const r = await seedData();
      setResult(`✅ تم إنشاء ${r.listings} إعلان، ${r.loads} حمولة، ${r.jobs} وظيفة`);
      onSeeded();
    } catch (err) {
      setResult('❌ فشل: ' + (err instanceof Error ? err.message : 'خطأ غير متوقع'));
    }
    setSeeding(false);
  };

  const handleDelete = async () => {
    if (!confirm('سيتم حذف جميع البيانات التجريبية. هل أنت متأكد؟')) return;
    setSeeding(true);
    setResult(null);
    try {
      const { deleteSeedData } = await import('../../lib/firestoreService');
      const r = await deleteSeedData();
      setResult(`🗑️ تم حذف ${r.listings} إعلان، ${r.loads} حمولة، ${r.jobs} وظيفة`);
      onSeeded();
    } catch (err) {
      setResult('❌ فشل: ' + (err instanceof Error ? err.message : 'خطأ غير متوقع'));
    }
    setSeeding(false);
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
      <button onClick={handleSeed} disabled={seeding}
        className="w-full bg-gradient-to-l from-navy to-navy-light text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
        {seeding ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري...</> : <><RefreshCw className="w-4 h-4" /> زرع بيانات تجريبية</>}
      </button>
      <button onClick={handleDelete} disabled={seeding}
        className="w-full border border-red-200 text-red-500 py-2.5 rounded-xl font-bold hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        <Trash2 className="w-4 h-4" /> حذف البيانات التجريبية
      </button>
      {result && <p className="text-sm text-center font-semibold" style={{color: result.startsWith('✅') || result.startsWith('🗑️') ? '#10B981' : '#EF4444'}}>{result}</p>}
    </div>
  );
}

const Empty = ({ label }: { label: string }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
    <p>لا توجد {label} حالياً</p>
  </div>
);

const PAGE_SIZE = 20;

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (last <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-6" dir="ltr">
      <button onClick={() => onChange(page + 1)} disabled={page >= last}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 hover:border-orange disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        التالي ←
      </button>
      <span className="text-sm text-gray-500">{page} من {last}</span>
      <button onClick={() => onChange(page - 1)} disabled={page <= 1}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 hover:border-orange disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        → السابق
      </button>
    </div>
  );
}