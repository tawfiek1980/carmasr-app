import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, ChevronLeft, User, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { chatService } from "../../services/chatService";
import type { Conversation } from "../../types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} ي`;
  return new Date(dateStr).toLocaleDateString("ar-EG");
}

export default function Inbox() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsub = chatService.getConversations(user.id, (convs) => {
      setConversations(convs);
      setLoading(false);
    }, (err) => {
      console.error("Conversations listener error:", err);
      setError("فشل تحميل الرسائل");
      setLoading(false);
    });

    unsubRef.current = unsub;

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">الرسائل</span>
          </nav>
          <h1 className="text-2xl font-bold">الرسائل</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : error ? (
          <div className="bg-surface rounded-2xl border border-border p-10 text-center">
            <AlertCircle className="w-14 h-14 text-red-300 mx-auto mb-4" />
            <h2 className="font-bold text-text mb-2">خطأ في التحميل</h2>
            <p className="text-text-light text-sm">{error}</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-10 text-center">
            <MessageCircle className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <h2 className="font-bold text-text mb-2">لا توجد رسائل</h2>
            <p className="text-text-light text-sm">عندما ترسل رسالة لبائع أو يرسل لك أحدهم رسالة، ستظهر هنا.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const otherId = conv.participants.find((id) => id !== user.id) || "";
              const other = conv.participantsData[otherId] || { name: "مستخدم" };
              const unread = conv.unreadCount[user.id] || 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/inbox/${otherId}`)}
                  className="w-full text-right bg-surface rounded-2xl border border-border p-4 flex items-center gap-3 hover:shadow-sm transition-all"
                >
                  <div className="w-11 h-11 rounded-full bg-navy/10 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                    {other.avatar ? (
                      <img src={other.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-navy/40 dark:text-white/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${unread > 0 ? "font-bold text-text" : "text-text"}`}>
                        {other.name}
                      </span>
                      <span className="text-[10px] text-text-light flex-shrink-0">{timeAgo(conv.lastMessageAt)}</span>
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${unread > 0 ? "font-semibold text-text" : "text-text-light"}`}>
                      {conv.lastSenderId === user.id ? "أنت: " : ""}{conv.lastMessage}
                    </p>
                    {conv.listingTitle && (
                      <p className="text-[10px] text-orange mt-0.5 truncate">بخصوص: {conv.listingTitle}</p>
                    )}
                  </div>
                  {unread > 0 && (
                    <div className="w-5 h-5 rounded-full bg-orange text-white text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">
                      {unread}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
