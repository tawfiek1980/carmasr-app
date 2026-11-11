import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, User, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { chatService } from "../../services/chatService";
import { notificationsService } from "../../lib/firestoreService";
import api from "../../lib/api";
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth } from "../../firebase";
import type { Message } from "../../types";

export default function Chat() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("مستخدم");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user || !userId) return;

    let cancelled = false;

    const init = async () => {
      try {
        const selfId = firebaseAuth.currentUser?.uid || user.id;
        const id = await chatService.createOrGetConversation(selfId, userId);
        if (cancelled) return;
        setConvId(id);

        const userSnap = await getDoc(doc(db, "users", userId));
        if (!cancelled && userSnap.exists()) {
          setOtherName(userSnap.data().name || "مستخدم");
        }

        const unsubMsgs = chatService.getMessages(id, (msgs) => {
          if (!cancelled) {
            setMessages(msgs);
            setLoading(false);
          }
        }, (err) => {
          if (!cancelled) {
            console.error("Messages listener error:", err);
            setError("فشل تحميل الرسائل");
            setLoading(false);
          }
        });

        unsubRef.current = unsubMsgs;

        chatService.markAsRead(id, selfId).catch(() => {});
      } catch (err) {
        if (!cancelled) {
          console.error("Chat init error:", err);
          setError("فشل تحميل المحادثة");
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [user, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !user || !convId || !userId) return;
    setSending(true);
    setError("");
    try {
      const senderId = firebaseAuth.currentUser?.uid || user.id;
      await chatService.sendMessage(convId, senderId, text);
      setInput("");

      notificationsService.notifyNewMessage(userId, user.name, convId, senderId).catch(() => {});

      api.post('/push', {
        action: 'sendChat',
        targetUserId: userId,
        title: 'رسالة جديدة',
        body: `لديك رسالة جديدة من ${user.name}`,
        url: `/inbox/${senderId}`,
      }).catch(() => {});
    } catch (err: any) {
      console.error("Send error:", err);
      const code = err?.code || "";
      setError(
        code === "permission-denied"
          ? "مفيش صلاحية لإرسال رسالة. تأكد إنك مسجل دخول."
          : code === "unavailable" || code === "deadline-exceeded"
            ? "الاتصال ضعيف. جرب تاني."
            : "الرسالة متبعتتش. جرب تاني."
      );
    }
    setSending(false);
  }, [input, user, convId, userId]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="bg-navy dark:bg-surface dark:border-b dark:border-border text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/inbox")} className="p-1 hover:text-orange transition-colors">
          <ArrowLeft className="w-5 h-5 rtl-flip" />
        </button>
        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <User className="w-4 h-4 text-white/60" />
        </div>
        <span className="font-bold text-white">{otherName}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : error && messages.length === 0 ? (
          <div className="text-center py-16 text-red-500 text-sm">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-text-light text-sm">
            ابدأ المحادثة مع {otherName}
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === (firebaseAuth.currentUser?.uid || user.id);
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMine
                      ? "bg-navy dark:bg-navy-light text-white rounded-br-md"
                      : "bg-surface border border-border text-text rounded-bl-md"
                  }`}
                >
                  <p>{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? "text-white/50" : "text-text-light"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {error && messages.length > 0 && (
          <div className="text-center text-red-500 text-xs py-2">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="bg-surface border-t border-border p-4 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e as any); }}
          placeholder="اكتب رسالة..."
          className="flex-1 h-11 px-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="h-11 w-11 bg-orange hover:bg-orange-dark disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
