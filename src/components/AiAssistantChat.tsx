import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { getApiUrl } from '../lib/config';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export const CHAT_STORAGE_KEY = 'tareeq_chat_disabled';

export function isChatDisabled(): boolean {
  try {
    return document.cookie.split(';').some(c => c.trim().startsWith(`${CHAT_STORAGE_KEY}=1`));
  } catch {
    return false;
  }
}

export function setChatDisabled(disabled: boolean): void {
  try {
    if (disabled) {
      document.cookie = `${CHAT_STORAGE_KEY}=1; path=/; max-age=2147483647`;
    } else {
      document.cookie = `${CHAT_STORAGE_KEY}=; path=/; max-age=0`;
    }
  } catch {
    /* ignore */
  }
}

const SUGGESTIONS = [
  'كيف أنشر إعلاناً؟',
  'كيف أطلب تمويلاً؟',
  'كم سعر الباقات؟',
  'كيف أتواصل مع بائع؟',
  'كيف أحذف حسابي؟',
];

export default function AiAssistantChat() {
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisabled(isChatDisabled());
    // السماح بالفتح أو الإخفاء من أي مكان عبر الحدث — الـ widget لا يُعاد تركيبه بين الصفحات
    const onEnable = () => { setDisabled(false); setOpen(true); };
    const onDisable = () => { setDisabled(true); setOpen(false); };
    window.addEventListener('tareeq:enable-chat', onEnable);
    window.addEventListener('tareeq:disable-chat', onDisable);
    return () => {
      window.removeEventListener('tareeq:enable-chat', onEnable);
      window.removeEventListener('tareeq:disable-chat', onDisable);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  const send = async (text: string) => {
    const q = (text || input).trim();
    if (!q || busy) return;
    setInput('');
    setOffline(false);
    setMessages(m => [...m, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const res = await fetch(`${getApiUrl()}/ai/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assistant', question: q, history: messages }),
      });
      const data = await res.json();
      if (data.ok && data.answer) {
        setMessages(m => [...m, { role: 'assistant', content: data.answer }]);
      } else {
        setOffline(true);
        setMessages(m => [...m, { role: 'assistant', content: data.message || 'المساعد غير متاح الآن — تواصل مع الدعم من /support' }]);
      }
    } catch {
      setOffline(true);
      setMessages(m => [...m, { role: 'assistant', content: 'تعذر الاتصال — راجع صفحة الأسئلة الشائعة أو تواصل مع الدعم.' }]);
    } finally {
      setBusy(false);
    }
  };

  if (disabled) return null;

  return (
    <>
      {/* زر الفتح */}
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 left-5 z-40 w-14 h-14 rounded-full bg-gradient-to-l from-orange to-orange-dark text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="المساعد الذكي">
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {/* لوحة الشات */}
      {open && (
        <div className="fixed bottom-24 left-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
          style={{ height: 'min(60vh, 480px)' }}>
          <div className="bg-navy text-white px-4 py-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange" />
            <div className="flex-1">
              <p className="text-sm font-bold">مساعد كار مصر</p>
              <p className="text-[10px] text-gray-300">ذكاء اصطناعي — يساعدك في أي استفسار</p>
            </div>
            <button
              onClick={() => { setDisabled(true); setChatDisabled(true); setOpen(false); }}
              title="إغلاق المساعد نهائياً"
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/80 text-gray-300 hover:text-white flex items-center justify-center transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-bg">
            {messages.length === 0 && (
              <>
                <div className="bg-white rounded-xl rounded-tr-sm p-3 text-sm text-gray-700 border border-gray-100 shadow-sm">
                  أهلاً 👋 أنا مساعد كار مصر، أساعدك في نشر الإعلانات، الحمولات، التمويل، الباقات وأي شيء آخر.
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="text-[11px] bg-white border border-orange/30 text-orange px-2.5 py-1.5 rounded-full hover:bg-orange/5 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm shadow-sm ${
                  m.role === 'user'
                    ? 'bg-orange text-white rounded-tr-sm'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-end">
                <div className="bg-white border border-gray-100 rounded-xl rounded-tl-sm px-3 py-2 flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري التفكير...
                </div>
              </div>
            )}
            {offline && messages.length > 0 && (
              <p className="text-center text-[10px] text-gray-400 pt-1">
                المساعد الذكي متاح بعد تفعيل المفتاح — حتى ذلك الحين يمكنك التواصل مع الدعم.
              </p>
            )}
          </div>

          <form onSubmit={e => { e.preventDefault(); send(input); }} className="p-2.5 border-t border-gray-100 flex items-center gap-2 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="اكتب سؤالك..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
            />
            <button type="submit" disabled={busy || !input.trim()}
              className="w-10 h-10 bg-orange hover:bg-orange-dark disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
