import { useEffect, useMemo, useState } from 'react';
import {
  Calculator, Truck, User, Users, Calendar, Plus, Copy, Trash2, Save, Share2,
  History, Fuel, Wallet, Mountain, Loader2, Pencil, RotateCcw, ChevronDown,
  TrendingUp, TrendingDown, Info,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/auth';
import { shiftsService } from '../lib/firestoreService';
import { formatPrice, generateId } from '../lib/utils';
import { toast } from '../components/Toast';
import SeoHead from '../components/SeoHead';
import type { Shift } from '../types';

const DRAFT_KEY = 'tareeq_shift_draft_v1';
const inp = 'w-full border border-border rounded-xl px-3 py-2 text-sm bg-bg focus:outline-none focus:border-orange';

interface TripDraft {
  id: string;
  client: string;
  cargo: string;
  quarry: string;
  from: string;
  to: string;
  fare: string;
}

interface ShiftMeta {
  date: string;
  truck: string;
  driver: string;
  assistant: string;
}

interface ExpenseDraft {
  diesel: string;
  salaries: string;
  custody: string;
  other: string;
}

interface Draft {
  meta: ShiftMeta;
  trips: TripDraft[];
  expenses: ExpenseDraft;
  quarryFees: Record<string, string>;
  notes: string;
  editingId: string | null;
}

function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function num(value: unknown): number {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function emptyTrip(): TripDraft {
  return { id: generateId(), client: '', cargo: '', quarry: '', from: '', to: '', fare: '' };
}

function emptyDraft(driver = ''): Draft {
  return {
    meta: { date: todayISO(), truck: '', driver, assistant: '' },
    trips: [emptyTrip()],
    expenses: { diesel: '', salaries: '', custody: '', other: '' },
    quarryFees: {},
    notes: '',
    editingId: null,
  };
}

function readDraft(driver = ''): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft(driver);
    const saved = JSON.parse(raw) as Partial<Draft>;
    const base = emptyDraft(driver);
    return {
      meta: { ...base.meta, ...(saved.meta || {}) },
      trips: Array.isArray(saved.trips) && saved.trips.length
        ? saved.trips.map(t => ({ ...emptyTrip(), ...t }))
        : base.trips,
      expenses: { ...base.expenses, ...(saved.expenses || {}) },
      quarryFees: saved.quarryFees && typeof saved.quarryFees === 'object' ? saved.quarryFees : {},
      notes: typeof saved.notes === 'string' ? saved.notes : '',
      editingId: typeof saved.editingId === 'string' ? saved.editingId : null,
    };
  } catch {
    return emptyDraft(driver);
  }
}

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function shiftDateLabel(iso: string): string {
  if (!iso) return 'بدون تاريخ';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-bold text-text-light">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

export default function ShiftCalculator() {
  const { user } = useAuth();
  const me = user || auth.getUser();
  const isAdmin = me?.type === 'admin';

  const [draft, setDraft] = useState<Draft>(() => readDraft(me?.name || ''));
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Shift[]>([]);
  const [historyLoading, setHistoryLoading] = useState(() => !!me?.id);
  const [showAll, setShowAll] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { meta, trips, expenses, quarryFees, notes, editingId } = draft;

  // حفظ مسودة تلقائيًا حتى لو التطبيق اتقفل في نص الوردية
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // التخزين المحلي ممتلئ أو غير متاح — الحفظ السحابي يظل شغال
    }
  }, [draft]);

  useEffect(() => {
    if (!me?.id) return;
    let cancelled = false;
    setHistoryLoading(true);
    const request = showAll && isAdmin ? shiftsService.getAll() : shiftsService.getMine(me.id);
    request
      .then(rows => { if (!cancelled) setHistory(rows); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [me?.id, isAdmin, showAll, refreshKey]);

  const quarries = useMemo(() => {
    const seen = new Set<string>();
    for (const trip of trips) {
      const quarry = trip.quarry.trim();
      if (quarry) seen.add(quarry);
    }
    return [...seen];
  }, [trips]);

  const revenue = useMemo(() => trips.reduce((sum, trip) => sum + num(trip.fare), 0), [trips]);
  const quarryTotal = useMemo(
    () => quarries.reduce((sum, quarry) => sum + num(quarryFees[quarry]), 0),
    [quarries, quarryFees],
  );
  const otherExpenses = num(expenses.diesel) + num(expenses.salaries) + num(expenses.custody) + num(expenses.other);
  const totalExpenses = quarryTotal + otherExpenses;
  const net = revenue - totalExpenses;
  const tripCount = trips.filter(t => t.client.trim() || t.cargo.trim() || num(t.fare) > 0).length;

  const patchMeta = (patch: Partial<ShiftMeta>) =>
    setDraft(d => ({ ...d, meta: { ...d.meta, ...patch } }));

  const patchExpense = (key: keyof ExpenseDraft, value: string) =>
    setDraft(d => ({ ...d, expenses: { ...d.expenses, [key]: value } }));

  const patchTrip = (id: string, patch: Partial<TripDraft>) =>
    setDraft(d => ({ ...d, trips: d.trips.map(t => (t.id === id ? { ...t, ...patch } : t)) }));

  const addTrip = () =>
    setDraft(d => ({ ...d, trips: [...d.trips, emptyTrip()] }));

  const duplicateLastTrip = () =>
    setDraft(d => {
      const last = d.trips[d.trips.length - 1];
      return { ...d, trips: [...d.trips, last ? { ...last, id: generateId() } : emptyTrip()] };
    });

  const removeTrip = (id: string) =>
    setDraft(d => ({
      ...d,
      trips: d.trips.length > 1 ? d.trips.filter(t => t.id !== id) : [emptyTrip()],
    }));

  const resetForm = () => {
    if (!confirm('مسح بيانات الوردية الحالية والبدء من جديد؟')) return;
    const next = emptyDraft(meta.driver);
    next.meta.truck = meta.truck;
    next.meta.assistant = meta.assistant;
    setDraft(next);
    toast('جاهز لوردية جديدة', 'info');
  };

  const handleSave = async () => {
    if (!me?.id) {
      toast('سجّل الدخول أولًا لحفظ الوردية', 'error');
      return;
    }
    if (!meta.truck.trim()) {
      toast('اكتب اسم أو رقم العربية الأول', 'error');
      return;
    }

    const cleanTrips = trips
      .map(t => ({
        id: t.id,
        client: t.client.trim(),
        cargo: t.cargo.trim(),
        quarry: t.quarry.trim(),
        from: t.from.trim(),
        to: t.to.trim(),
        fare: num(t.fare),
      }))
      .filter(t => t.client || t.cargo || t.quarry || t.fare > 0);

    if (!cleanTrips.length && totalExpenses <= 0) {
      toast('أضف نقلة أو مصروف واحد على الأقل', 'error');
      return;
    }

    const cleanQuarryFees: Record<string, number> = {};
    for (const quarry of quarries) cleanQuarryFees[quarry] = num(quarryFees[quarry]);

    const cleanExpenses = {
      diesel: num(expenses.diesel),
      salaries: num(expenses.salaries),
      custody: num(expenses.custody),
      other: num(expenses.other),
    };
    const cleanRevenue = cleanTrips.reduce((sum, trip) => sum + trip.fare, 0);
    const cleanTotalExpenses =
      cleanExpenses.diesel + cleanExpenses.salaries + cleanExpenses.custody + cleanExpenses.other +
      Object.values(cleanQuarryFees).reduce((sum, value) => sum + value, 0);

    const payload = {
      userId: me.id,
      userName: me.name || '',
      date: meta.date || todayISO(),
      truck: meta.truck.trim(),
      driver: meta.driver.trim(),
      assistant: meta.assistant.trim(),
      trips: cleanTrips,
      expenses: cleanExpenses,
      quarryFees: cleanQuarryFees,
      revenue: cleanRevenue,
      totalExpenses: cleanTotalExpenses,
      net: cleanRevenue - cleanTotalExpenses,
      notes: notes.trim(),
    };

    setSaving(true);
    try {
      if (editingId) {
        await shiftsService.update(editingId, payload);
        toast('تم تحديث الوردية ✓', 'success');
      } else {
        await shiftsService.create({ ...payload, updatedAt: new Date().toISOString() });
        toast('تم حفظ الوردية ✓', 'success');
      }
      const next = emptyDraft(meta.driver);
      next.meta.truck = meta.truck;
      next.meta.assistant = meta.assistant;
      setDraft(next);
      setRefreshKey(key => key + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast('تعذّر الحفظ — بياناتك محفوظة كمسودة على الجهاز', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openShift = (shift: Shift) => {
    const shiftTrips = Array.isArray(shift.trips) ? shift.trips : [];
    setDraft({
      meta: {
        date: shift.date || todayISO(),
        truck: shift.truck || '',
        driver: shift.driver || '',
        assistant: shift.assistant || '',
      },
      trips: shiftTrips.length
        ? shiftTrips.map(t => ({
            id: t.id || generateId(),
            client: t.client || '',
            cargo: t.cargo || '',
            quarry: t.quarry || '',
            from: t.from || '',
            to: t.to || '',
            fare: t.fare ? String(t.fare) : '',
          }))
        : [emptyTrip()],
      expenses: {
        diesel: shift.expenses?.diesel ? String(shift.expenses.diesel) : '',
        salaries: shift.expenses?.salaries ? String(shift.expenses.salaries) : '',
        custody: shift.expenses?.custody ? String(shift.expenses.custody) : '',
        other: shift.expenses?.other ? String(shift.expenses.other) : '',
      },
      quarryFees: Object.fromEntries(
        Object.entries(shift.quarryFees || {}).map(([key, value]) => [key, value ? String(value) : '']),
      ),
      notes: shift.notes || '',
      editingId: shift.id,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('تم تحميل الوردية للتعديل', 'info');
  };

  const deleteShift = async (shift: Shift) => {
    if (!confirm(`حذف وردية ${shiftDateLabel(shift.date)}؟`)) return;
    try {
      await shiftsService.delete(shift.id);
      if (editingId === shift.id) setDraft(emptyDraft(me?.name || ''));
      setRefreshKey(key => key + 1);
      toast('تم حذف الوردية', 'success');
    } catch {
      toast('تعذّر حذف الوردية', 'error');
    }
  };

  const buildSummary = (): string => {
    const lines: string[] = [`🧾 وردية ${shiftDateLabel(meta.date)}`, `العربية: ${meta.truck || '—'}`];
    if (meta.driver || meta.assistant) {
      lines.push(`السواق: ${meta.driver || '—'}${meta.assistant ? ` | التباع: ${meta.assistant}` : ''}`);
    }
    lines.push('', `— النقلات (${tripCount}) —`);
    trips.forEach((trip, index) => {
      if (!trip.client.trim() && !trip.cargo.trim() && num(trip.fare) <= 0) return;
      const quarry = trip.quarry.trim() ? ` — ${trip.quarry.trim()}` : '';
      lines.push(`${index + 1}) ${trip.client.trim() || 'عميل'} — ${trip.cargo.trim() || 'حمولة'}${quarry} — ${formatPrice(num(trip.fare))}`);
    });
    lines.push('', '— المصروفات —');
    lines.push(`سولار: ${formatPrice(num(expenses.diesel))} | مرتبات: ${formatPrice(num(expenses.salaries))} | عهدة: ${formatPrice(num(expenses.custody))}`);
    if (quarryTotal > 0) lines.push(`رسوم المحاجر: ${formatPrice(quarryTotal)}`);
    if (num(expenses.other) > 0) lines.push(`مصاريف أخرى: ${formatPrice(num(expenses.other))}`);
    lines.push('', `الإيراد: ${formatPrice(revenue)}`, `المصروف: ${formatPrice(totalExpenses)}`, `الصافي: ${formatPrice(net)}`);
    return lines.join('\n');
  };

  const shareSummary = async () => {
    const text = buildSummary();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'وردية كار مصر', text });
        return;
      }
    } catch {
      // المستخدم قفل نافذة المشاركة — نكمل للنسخ
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('تم نسخ ملخص الوردية', 'success');
    } catch {
      toast('تعذّر نسخ الملخص', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-24 sm:pb-10">
      <SeoHead title="حاسبة الوردية" description="احسب إيرادات ومصروفات وردية السيارات الملاكي وصافيها في مكان واحد." />

      <div className="bg-gradient-to-l from-navy to-navy-light px-4 py-8 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange/20">
              <Calculator className="h-7 w-7 text-orange" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">حاسبة الوردية</h1>
              <p className="text-sm text-gray-300">النقلات والمصاريف في شاشة واحدة… والصافي يتحسب لوحده</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['النقلات', String(tripCount), 'نقلة مسجلة'],
              ['إجمالي الإيراد', formatPrice(revenue), 'من النقلات'],
              ['صافي الوردية', formatPrice(net), net >= 0 ? 'ربح الوردية' : 'خسارة الوردية'],
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-2xl bg-white/10 p-3 text-center backdrop-blur-sm">
                <div className="text-xs text-gray-300">{label}</div>
                <div className={`mt-0.5 text-base font-black sm:text-xl ${label === 'صافي الوردية' ? (net >= 0 ? 'text-green-400' : 'text-red-400') : 'text-orange'}`}>
                  {value}
                </div>
                <div className="text-[10px] text-gray-300">{hint}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-8">
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {/* بيانات الوردية */}
            <section className="rounded-2xl border border-border bg-white p-4 sm:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-text">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange/10">
                  <Truck className="h-4 w-4 text-orange" />
                </span>
                بيانات الوردية
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="العربية / رقم الشاحنة" icon={<Truck className="h-3.5 w-3.5" />}>
                  <input className={inp} value={meta.truck} onChange={e => patchMeta({ truck: e.target.value })} placeholder="مثال: السيارات الملاكي — 1234 أ ب ج" />
                </Field>
                <Field label="التاريخ" icon={<Calendar className="h-3.5 w-3.5" />}>
                  <input type="date" className={inp} value={meta.date} onChange={e => patchMeta({ date: e.target.value })} />
                </Field>
                <Field label="السواق" icon={<User className="h-3.5 w-3.5" />}>
                  <input className={inp} value={meta.driver} onChange={e => patchMeta({ driver: e.target.value })} placeholder="اسم السواق" />
                </Field>
                <Field label="التباع" icon={<Users className="h-3.5 w-3.5" />}>
                  <input className={inp} value={meta.assistant} onChange={e => patchMeta({ assistant: e.target.value })} placeholder="اسم التباع (اختياري)" />
                </Field>
              </div>
            </section>

            {/* النقلات */}
            <section className="rounded-2xl border border-border bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold text-text">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10">
                    <Truck className="h-4 w-4 text-blue-600" />
                  </span>
                  النقلات
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{tripCount}</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={duplicateLastTrip} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text transition-colors hover:border-orange hover:text-orange">
                    <Copy className="h-3.5 w-3.5" />
                    نفس آخر نقلة
                  </button>
                  <button type="button" onClick={addTrip} className="flex items-center gap-1.5 rounded-xl bg-orange px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-dark">
                    <Plus className="h-3.5 w-3.5" />
                    إضافة نقلة
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {trips.map((trip, index) => (
                  <div key={trip.id} className="rounded-2xl border border-border bg-bg/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="rounded-lg bg-navy/5 px-2 py-1 text-xs font-bold text-text">نقلة {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeTrip(trip.id)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        aria-label={`حذف النقلة ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Field label="العميل">
                          <input className={inp} value={trip.client} onChange={e => patchTrip(trip.id, { client: e.target.value })} placeholder="اسم العميل أو الشركة" />
                        </Field>
                      </div>
                      <Field label="الحمولة">
                        <input className={inp} value={trip.cargo} onChange={e => patchTrip(trip.id, { cargo: e.target.value })} placeholder="مثال: رمل / أسمنت / حديد" />
                      </Field>
                      <Field label="المحجر">
                        <input className={inp} value={trip.quarry} onChange={e => patchTrip(trip.id, { quarry: e.target.value })} placeholder="اسم المحجر" />
                      </Field>
                      <Field label="من">
                        <input className={inp} value={trip.from} onChange={e => patchTrip(trip.id, { from: e.target.value })} placeholder="نقطة التحميل" />
                      </Field>
                      <Field label="إلى">
                        <input className={inp} value={trip.to} onChange={e => patchTrip(trip.id, { to: e.target.value })} placeholder="نقطة التنزيل" />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="أجرة النقلة">
                          <div className="relative">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              className={`${inp} pl-14`}
                              value={trip.fare}
                              onChange={e => patchTrip(trip.id, { fare: e.target.value })}
                              placeholder="0"
                            />
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-light">جنيه</span>
                          </div>
                        </Field>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addTrip} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-bold text-text-light transition-colors hover:border-orange hover:text-orange">
                <Plus className="h-4 w-4" />
                إضافة نقلة جديدة
              </button>
            </section>

            {/* المصروفات */}
            <section className="rounded-2xl border border-border bg-white p-4 sm:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-text">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10">
                  <Wallet className="h-4 w-4 text-red-500" />
                </span>
                المصروفات
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="السولار" icon={<Fuel className="h-3.5 w-3.5" />}>
                  <input type="number" inputMode="decimal" min="0" step="any" className={inp} value={expenses.diesel} onChange={e => patchExpense('diesel', e.target.value)} placeholder="0" />
                </Field>
                <Field label="المرتبات" icon={<Users className="h-3.5 w-3.5" />}>
                  <input type="number" inputMode="decimal" min="0" step="any" className={inp} value={expenses.salaries} onChange={e => patchExpense('salaries', e.target.value)} placeholder="0" />
                </Field>
                <Field label="العهدة" icon={<Wallet className="h-3.5 w-3.5" />}>
                  <input type="number" inputMode="decimal" min="0" step="any" className={inp} value={expenses.custody} onChange={e => patchExpense('custody', e.target.value)} placeholder="0" />
                </Field>
                <Field label="مصاريف أخرى">
                  <input type="number" inputMode="decimal" min="0" step="any" className={inp} value={expenses.other} onChange={e => patchExpense('other', e.target.value)} placeholder="0" />
                </Field>
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-bg/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-text-light">
                    <Mountain className="h-3.5 w-3.5" />
                    رسوم المحاجر
                  </span>
                  <span className="text-xs font-bold text-orange">{formatPrice(quarryTotal)}</span>
                </div>
                {quarries.length === 0 ? (
                  <p className="text-xs text-text-light">اكتب اسم محجر في أي نقلة، وسيظهر سطره هنا تلقائيًا.</p>
                ) : (
                  <div className="space-y-2">
                    {quarries.map(quarry => (
                      <div key={quarry} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{quarry}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          className={`${inp} max-w-[120px]`}
                          value={quarryFees[quarry] ?? ''}
                          onChange={e => setDraft(d => ({ ...d, quarryFees: { ...d.quarryFees, [quarry]: e.target.value } }))}
                          placeholder="0"
                        />
                        <span className="text-xs text-text-light">جنيه</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <Field label="ملاحظات (اختياري)">
                  <textarea
                    className={`${inp} min-h-[70px] resize-y`}
                    value={notes}
                    onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                    placeholder="أي ملاحظة على الوردية: انتظار، تصليح، خصم…"
                  />
                </Field>
              </div>
            </section>
          </div>

          {/* ملخص الوردية */}
          <aside className="order-first space-y-4 lg:order-last">
            <div className="sticky top-20 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div className="bg-navy p-4 text-white">
                <div className="text-xs text-gray-300">صافي الوردية</div>
                <div className={`mt-1 text-3xl font-black ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPrice(net)}</div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-300">
                  {net >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-green-400" /> : <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
                  {net >= 0 ? 'ربح بعد كل المصروفات' : 'خسارة — راجع المصروفات'}
                </div>
              </div>

              <div className="space-y-2 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-light">إجمالي الإيراد</span>
                  <b className="text-text">{formatPrice(revenue)}</b>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-light">المصروفات</span>
                  <b className="text-red-500">{formatPrice(totalExpenses)}</b>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-text-light">النقلات / المحاجر</span>
                  <b className="text-text">{tripCount} / {quarries.length}</b>
                </div>
                {editingId && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-700">
                    <Pencil className="h-3 w-3" />
                    تعديل وردية محفوظة
                  </div>
                )}
              </div>

              <div className="space-y-2 p-4 pt-0">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange py-3 text-sm font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingId ? 'تحديث الوردية' : 'حفظ الوردية'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={shareSummary} className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-bold text-text transition-colors hover:border-orange hover:text-orange">
                    <Share2 className="h-3.5 w-3.5" />
                    مشاركة
                  </button>
                  <button type="button" onClick={resetForm} className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-bold text-text transition-colors hover:border-orange hover:text-orange">
                    <RotateCcw className="h-3.5 w-3.5" />
                    وردية جديدة
                  </button>
                </div>
                <p className="flex items-start gap-1.5 pt-1 text-[11px] leading-relaxed text-text-light">
                  <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  الحفظ بيتم في حسابك، وتقدر ترجع لأي وردية قديمة من السجل تحت.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* سجل الورديات */}
        <section className="mt-6 rounded-2xl border border-border bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-text">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/10">
                <History className="h-4 w-4 text-green-600" />
              </span>
              سجل الورديات
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">{history.length}</span>
            </h2>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-text transition-colors hover:border-orange hover:text-orange"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                {showAll ? 'عرض وردياتي فقط' : 'عرض ورديات كل المستخدمين'}
              </button>
            )}
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-orange" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center">
              <History className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm text-text-light">لا توجد ورديات محفوظة بعد — سجّل أول وردية واضغط «حفظ الوردية».</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(shift => (
                <div key={shift.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 transition-colors hover:bg-gray-50/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-text">{shiftDateLabel(shift.date)}</span>
                      {shift.truck && <span className="rounded-lg bg-navy/5 px-2 py-0.5 text-[11px] font-semibold text-text-light">{shift.truck}</span>}
                      {showAll && shift.userName && <span className="text-[11px] text-text-light">— {shift.userName}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-text-light">
                      <span>{shift.trips?.length || 0} نقلة</span>
                      {shift.driver && <span>السواق: {shift.driver}</span>}
                      <span>الإيراد: {formatPrice(shift.revenue || 0)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`text-left text-sm font-black ${shift.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatPrice(shift.net || 0)}
                    </div>
                    <button
                      type="button"
                      onClick={() => openShift(shift)}
                      className="rounded-lg p-2 text-text-light transition-colors hover:bg-orange/10 hover:text-orange"
                      aria-label="تعديل الوردية"
                      title="تعديل"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteShift(shift)}
                      className="rounded-lg p-2 text-text-light transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="حذف الوردية"
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
