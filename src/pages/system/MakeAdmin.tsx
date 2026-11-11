import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';

export default function MakeAdmin() {
  const [email,   setEmail]   = useState('');
  const [secret,  setSecret]  = useState('');
  const [showSec, setShowSec] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ ok: boolean; msg: string } | null>(null);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setResult(null);
    try {
      const res = await api.post('/auth/make-admin', { email, secret });
      setResult({ ok: true, msg: res.data.message });
    } catch (err: any) {
      setResult({ ok: false, msg: err.response?.data?.message || 'حدث خطأ' });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-12 pb-24 sm:pb-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-border overflow-hidden">

          <div className="bg-navy p-6 text-center">
            <ShieldCheck className="w-12 h-12 text-orange mx-auto mb-3" />
            <h1 className="text-xl font-bold text-white">ترقية حساب إلى أدمن</h1>
            <p className="text-gray-400 text-xs mt-1">يتطلب الرمز السري الخاص بالنظام</p>
          </div>

          <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-5 flex gap-2 text-sm text-yellow-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>تنبيه:</strong> هذه الصفحة للإعداد الأولي فقط. تأكد من تسجيل الدخول بحسابك أولاً على التطبيق قبل استخدامها.
              </div>
            </div>

            {result && (
              <div className={`rounded-xl p-3 mb-5 flex items-center gap-2 text-sm ${
                result.ok
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {result.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                {result.msg}
              </div>
            )}

            {result?.ok ? (
              <div className="text-center space-y-4">
                <p className="text-text-light text-sm">تم بنجاح! الآن:</p>
                <ol className="text-sm text-text text-right space-y-1 bg-bg rounded-xl p-4">
                  <li>١. سجّل خروجاً من التطبيق</li>
                  <li>٢. سجّل دخولاً من جديد بنفس الإيميل</li>
                  <li>٣. اذهب إلى <strong>/admin</strong></li>
                </ol>
                <div className="flex gap-3">
                  <Link to="/login" className="flex-1 text-center bg-orange hover:bg-orange-dark text-white py-2.5 rounded-xl font-bold text-sm transition-colors">
                    تسجيل الدخول
                  </Link>
                  <Link to="/admin" className="flex-1 text-center bg-navy hover:bg-navy/90 text-white py-2.5 rounded-xl font-bold text-sm transition-colors">
                    لوحة الإدارة
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handle} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-text mb-1.5">البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                    <input
                      type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full h-12 pr-11 pl-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm"
                      placeholder="نفس الإيميل المسجّل في التطبيق"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-text mb-1.5">الرمز السري (ADMIN_SECRET)</label>
                  <div className="relative">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                    <input
                      type={showSec ? 'text' : 'password'} required value={secret} onChange={e => setSecret(e.target.value)}
                      className="w-full h-12 pr-11 pl-11 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm"
                      placeholder="الرمز من ملف .env"
                    />
                    <button type="button" onClick={() => setShowSec(!showSec)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text">
                      {showSec ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-text-light mt-1.5">
                    من ملف <code className="bg-gray-100 px-1 rounded">.env</code> — المتغير <code className="bg-gray-100 px-1 rounded">ADMIN_SECRET</code>
                  </p>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full h-12 bg-navy hover:bg-navy/90 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {loading ? 'جارٍ الترقية…' : 'ترقية إلى أدمن'}
                </button>
              </form>
            )}

            <div className="mt-5 pt-4 border-t border-border text-center">
              <Link to="/" className="text-text-light hover:text-orange text-xs transition-colors">
                العودة للرئيسية
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-text-light mt-4">
          هذه الصفحة لا تعمل بدون <code className="bg-white px-1 py-0.5 rounded border border-border">ADMIN_SECRET</code> في ملف البيئة
        </p>
      </div>
    </div>
  );
}
