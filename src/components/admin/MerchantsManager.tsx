import { useEffect, useMemo, useState } from 'react';
import {
  Search, Loader2, Send, RefreshCw, ChevronLeft, ChevronRight,
  X, Smartphone, UserCheck, Truck, Users, MessageCircle, Megaphone,
} from 'lucide-react';
import { firebaseAuth } from '../../firebase';
import { mainCategories, governorates } from '../../lib/data';

const PAGE_SIZE = 25;

interface MerchantRow {
  id: string;
  name: string;
  phones: string[];
  governorate: string;
  categories: string[];
  adCount: number;
  memberSince: string;
  lastAdAt: string;
  advertiser: boolean;
  member: boolean;
  hasPush: boolean;
  optOut: boolean;
  userIds: string[];
}

interface ListResp {
  ok: boolean;
  rows: MerchantRow[];
  stats: { total: number; advertisers: number; members: number; withPush: number; optedOut: number };
}

const QUICK_URLS = ['/', '/listings', '/loads', '/jobs', 'https://carmasr-app.vercel.app'];

export default function MerchantsManager({ getApiUrl }: { getApiUrl: () => string }) {
  const [rows, setRows] = useState<MerchantRow[] | null>(null);
  const [stats, setStats] = useState<ListResp['stats'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const [q, setQ] = useState('');
  const [fGov, setFGov] = useState('');
  const [fCat, setFCat] = useState('');
  const [fSource, setFSource] = useState<'all' | 'ads' | 'members'>('all');
  const [fPush, setFPush] = useState(false);
  const [fMinAds, setFMinAds] = useState('0');

  const [composerOpen, setComposerOpen] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cBody, setCBody] = useState('');
  const [cUrl, setCUrl] = useState('/');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      let token: string | null = null;
      try { token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : null; } catch {}
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const r = await fetch(`${getApiUrl()}/push?action=merchantList`, { headers });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok || !Array.isArray(d.rows)) throw new Error(d?.error || `HTTP ${r.status}`);
      setRows(d.rows);
      setStats(d.stats);
      setSelected(new Set());
      setPage(1);
    } catch (e: any) {
      setError(e.message || 'فشل تحميل البيانات');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const all = rows || [];
    const qq = q.trim().toLowerCase();
    return all.filter(r => {
      if (fGov && r.governorate !== fGov) return false;
      if (fCat && !r.categories.includes(fCat)) return false;
      if (fSource === 'ads' && !r.advertiser) return false;
      if (fSource === 'members' && !r.member) return false;
      if (fPush && !r.hasPush) return false;
      const min = Number(fMinAds) || 0;
      if (min > 0 && r.adCount < min) return false;
      if (qq) {
        const inName = (r.name || '').toLowerCase().includes(qq);
        const inPhone = r.phones.some(p => String(p).includes(q));
        if (!inName && !inPhone) return false;
      }
      return true;
    });
  }, [rows, q, fGov, fCat, fSource, fPush, fMinAds]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const dashSelectedCount = filtered.filter(r => selected.has(r.id)).length;

  const toggleAll = () => {
    const pageIds = pageRows.map(r => r.id);
    const allOnPage = pageIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      pageIds.forEach(id => (allOnPage ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(new Set(filtered.map(r => r.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const openComposer = () => {
    setSendResult(null);
    setComposerOpen(true);
  };

  const send = async () => {
    if (!cTitle.trim() || !cBody.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      let token: string | null = null;
      try { token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : null; } catch {}
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const r = await fetch(`${getApiUrl()}/push?action=merchantBroadcast`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: cTitle.trim(), body: cBody.trim(), url: cUrl, ids: Array.from(selected) }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setSendResult(d);
    } catch (e: any) {
      setSendResult({ error: e.message || 'فشل الإرسال' });
    }
    setSending(false);
  };

  const govNames = useMemo(() => {
    const fromData = governorates.map(g => g.name);
    const fromRows = Array.from(new Set((rows || []).map(r => r.governorate).filter(Boolean)));
    return Array.from(new Set([...fromData, ...fromRows]));
  }, [rows]);

  const catOptions = useMemo(() => {
    const fromData = mainCategories.map(c => ({ id: c.id, name: c.name }));
    const ids = Array.from(new Set((rows || []).flatMap(r => r.categories)));
    const missing = ids.filter(id => !fromData.some(c => c.id === id));
    const seen: string[] = [];
    return [
      ...fromData,
      ...missing.map(id => {
        if (seen.includes(id)) return null;
        seen.push(id);
        return { id, name: id };
      }).filter(Boolean),
    ] as { id: string; name: string }[];
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-2xl font-black text-gray-900">{stats ? stats.total : <Loader2 className="w-4 h-4 animate-spin text-gray-300" />}</div>
          <div className="text-sm text-gray-500 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> إجمالي جهات التواصل</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-2xl font-black text-gray-900">{stats ? stats.advertisers : '—'}</div>
          <div className="text-sm text-gray-500 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> معلنون</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-2xl font-black text-gray-900">{stats ? stats.members : '—'}</div>
          <div className="text-sm text-gray-500 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5" /> أعضاء مسجلون</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-2xl font-black text-gray-900">{stats ? stats.withPush : '—'}</div>
          <div className="text-sm text-gray-500 flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> يملكون إشعارات</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-gray-800">دليل التواصل</h3>
            <p className="text-xs text-gray-500 mt-1">
              مجمّع تلقائياً من المعلنين + الأعضاء بلا تكرار — الإشعارات تصل فقط لمن لديه توكن (التطبيق)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-sm text-red-500">{error}</span>}
            <button onClick={load} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer">
              <RefreshCw className="w-4 h-4" /> تحديث
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="col-span-2 relative">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو الرقم..."
              className="w-full border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <select value={fGov} onChange={e => { setFGov(e.target.value); setPage(1); }} className="border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white">
            <option value="">كل المحافظات</option>
            {govNames.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={fCat} onChange={e => { setFCat(e.target.value); setPage(1); }} className="border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white">
            <option value="">كل التصنيفات</option>
            {catOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={fSource} onChange={e => setFSource(e.target.value as any)} className="border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white">
            <option value="all">الكل</option>
            <option value="ads">معلنون فقط</option>
            <option value="members">أعضاء فقط</option>
          </select>
          <select value={fMinAds} onChange={e => { setFMinAds(e.target.value); setPage(1); }} className="border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white">
            <option value="0">كلهم</option>
            <option value="1">إعلان أو أكثر</option>
            <option value="3">٣ إعلانات أو أكثر</option>
            <option value="5">٥ إعلانات أو أكثر</option>
          </select>
          <label className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-xl px-2.5 py-2 text-sm cursor-pointer hover:border-orange-300">
            <input type="checkbox" checked={fPush} onChange={e => { setFPush(e.target.checked); setPage(1); }} className="w-4 h-4 text-orange rounded" />
            لديه إشعارات
          </label>
        </div>

        {/* ── Selection bar ── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={selectAllFiltered} className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 px-2 py-1.5 rounded-lg cursor-pointer">
              <CheckSquareIcon /> تحديد الكل المُفلتر ({filtered.length})
            </button>
            {selected.size > 0 && (
              <button onClick={clearSelection} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg cursor-pointer">إلغاء التحديد</button>
            )}
            <span className="text-xs text-gray-500">المحدد: <b className="text-gray-800">{dashSelectedCount}</b></span>
            {selected.size > 0 && (
              <span className="text-xs text-gray-500">
                منها بدون إشعارات سيتم تخطيها: <b className="text-red-500">{filtered.filter(r => selected.has(r.id) && !r.hasPush).length}</b>
              </span>
            )}
          </div>
          <button onClick={openComposer} disabled={!selected.size}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer">
            <Send className="w-4 h-4" /> إرسال إشعار ({dashSelectedCount})
          </button>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-2">
                  <input type="checkbox" checked={pageRows.length > 0 && pageRows.every(r => selected.has(r.id))}
                    onChange={toggleAll} className="w-4 h-4 text-orange rounded" />
                </th>
                <th className="py-2">الاسم</th>
                <th className="py-2">الهاتف</th>
                <th className="py-2">المحافظة</th>
                <th className="py-2">التصنيفات</th>
                <th className="py-2">إعلانات</th>
                <th className="py-2">المصدر</th>
                <th className="py-2">الإشعارات</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td></tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-400 text-sm">لا توجد نتائج مطابقة</td></tr>
              )}
              {!loading && pageRows.map(r => {
                const isSel = selected.has(r.id);
                return (
                  <tr key={r.id} className={`border-b border-gray-50 hover:bg-orange-50/40 transition-colors ${isSel ? 'bg-orange-50/70' : ''}`}>
                    <td className="py-2.5 pr-2">
                      <input type="checkbox" checked={isSel} onChange={() => toggleRow(r.id)} className="w-4 h-4 text-orange rounded" />
                    </td>
                    <td className="py-2.5 font-semibold text-gray-800">
                      {r.name || '—'}
                      {r.optOut && <span className="mr-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">ممتنع</span>}
                    </td>
                    <td className="py-2.5" dir="ltr">
                      <div className="text-left">{r.phones.length ? r.phones[0] : '—'}</div>
                      {r.phones.length > 1 && <div className="text-[10px] text-gray-400">{r.phones.length - 1}+ رقم</div>}
                    </td>
                    <td className="py-2.5 text-gray-600">{r.governorate || '—'}</td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {r.categories.slice(0, 2).map(c =>
                          <span key={c} className="text-[10px] bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">{(catOptions.find(x => x.id === c))?.name || c}</span>
                        )}
                        {r.categories.length > 2 && <span className="text-[10px] text-gray-400">+{r.categories.length - 2}</span>}
                      </div>
                    </td>
                    <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.adCount > 0 ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-400'}`}>{r.adCount}</span></td>
                    <td className="py-2.5">
                      <div className="flex flex-col gap-1">
                        {r.advertiser && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full w-fit">معلن</span>}
                        {r.member && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full w-fit">عضو</span>}
                        {(!r.advertiser && !r.member) && <span className="text-[10px] text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="py-2.5">
                      {r.hasPush
                        ? <span className="inline-flex items-center gap-1 text-xs text-success"><Smartphone className="w-3.5 h-3.5" /> متاح</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-gray-400"><X className="w-3 h-3" /> لا يوجد</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-500">إجمالي النتائج: <b className="text-gray-800">{filtered.length}</b></span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-xs text-gray-600">صفحة {page} من {pageCount}</span>
            <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page >= pageCount}
              className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Composer ── */}
      {composerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !sending && setComposerOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Megaphone className="w-5 h-5 text-orange-500" /> إرسال إشعار جماعي</h3>
              <button onClick={() => setComposerOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer" disabled={sending}><X className="w-5 h-5" /></button>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 mb-4">
              المستهدفون: <b className="text-gray-800">{dashSelectedCount}</b> · بدون توكن (يُتخطّى): <b className="text-red-500">{filtered.filter(r => selected.has(r.id) && !r.hasPush).length}</b> · ممتنعين (يُتخطّى): <b className="text-gray-500">{filtered.filter(r => selected.has(r.id) && r.optOut).length}</b>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">العنوان *</label>
                <input value={cTitle} onChange={e => setCTitle(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" placeholder="مثال: إعلانك مجاناً على كار مصر CarMasr" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">النص *</label>
                <textarea value={cBody} onChange={e => setCBody(e.target.value)} rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" placeholder="رسالة الترحيب أو التذكير..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">رابط عند الضغط</label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {QUICK_URLS.map(u => (
                    <button key={u} onClick={() => setCUrl(u)}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition-colors cursor-pointer ${cUrl === u ? 'bg-orange text-white border-orange' : 'border-gray-200 text-gray-500 hover:border-orange-300'}`}>
                      {u}
                    </button>
                  ))}
                </div>
                <input value={cUrl} onChange={e => setCUrl(e.target.value)} dir="ltr" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 text-left" />
              </div>

              {sendResult && (
                <div className={`rounded-xl px-3 py-2.5 text-sm text-center ${sendResult.error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                  {sendResult.error ? (
                    <>فشل: {sendResult.error}</>
                  ) : (
                    <>وصل: {sendResult.delivered} جهاز · فشل: {sendResult.failed} · تنظيف توكنات ميتة: {sendResult.staleRemoved} · بلا توكن/ممتنع: {Math.max(0, sendResult.audience - sendResult.delivered - sendResult.failed)}</>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={send} disabled={sending || !cTitle.trim() || !cBody.trim()}
                  className="flex-1 bg-orange hover:bg-orange-dark disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'جارٍ الإرسال...' : `إرسال الآن (${dashSelectedCount})`}
                </button>
                <button onClick={() => setComposerOpen(false)} disabled={sending} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:bg-gray-50 transition-colors cursor-pointer">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckSquareIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 12 2 2 4-4" />
    </svg>
  );
}