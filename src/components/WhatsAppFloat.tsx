import { useState, useEffect, useRef } from "react";
import { X, Phone, MessageCircle } from "lucide-react";
import { getWhatsAppLink, getPhoneLink } from "../lib/utils";

const WHATSAPP_NUMBER = "01018870145";
const MSG = "السلام عليكم، محتاج مساعدة في تطبيق كار مصر";

export const WHATSAPP_STORAGE_KEY = 'tareeq_whatsapp_disabled';

export function isWhatsAppDisabled(): boolean {
  try {
    return document.cookie.split(';').some(c => c.trim().startsWith(`${WHATSAPP_STORAGE_KEY}=1`));
  } catch {
    return false;
  }
}

export function setWhatsAppDisabled(disabled: boolean): void {
  try {
    if (disabled) {
      document.cookie = `${WHATSAPP_STORAGE_KEY}=1; path=/; max-age=2147483647`;
    } else {
      document.cookie = `${WHATSAPP_STORAGE_KEY}=; path=/; max-age=0`;
    }
  } catch {
    /* ignore */
  }
}

export default function WhatsAppFloat() {
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(() => isWhatsAppDisabled());
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // السماح بإعادة الظهور من البروفايل أو صفحة اتصل بنا عبر الحدث
    const onEnable = () => setDisabled(false);
    window.addEventListener('tareeq:enable-whatsapp', onEnable);
    return () => window.removeEventListener('tareeq:enable-whatsapp', onEnable);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const hideForever = () => {
    setDisabled(true);
    setWhatsAppDisabled(true);
    setOpen(false);
  };

  if (disabled) return null;

  return (
    <div ref={boxRef} className="fixed bottom-24 sm:bottom-6 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-64 p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-gray-800">محتاج مساعدة؟</p>
          </div>
          <a
            href={getWhatsAppLink(WHATSAPP_NUMBER, MSG)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-full bg-[#25D366] hover:bg-[#1fb958] text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-colors"
          >
            <MessageCircle className="w-4 h-4" /> تواصل عبر واتساب
          </a>
          <a
            href={getPhoneLink(WHATSAPP_NUMBER)}
            className="flex items-center gap-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2.5 rounded-xl transition-colors"
          >
            <Phone className="w-4 h-4" /> اتصال مباشر
          </a>
          <button
            onClick={() => setOpen(false)}
            type="button"
            className="w-full text-[11px] text-gray-400 hover:text-gray-600 pt-0.5 text-center transition-colors"
          >
            إغلاق
          </button>
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          type="button"
          title="تواصل معنا واتساب"
          aria-label="تواصل معنا واتساب"
          className="w-14 h-14 rounded-full bg-[#25D366] shadow-lg shadow-green-600/30 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
        >
          {open ? (
            <X className="w-7 h-7" />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          )}
        </button>

        <button
          onClick={hideForever}
          type="button"
          title="إخفاء زر واتساب نهائياً"
          aria-label="إخفاء زر واتساب نهائياً"
          className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-white text-gray-400 hover:text-red-500 border border-gray-200 shadow-md flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}