import { Wrench } from 'lucide-react';
export default function Maintenance() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-navy">
      <div className="text-center max-w-md">
        <img src="/app-icon-128.png" alt="كار مصر" className="h-16 w-16 mx-auto mb-6 object-contain" />
        <Wrench className="w-14 h-14 text-orange mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-3">المنصة قيد الصيانة</h1>
        <p className="text-gray-400 mb-6">نعمل حالياً على تحسين الخدمة لتقديم تجربة أفضل لك. سنعود قريباً!</p>
        <div className="bg-white/10 rounded-xl px-6 py-3 inline-block">
          <p className="text-orange font-semibold text-sm">الوقت المتوقع للعودة: خلال ساعتين</p>
        </div>
        <div className="mt-6 text-gray-500 text-sm">
          للاستفسار: <a href="mailto:tawfiek.fayez@gmail.com" className="text-orange hover:underline">tawfiek.fayez@gmail.com</a>
        </div>
      </div>
    </div>
  );
}
