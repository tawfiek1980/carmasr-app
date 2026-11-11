import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, X, Info } from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

let toastId = 0;
let addToastFn: ((t: Omit<ToastItem, "id">) => void) | null = null;

export function toast(message: string, variant: ToastVariant = "info") {
  addToastFn?.({ message, variant });
}

const icons: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colors: Record<ToastVariant, string> = {
  success: "bg-success text-white",
  error: "bg-danger text-white",
  warning: "bg-warning text-white",
  info: "bg-navy text-white",
};

export default function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    addToastFn = (t) => {
      const id = String(++toastId);
      setItems((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }, 4000);
    };
    return () => { addToastFn = null; };
  }, []);

  const remove = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
      {items.map((item) => {
        const Icon = icons[item.variant];
        return (
          <div
            key={item.id}
            className={`${colors[item.variant]} rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 pointer-events-auto animate-slide-down`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 text-sm font-medium">{item.message}</span>
            <button onClick={() => remove(item.id)} className="opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
