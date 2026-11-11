import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, Phone, MessageCircle, Search, Edit, Trash2, Copy, StickyNote, ExternalLink, PlusCircle,
} from 'lucide-react';
import { copyText, formatPhone, formatDateTime, getWhatsAppLink } from '../../lib/utils';
import { useNotifications } from '../../contexts/NotificationContext';
import { logAdminAction } from '../../lib/audit';

type NoteType = 'عميل' | 'معرض' | 'إعلان' | 'أخرى';
type NoteStatus = 'جديد' | 'قيد المتابعة' | 'متفق عليه' | 'ملغى';

interface LeadNote {
  id: string;
  type: NoteType;
  title: string;
  info: string;
  phone: string;
  details: string;
  status: NoteStatus;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'tareeq_admin_notes';

const NOTE_TYPES: { id: NoteType; label: string }[] = [
  { id: 'عميل', label: 'عميل' },
  { id: 'معرض', label: 'معرض' },
  { id: 'إعلان', label: 'إعلان' },
  { id: 'أخرى', label: 'أخرى' },
];

const NOTE_STATUSES: NoteStatus[] = ['جديد', 'قيد المتابعة', 'متفق عليه', 'ملغى'];

const typeColor: Record<NoteType, string> = {
  'عميل': 'bg-orange-50 text-orange-600',
  'معرض': 'bg-purple-50 text-purple-600',
  'إعلان': 'bg-blue-50 text-blue-600',
  'أخرى': 'bg-gray-100 text-gray-500',
};

const statusColor: Record<NoteStatus, string> = {
  'جديد': 'bg-blue-50 text-blue-600 border-blue-200',
  'قيد المتابعة': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'متفق عليه': 'bg-green-50 text-green-600 border-green-200',
  'ملغى': 'bg-red-50 text-red-500 border-red-200',
};

const loadNotes = (): LeadNote[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const digitsOnly = (p: string) => p.replace(/\D/g, '');

export default function AdminNotes() {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<NoteType | 'الكل'>('الكل');
  const [statusFilter, setStatusFilter] = useState<NoteStatus | 'الكل'>('الكل');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'عميل' as NoteType,
    title: '',
    info: '',
    phone: '',
    details: '',
    status: 'جديد' as NoteStatus,
  });

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const persist = (list: LeadNote[]) => {
    setNotes(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ type: 'عميل', title: '', info: '', phone: '', details: '', status: 'جديد' });
    setModalOpen(true);
  };

  const openEdit = (n: LeadNote) => {
    setEditId(n.id);
    setForm({ type: n.type, title: n.title, info: n.info, phone: n.phone, details: n.details, status: n.status });
    setModalOpen(true);
  };

  const save = () => {
    if (!form.title.trim()) return;
    const now = Date.now();
    if (editId) {
      persist(notes.map(n => (n.id === editId ? { ...n, ...form, title: form.title.trim(), updatedAt: now } : n)));
      logAdminAction('note_updated', form.title.trim());
    } else {
      persist([{ id: `n_${now}_${Math.random().toString(36).slice(2, 7)}`, ...form, title: form.title.trim(), createdAt: now, updatedAt: now }, ...notes]);
      logAdminAction('note_added', form.title.trim());
    }
    setModalOpen(false);
  };

  const remove = (id: string) => {
    if (!confirm('حذف هذه الملاحظة؟')) return;
    const target = notes.find(n => n.id === id);
    logAdminAction('note_deleted', target?.title || id);
    persist(notes.filter(n => n.id !== id));
  };

  const setStatus = (id: string, status: NoteStatus) => {
    persist(notes.map(n => (n.id === id ? { ...n, status, updatedAt: Date.now() } : n)));
  };

  const copyNote = async (n: LeadNote) => {
    const txt = `${n.title}${n.type === 'إعلان' ? ' — إعلان' : ''}\nالعنوان/الصفحة: ${n.info || '—'}\nالرقم: ${n.phone || '—'}${n.details ? `\n${n.details}` : ''}`.trim();
    const ok = await copyText(txt);
    alert(ok ? 'تم نسخ الملاحظة' : 'تعذر النسخ');
  };

  const navigate = useNavigate();
  const { toast } = useNotifications();

  const makeAd = async (n: LeadNote) => {
    const tel = digitsOnly(n.phone);
    const parts = [`اسم: ${n.title}`];
    if (n.info) parts.push(`العنوان/الصفحة: ${n.info}`);
    if (n.phone) parts.push(`الرقم: ${n.phone}`);
    if (n.details) parts.push(`ملاحظات:\n${n.details}`);
    const ok = await copyText(parts.join('\n'));
    logAdminAction('note_to_ad', n.title);
    if (ok) toast(tel ? 'اتنسخت بيانات العميل — رح النموذج والصقها في وصف الإعلان' : 'اتنسخت بيانات العميل — رح النموذج والصقها في وصف الإعلان', 'success');
    navigate(tel ? `/post-listing?phone=${tel}` : '/post-listing');
  };

  const filtered = useMemo(() => {
    let list = notes;
    if (typeFilter !== 'الكل') list = list.filter(n => n.type === typeFilter);
    if (statusFilter !== 'الكل') list = list.filter(n => n.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(n => (n.title + ' ' + n.info + ' ' + n.phone + ' ' + n.details + ' ' + n.type).toLowerCase().includes(q));
    }
    return list;
  }, [notes, search, typeFilter, statusFilter]);

  const openCount = notes.filter(n => n.status !== 'ملغى').length;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <StickyNote className="w-6 h-6 text-orange" />
          <h2 className="text-xl font-bold text-gray-900">دفتر الملاحظات</h2>
          <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2.5 py-1">{openCount} مفتوحة</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-gray-200 rounded-xl pr-9 pl-4 py-2 text-sm focus:outline-none focus:border-orange-400 w-48"
              placeholder="بحث..."
            />
          </div>
          <button onClick={openAdd} className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer">
            <Plus className="w-4 h-4" /> إضافة ملاحظة
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {(['الكل', ...NOTE_TYPES.map(t => t.id)] as const).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${typeFilter === t ? 'bg-orange text-white border-orange' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'}`}
          >
            {t === 'الكل' ? 'كل الأنواع' : t}
          </button>
        ))}
        <span className="w-px h-6 bg-gray-200 mx-1" />
        {(['الكل', ...NOTE_STATUSES] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${statusFilter === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
          >
            {s === 'الكل' ? 'كل الحالات' : s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <StickyNote className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">
            {notes.length === 0 ? 'لا توجد ملاحظات بعد — احفظ أي عنوان/صفحة/عميل واللي ينفع للتعاقد' : 'لا نتائج مطابقة'}
          </p>
          {notes.length === 0 && (
            <button onClick={openAdd} className="mt-4 inline-flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors cursor-pointer">
              <Plus className="w-4 h-4" /> أضف أول ملاحظة
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(n => {
            const tel = digitsOnly(n.phone);
            const isLink = /^https?:\/\//i.test(n.info);
            return (
              <div key={n.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${typeColor[n.type]}`}>{n.type}</span>
                  <select
                    value={n.status}
                    onChange={e => setStatus(n.id, e.target.value as NoteStatus)}
                    className={`text-xs font-bold border rounded-full px-2.5 py-1 outline-none cursor-pointer ${statusColor[n.status]}`}
                  >
                    {NOTE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <h3 className="font-bold text-gray-800">{n.title}</h3>

                {n.info && (
                  isLink ? (
                    <a href={n.info} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 text-sm text-blue-600 hover:underline break-all">
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {n.info}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-600 break-words">{n.info}</p>
                  )
                )}

                {tel && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={`tel:${tel}`} className="inline-flex items-center gap-1 text-sm font-bold text-gray-700 hover:text-orange">
                      <Phone className="w-4 h-4 text-orange" /> {formatPhone(n.phone)}
                    </a>
                    <a
                      href={getWhatsAppLink(tel, `السلام عليكم، بخصوص: ${n.title}${n.info ? ` — ${n.info}` : ''}`)}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-green-600 hover:underline"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> واتساب
                    </a>
                  </div>
                )}

                {n.details && <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-2.5 whitespace-pre-wrap">{n.details}</p>}

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 mt-auto">
                  <span className="text-[11px] text-gray-400">{formatDateTime(n.updatedAt)}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => makeAd(n)} title="تحويل الملاحظة إلى إعلان جديد" className="flex items-center gap-1 text-xs font-bold bg-orange/10 hover:bg-orange/20 text-orange px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
                      <PlusCircle className="w-3.5 h-3.5" /> اعمل إعلان
                    </button>
                    <button onClick={() => copyNote(n)} title="نسخ الملاحظة" className="p-1.5 rounded-lg text-gray-400 hover:text-orange hover:bg-orange-50 transition-colors cursor-pointer">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(n)} title="تعديل" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(n.id)} title="حذف" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">{editId ? 'تعديل ملاحظة' : 'ملاحظة جديدة'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {NOTE_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setForm(f => ({ ...f, type: t.id }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${form.type === t.id ? 'bg-orange text-white border-orange' : 'bg-white text-gray-500 border-gray-200'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">الاسم / العنوان</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                  placeholder="مثال: معرض النور للسيارات"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">صفحة / لينك / عنوان</label>
                <input
                  value={form.info}
                  onChange={e => setForm(f => ({ ...f, info: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                  placeholder="لينك صفحة فيسبوك أو العنوان"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">رقم الهاتف</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">تفاصيل الصفقة / ملاحظات</label>
                <textarea
                  value={form.details}
                  onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none"
                  placeholder="مثال: العميل عايز لودر سنة 2015 واتفقنا على السعر"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={save} disabled={!form.title.trim()} className="flex-1 bg-orange hover:bg-orange-dark disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer">
                  {editId ? 'حفظ التعديل' : 'إضافة'}
                </button>
                <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:bg-gray-50 transition-colors cursor-pointer">
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}