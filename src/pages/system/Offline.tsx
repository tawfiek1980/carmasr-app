import { WifiOff, RefreshCw } from 'lucide-react';
export default function Offline() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
      <div className="text-center max-w-md">
        <WifiOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-text mb-2">لا يوجد اتصال بالإنترنت</h1>
        <p className="text-text-light mb-8">تحقق من اتصالك بالإنترنت وحاول مجدداً.</p>
        <button onClick={() => window.location.reload()} className="flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors mx-auto">
          <RefreshCw className="w-4 h-4" /> إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
