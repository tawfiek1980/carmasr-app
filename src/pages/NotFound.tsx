import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
        <div className="w-20 h-20 bg-orange/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-10 h-10 text-orange" />
        </div>
        <h1 className="text-6xl font-extrabold text-navy mb-2">404</h1>
        <h2 className="text-xl font-bold text-text mb-3">الصفحة غير موجودة</h2>
        <p className="text-text-light text-sm mb-6">يبدو أنك تواجه صفحة لم يعد لها اتصال. تأكد من عنوان الصفحة أو العودة إلى الصفحة الرئيسية.</p>
        <div className="flex gap-3">
          <Link
            to="/"
            className="flex-1 flex items-center justify-center gap-1.5 bg-orange hover:bg-orange-dark text-white px-4 py-2.5 rounded-xl font-bold transition-colors"
          >
            <Home className="w-4 h-4" />
            الصفحة الرئيسية
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex-1 flex items-center justify-center gap-1.5 bg-bg hover:bg-gray-100 text-text px-4 py-2.5 rounded-xl font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            عودة
          </button>
        </div>
      </div>
    </div>
  );
}
