import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, firebaseAuth } from "../firebase";
import { toast as showToast, type ToastVariant } from "../components/Toast";
import type { TareeqNotification } from "../types";

interface NotificationContextType {
  notifications: TareeqNotification[];
  unreadCount: number;
  loading: boolean;
  toast: (message: string, variant?: ToastVariant) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<TareeqNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let disposed = false;

    const stopListening = () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };

    const startListening = (uid: string) => {
      stopListening();
      setLoading(true);

      const q = query(
        collection(db, "notifications"),
        where("userId", "==", uid),
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          if (disposed) return;
          const list: TareeqNotification[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              userId: data.userId,
              type: data.type,
              title: data.title,
              body: data.body,
              read: data.read || false,
              listingId: data.listingId,
              url: data.url,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
            });
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setNotifications(list);
          setLoading(false);
        },
        (err) => {
          console.error("Notifications listener error:", err);
          setLoading(false);
        }
      );

      unsubRef.current = unsub;
    };

    const unsubAuth = onAuthStateChanged(firebaseAuth, (fbUser) => {
      if (disposed) return;
      if (fbUser) {
        startListening(fbUser.uid);
      } else {
        stopListening();
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
      unsubAuth();
      stopListening();
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    showToast(message, variant);
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      console.error("markAsRead error:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const unread = notifications.filter((n) => !n.read);
      if (unread.length === 0) return;
      const batch = writeBatch(db);
      unread.forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
      await batch.commit();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("markAllAsRead error:", err);
    }
  }, [notifications]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, toast, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}
