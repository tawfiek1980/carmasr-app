import { Flag, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
export default function ReportAbuse() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ type: '', target: '', desc: '', evidence: '' });
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">الإبلاغ عن إساءة</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Flag className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="text-3xl font-bold">الإبلاغ عن إساءة أو احتيال</h1>
          </div>
          <p className="text-gray-300">نأخذ جميع البلاغات بجدية تامة ونتعامل معها بسرية مطلقة خلال 24 ساعة.</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-danger/5 border border-danger/20 rounded-xl p-4 mb-6 text-sm text-danger">
          <strong>تنبيه:</strong> إذا كنت في خطر فعلي، اتصل بالشرطة فوراً على رقم <strong>122</strong> قبل تقديم هذا البلاغ.
        </div>
        {sent ? (
          <div className="bg-surface rounded-2xl border border-border p-10 text-center">
            <Flag className="w-12 h-12 text-success mx-auto mb-4" />
            <h2 className="font-bold text-text text-xl mb-2">تم استقبال بلاغك</h2>
            <p className="text-text-light text-sm">سيراجع فريق الأمان البلاغ خلال 24 ساعة ويتخذ الإجراء المناسب.</p>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-6">
            <form onSubmit={e => { e.preventDefault(); setSent(true); }} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">نوع المخالفة</label>
                <select required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange bg-white">
                  <option value="">اختر نوع المخالفة</option>
                  <option>إعلان احتيالي أو مزيف</option>
                  <option>منتج مسروق أو مزوّر</option>
                  <option>تحرش أو تهديد</option>
                  <option>محتوى مخالف للقانون</option>
                  <option>انتهاك حقوق الملكية الفكرية</option>
                  <option>حساب مزيف أو مسروق</option>
                  <option>أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">رابط الإعلان أو المستخدم المُبلَّغ عنه</label>
                <input required value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="أدخل الرابط أو اسم المستخدم" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">تفاصيل المخالفة</label>
                <textarea required rows={5} value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange resize-none" placeholder="اشرح المخالفة بالتفصيل مع ذكر التواريخ والأدلة المتاحة..." />
              </div>
              <button type="submit" className="w-full bg-danger hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-colors">تقديم البلاغ</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
