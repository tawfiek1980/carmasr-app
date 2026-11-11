import { AlertCircle, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
export default function ReportProblem() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ type: '', desc: '', url: '', email: '' });
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">الإبلاغ عن مشكلة</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-3xl font-bold">الإبلاغ عن مشكلة</h1>
          </div>
          <p className="text-gray-300">ساعدنا في تحسين المنصة من خلال إبلاغنا عن أي مشكلة تواجهها</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-12">
        {sent ? (
          <div className="bg-surface rounded-2xl border border-border p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-success" />
            </div>
            <h2 className="font-bold text-text text-xl mb-2">شكراً على إبلاغك</h2>
            <p className="text-text-light text-sm mb-6">سيراجع فريقنا التقني المشكلة ويتواصل معك إن لزم.</p>
            <Link to="/" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">العودة للرئيسية</Link>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-6">
            <form onSubmit={e => { e.preventDefault(); setSent(true); }} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">نوع المشكلة</label>
                <select required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange bg-white">
                  <option value="">اختر نوع المشكلة</option>
                  <option>خطأ تقني في الموقع/التطبيق</option>
                  <option>مشكلة في تسجيل الدخول</option>
                  <option>مشكلة في نشر الإعلان</option>
                  <option>مشكلة في عرض الصور</option>
                  <option>مشكلة في نظام الدفع</option>
                  <option>بطء في الأداء</option>
                  <option>أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">رابط الصفحة التي فيها المشكلة (اختياري)</label>
                <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="https://tareeq.com/..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">وصف المشكلة</label>
                <textarea required rows={5} value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange resize-none" placeholder="اشرح المشكلة بالتفصيل: ماذا حدث؟ ماذا توقعت أن يحدث؟ ما الخطوات التي أدت إليها؟" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">بريدك الإلكتروني (للتواصل معك)</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="email@example.com" />
              </div>
              <button type="submit" className="w-full bg-orange hover:bg-orange-dark text-white py-3 rounded-xl font-bold transition-colors">إرسال البلاغ</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
