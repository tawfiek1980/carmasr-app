import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Copy, ExternalLink, RefreshCw, Search, Trash2, Image as ImageIcon, Link2 } from 'lucide-react';
import { firebaseAuth } from '../../firebase';
import { copyText, formatDateTime } from '../../lib/utils';

interface SavedTitleItem {
  id: string;
  url: string;
  title: string;
  description: string;
  images: string[];
  pulledCount?: number;
  pulledAt?: string | null;
}

export default function SavedTitlesPanel({ getApiUrl }: { getApiUrl: () => string }) {
  const [items, setItems] = useState<SavedTitleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : '';
      if (!token) { setError('يجب تسجيل الدخول أولاً'); setLoading(false); return; }
      const res = await fetch(`${getApiUrl()}/admin?action=saved-titles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) setItems(data.items);
      else setError(data.message || 'تعذر تحميل الحافظة');
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [getApiUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm('حذف هذا الرابط من الحافظة؟')) return;
    try {
      const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : '';
      if (!token) return;
      await fetch(`${getApiUrl()}/admin?action=delete-saved-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      setItems(list => list.filter(i => i.id !== id));
    } catch {
      /* ignore */
    }
  };

  const copyItem = async (i: SavedTitleItem) => {
    const txt = `${i.title || ''}\n${i.url || ''}${i.description ? `\n\n${i.description}` : ''}`.trim();
    const ok = await copyText(txt);
    alert(ok ? 'تم نسخ الرابط والوصف' : 'تعذر النسخ');
  };

  const filtered = items.filter(i => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (i.title + ' ' + i.url + ' ' + i.description).toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Bookmark className="w-6 h-6 text-orange" />
          <h2 className="text-xl font-bold text-gray-900">حافظة الروابط المواقع</h2>
          <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2.5 py-1">{items.length} محفوظ</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-gray-200 rounded-xl pr-9 pl-4 py-2 text-sm focus:outline-none focus:border-orange-400 w-56"
              placeholder="بحث في الروابط..."
            />
          </div>
          <button onClick={load} className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer">
            <RefreshCw className="w-4 h-4" /> تحديث
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 font-semibold">جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">
            {items.length === 0
              ? 'لا توجد روابط محفوظة بعد — أي رابط تسحبه في النشر السريع يتسجل هنا تلقائياً كمرجع'
              : 'لا نتائج مطابقة'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(i => (
            <div key={i.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-gray-800 leading-snug">{i.title || 'بدون عنوان'}</h3>
                {i.images && i.images.length > 0 && (
                  <img src={i.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0" />
                )}
              </div>

              <a href={i.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 text-xs text-blue-600 hover:underline break-all" dir="ltr">
                <Link2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="text-right">{i.url}</span>
              </a>

              {i.description && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-2.5 whitespace-pre-wrap line-clamp-6">{i.description}</p>
              )}

              {i.images && i.images.length > 1 && (
                <div className="flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] text-gray-400">+{i.images.length - 1} صورة إضافية</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 mt-auto">
                <span className="text-[11px] text-gray-400">
                  {i.pulledAt ? formatDateTime(new Date(i.pulledAt).getTime()) : ''}
                  {i.pulledCount && i.pulledCount > 1 ? ` · سحب ${i.pulledCount} مرة` : ''}
                </span>
                <div className="flex items-center gap-1">
                  <a
                    href={i.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="فتح الرابط"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer inline-flex"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button onClick={() => copyItem(i)} title="نسخ الرابط والوصف" className="p-1.5 rounded-lg text-gray-400 hover:text-orange hover:bg-orange-50 transition-colors cursor-pointer">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(i.id)} title="حذف من الحافظة" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}