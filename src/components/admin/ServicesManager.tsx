import { useEffect, useState } from 'react';
import {
  Save, Plus, Edit, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Loader2, RotateCcw, X,
} from 'lucide-react';
import ImageUploader from '../ImageUploader';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  DEFAULT_SERVICES, normalizeService, SERVICE_ICONS, SERVICE_ICON_OPTIONS,
} from '../../lib/serviceData';
import type { ManagedService, ServiceIconKey } from '../../lib/serviceData';

const SERVICES_DOC = 'services';

interface FormState {
  id: string | null;
  name: string;
  description: string;
  image: string;
  features: string[];
  iconKey: ServiceIconKey;
  active: boolean;
  contactPhones: string[];
  address: string;
  facebook: string;
}

const emptyForm = (): FormState => ({
  id: null,
  name: '',
  description: '',
  image: '',
  features: ['', '', ''],
  iconKey: 'wrench',
  active: true,
  contactPhones: ['', '', ''],
  address: '',
  facebook: '',
});

export default function ServicesManager() {
  const [services, setServices] = useState<ManagedService[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'siteConfig', SERVICES_DOC));
      const arr = snap?.data()?.services;
      if (Array.isArray(arr) && arr.length > 0) {
        setServices(arr.map((s, i) => normalizeService(s, i)));
      } else {
        setServices(DEFAULT_SERVICES);
      }
    } catch {
      setServices(DEFAULT_SERVICES);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!services) return;
    setSaving(true);
    setMsg('');
    try {
      const list = services.map((s, i) => ({ ...s, order: i }));
      await setDoc(doc(db, 'siteConfig', SERVICES_DOC), {
        type: SERVICES_DOC,
        services: list,
        updatedAt: serverTimestamp(),
      });
      setMsg('تم حفظ الخدمات بنجاح');
    } catch (e) {
      console.error(e);
      setMsg('فشل الحفظ');
    }
    setSaving(false);
  };

  const openAdd = () => {
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (s: ManagedService) => {
    setForm({
      id: s.id,
      name: s.name,
      description: s.description,
      image: s.image,
      features: [s.features?.[0] || '', s.features?.[1] || '', s.features?.[2] || ''],
      iconKey: s.iconKey,
      active: s.active,
      contactPhones: [s.contactPhones?.[0] || '', s.contactPhones?.[1] || '', s.contactPhones?.[2] || ''],
      address: s.address || '',
      facebook: s.facebook || '',
    });
    setModalOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) return;
    const now: ManagedService = {
      id: form.id || `sv_${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim(),
      image: form.image.trim(),
      features: form.features.map(f => f.trim()).filter(Boolean),
      iconKey: form.iconKey,
      active: form.active,
      order: 0,
      contactPhones: form.contactPhones.map(p => p.trim()).filter(Boolean),
      address: form.address.trim(),
      facebook: form.facebook.trim(),
    };
    if (form.id) {
      setServices(prev => (prev || []).map(s => (s.id === form.id ? now : s)));
    } else {
      setServices(prev => [...(prev || []), now]);
    }
    setModalOpen(false);
  };

  const remove = (id: string) => {
    if (!confirm('حذف هذه الخدمة؟')) return;
    setServices(prev => (prev || []).filter(s => s.id !== id));
  };

  const toggleActive = (id: string) => {
    setServices(prev => (prev || []).map(s => (s.id === id ? { ...s, active: !s.active } : s)));
  };

  const move = (index: number, dir: -1 | 1) => {
    setServices(prev => {
      const list = [...(prev || [])];
      const target = index + dir;
      if (target < 0 || target >= list.length) return list;
      const item = list.splice(index, 1)[0];
      list.splice(target, 0, item);
      return list;
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-gray-800">خدمات صفحة /services</h3>
          <p className="text-xs text-gray-500 mt-1">أضف أو عدّل أو أعد ترتيب الخدمات — الحفظ ينشر فورًا بعد تحديث الصفحة</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-sm ${msg.includes('تم') ? 'text-green-600' : 'text-red-500'}`}>{msg}</span>}
          <button onClick={save} disabled={saving || !services} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ التغييرات
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-6 text-sm">جارٍ التحميل...</p>
      ) : (
        <div className="space-y-2">
          {(services || []).map((s, i) => {
            const Icon = SERVICE_ICONS[s.iconKey] || SERVICE_ICONS.wrench;
            return (
              <div key={s.id} className={`flex items-center gap-3 border rounded-xl p-3 transition-colors ${s.active ? 'border-gray-200' : 'border-red-100 bg-red-50/40'}`}>
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 disabled:opacity-30 hover:text-gray-700 cursor-pointer"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === (services || []).length - 1} className="text-gray-400 disabled:opacity-30 hover:text-gray-700 cursor-pointer"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <div className="w-10 h-10 rounded-xl bg-orange/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${s.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{s.name}</span>
                    {s.features?.length > 0 && <span className="text-[10px] text-gray-400">({s.features.join(' • ')})</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{s.description}</p>
                    {(s.contactPhones?.length || s.address || s.facebook) && (
                      <p className="text-[10px] text-gray-400 truncate">
                        {s.contactPhones?.length ? `هاتف: ${s.contactPhones.join(' ، ')} · ` : ''}
                        {s.address ? `${s.address} · ` : ''}
                        {s.facebook ? 'فيس بوك' : ''}
                      </p>
                    )}
                </div>
                <button onClick={() => toggleActive(s.id)} title={s.active ? 'إخفاء' : 'إظهار'} className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors cursor-pointer">
                  {s.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-red-400" />}
                </button>
                <button onClick={() => openEdit(s)} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"><Edit className="w-4 h-4" /></button>
                <button onClick={() => remove(s.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> إضافة خدمة
        </button>
        <button onClick={load} title="إعادة تحميل" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer">
          <RotateCcw className="w-4 h-4" /> إعادة تحميل
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">{form.id ? 'تعديل خدمة' : 'خدمة جديدة'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">اسم الخدمة *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">الوصف</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">صورة الخدمة</label>
                <ImageUploader
                  images={form.image ? [form.image] : []}
                  onChange={urls => setForm(f => ({ ...f, image: urls[0] || '' }))}
                  max={1}
                  folder="services"
                />
                <input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} dir="ltr"
                  className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" placeholder="أو الصق رابط الصورة مباشرة (https://...)" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">الأيقونة</label>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICE_ICON_OPTIONS.map(opt => (
                    <button key={opt.key} onClick={() => setForm(f => ({ ...f, iconKey: opt.key }))}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${form.iconKey === opt.key ? 'bg-orange text-white border-orange' : 'border-gray-200 text-gray-500 hover:border-orange-300'}`}>
                      {(() => { const I = SERVICE_ICONS[opt.key]; return <I className="w-3.5 h-3.5" />; })()}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">النقاط (حتى 3)</label>
                {form.features.map((f, i) => (
                  <input key={i} value={f} onChange={e => setForm(p => ({ ...p, features: p.features.map((x, j) => (j === i ? e.target.value : x)) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 mb-1.5" placeholder={`نقطة ${i + 1}`} />
                ))}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">أرقام التواصل (حتى 3)</label>
                {form.contactPhones.map((p, i) => (
                  <input key={i} value={p} onChange={e => setForm(f => ({ ...f, contactPhones: f.contactPhones.map((x, j) => (j === i ? e.target.value : x)) }))}
                    dir="ltr" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 mb-1.5 text-left" placeholder={`رقم التواصل ${i + 1} (مثال: 01012345678)`} />
                ))}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">العنوان</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" placeholder="مثال: العاشر من رمضان، المنطقة الصناعية الثانية" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">صفحة فيسبوك</label>
                <input value={form.facebook} onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))} dir="ltr"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 text-left"
                  placeholder="https://facebook.com/pagename أو اسم الصفحة" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 text-orange rounded" />
                ظاهرة على الموقع
              </label>
              <div className="flex gap-2 pt-2">
                <button onClick={submit} disabled={!form.name.trim()} className="flex-1 bg-orange hover:bg-orange-dark disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer">
                  {form.id ? 'حفظ التعديل' : 'إضافة'}
                </button>
                <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-bold hover:bg-gray-50 transition-colors cursor-pointer">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}