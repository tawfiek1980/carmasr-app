import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { doc, collection, addDoc, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export default function SocialLinksManager() {
  const [links, setLinks]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm]     = useState({ name: '', url: '', icon: '', color: '' });

  const save = async () => {
    if (!form.name || !form.url) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'siteConfig'), {
        type: 'socialLink', ...form, active: true, createdAt: serverTimestamp()
      });
      setForm({ name: '', url: '', icon: '', color: '' });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <h3 className="font-bold text-gray-800">إضافة رابط سوشيال</h3>
      <div className="grid grid-cols-2 gap-3">
        {[['name','الاسم (Facebook)'],['url','الرابط'],['icon','الأيقونة'],['color','اللون (#F00)']].map(([k,l])=>(
          <div key={k}>
            <label className="text-xs text-gray-500 mb-1 block">{l}</label>
            <input value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={loading}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
        <Save className="w-4 h-4" /> حفظ
      </button>
    </div>
  );
}
