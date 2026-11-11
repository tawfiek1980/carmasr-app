import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, setDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Conversation, Message } from "../types";

function toDate(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  return typeof ts === "string" ? ts : new Date().toISOString();
}

function cleanId<T>(snap: any): T {
  return { id: snap.id, ...snap.data() } as T;
}

export const chatService = {
  async createOrGetConversation(
    userId1: string,
    userId2: string,
    listingId?: string,
    listingTitle?: string,
  ): Promise<string> {
    const participants = [userId1, userId2].sort();
    const convId = participants.join("_");

    const existing = await getDoc(doc(db, "conversations", convId));
    if (existing.exists()) return convId;

    const participantsData: Record<string, { name: string; avatar?: string }> = {};
    for (const id of participants) {
      const userSnap = await getDoc(doc(db, "users", id));
      const data = userSnap.data();
      participantsData[id] = {
        name: data?.name || "مستخدم",
        avatar: data?.avatar || "",
      };
    }

    await setDoc(doc(db, "conversations", convId), {
      participants,
      participantsData,
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      lastSenderId: "",
      listingId: listingId || "",
      listingTitle: listingTitle || "",
      unreadCount: { [userId1]: 0, [userId2]: 0 },
      createdAt: serverTimestamp(),
    });

    return convId;
  },

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
  ): Promise<void> {
    const msgRef = collection(db, "conversations", conversationId, "messages");
    await addDoc(msgRef, {
      senderId,
      content,
      createdAt: serverTimestamp(),
      read: false,
    });

    const convRef = doc(db, "conversations", conversationId);
    const convSnap = await getDoc(convRef);
    const convData = convSnap.data();
    if (!convData) return;

    const receiverId = convData.participants.find((id: string) => id !== senderId);
    const unread = { ...convData.unreadCount };
    if (receiverId) {
      unread[receiverId] = (unread[receiverId] || 0) + 1;
    }

    await updateDoc(convRef, {
      lastMessage: content,
      lastMessageAt: serverTimestamp(),
      lastSenderId: senderId,
      unreadCount: unread,
    });
  },

  getConversations(
    userId: string,
    callback: (convs: Conversation[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", userId),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const convs: Conversation[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        convs.push({
          id: doc.id,
          participants: data.participants,
          participantsData: data.participantsData || {},
          lastMessage: data.lastMessage || "",
          lastMessageAt: toDate(data.lastMessageAt),
          lastSenderId: data.lastSenderId || "",
          listingId: data.listingId || "",
          listingTitle: data.listingTitle || "",
          unreadCount: data.unreadCount || {},
          createdAt: toDate(data.createdAt),
        });
      });
      // الترتيب في الذاكرة بدل orderBy (اللي كان يحتاج index مركّب غير مفعّل)
      convs.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      callback(convs);
    }, (err) => {
      console.error("getConversations error:", err);
      onError?.(err);
    });

    return unsub;
  },

  getMessages(
    conversationId: string,
    callback: (msgs: Message[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc"),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          conversationId,
          senderId: data.senderId,
          content: data.content,
          createdAt: toDate(data.createdAt),
          read: data.read || false,
        });
      });
      callback(msgs);
    }, (err) => {
      console.error("getMessages error:", err);
      onError?.(err);
    });

    return unsub;
  },

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    const convRef = doc(db, "conversations", conversationId);
    const convSnap = await getDoc(convRef);
    const convData = convSnap.data();
    if (!convData) return;

    const unread = { ...convData.unreadCount };
    unread[userId] = 0;

    await updateDoc(convRef, { unreadCount: unread });
  },

  async getUnreadCounts(userId: string): Promise<number> {
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", userId),
    );
    const snaps = await getDocs(q);
    let total = 0;
    snaps.forEach((doc) => {
      const data = doc.data();
      total += data.unreadCount?.[userId] || 0;
    });
    return total;
  },
};
