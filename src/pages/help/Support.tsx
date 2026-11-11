import { HeadphonesIcon, Phone, Mail, MessageCircle, Clock, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function Support() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">الدعم الفني</span>
          </nav>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center">
              <HeadphonesIcon className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-3xl font-bold">الدعم الفني</h1>
          </div>

          <p className="text-gray-300">فريقنا جاهز لمساعدتك في أي استفسار</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <a
            href="tel:01277177710"
            className="bg-surface rounded-2xl border border-border p-5 flex flex-col items-center gap-2 text-center hover:border-orange transition-colors"
          >
            <Phone className="w-8 h-8 text-orange" />
            <span className="font-bold text-text">اتصل بنا</span>
            <span className="text-text-light text-sm">0127 717 7710</span>
            <div className="flex items-center gap-1 text-xs text-success">
              <Clock className="w-3.5 h-3.5" />
              السبت–الخميس 9ص–9م
            </div>
          </a>

          <a
            href="mailto:tawfiek.fayez@gmail.com"
            className="bg-surface rounded-2xl border border-border p-5 flex flex-col items-center gap-2 text-center hover:border-orange transition-colors"
          >
            <Mail className="w-8 h-8 text-orange" />
            <span className="font-bold text-text">البريد الإلكتروني</span>
            <span className="text-text-light text-sm">tawfiek.fayez@gmail.com</span>
            <div className="flex items-center gap-1 text-xs text-text-light">
              <Clock className="w-3.5 h-3.5" />
              رد خلال 24 ساعة
            </div>
          </a>

          <a
            href="https://wa.me/201277177710"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-surface rounded-2xl border border-border p-5 flex flex-col items-center gap-2 text-center hover:border-orange transition-colors"
          >
            <MessageCircle className="w-8 h-8 text-orange" />
            <span className="font-bold text-text">واتساب</span>
            <span className="text-text-light text-sm">0127 717 7710</span>
            <div className="flex items-center gap-1 text-xs text-success">
              <Clock className="w-3.5 h-3.5" />
              متاح يومياً
            </div>
          </a>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text text-lg mb-5">أرسل رسالة مباشرة</h2>

          {sent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <HeadphonesIcon className="w-8 h-8 text-success" />
              </div>
              <h3 className="font-bold text-text mb-2">تم إرسال رسالتك!</h3>
              <p className="text-text-light text-sm">سيتواصل معك فريق الدعم خلال 24 ساعة</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text mb-1.5">الاسم</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange"
                    placeholder="اسمك الكامل"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text mb-1.5">رقم الهاتف</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange"
                    placeholder="01XXXXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">البريد الإلكتروني</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">موضوع الرسالة</label>
                <select
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange bg-white"
                >
                  <option value="">اختر الموضوع</option>
                  <option>مشكلة في الحساب</option>
                  <option>مشكلة في إعلان</option>
                  <option>استفسار عن التمويل</option>
                  <option>الإبلاغ عن احتيال</option>
                  <option>اقتراح أو شكوى</option>
                  <option>أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">تفاصيل المشكلة</label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange resize-none"
                  placeholder="اشرح مشكلتك بالتفصيل..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-orange hover:bg-orange-dark text-white py-3 rounded-xl font-bold transition-colors"
              >
                إرسال الرسالة
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
