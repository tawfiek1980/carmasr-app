import { useOnline } from '../hooks/useOnline';

export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] bg-red-600 text-white text-center py-2.5 px-4 text-sm font-semibold">
      أنت غير متصل بالإنترنت — سيتم التحميل تلقائيًا عند عودة الاتصال
    </div>
  );
}