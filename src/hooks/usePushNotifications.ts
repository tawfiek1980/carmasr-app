import { useEffect, useState } from 'react';
import { firebaseAuth } from '../firebase';

const SUB_KEY = 'tareeq_push_subscribed';

async function authHeaders(): Promise<Record<string, string>> {
  const base: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const user = firebaseAuth.currentUser;
    if (user) base['Authorization'] = `Bearer ${await user.getIdToken()}`;
  } catch {}
  return base;
}

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unset'>('unset');
  const [subscribed, setSubscribed] = useState(false);
  const [publicKey, setPublicKey] = useState('');

  useEffect(() => {
    const hasNotif = 'Notification' in window;
    setSupported(hasNotif && 'serviceWorker' in navigator && 'PushManager' in window);
    if (hasNotif) setPermission(Notification.permission === 'default' ? 'unset' : Notification.permission);
    setSubscribed(localStorage.getItem(SUB_KEY) === 'true');
    fetch('/api/push').then(r => r.json()).then(d => setPublicKey(d.publicKey || '')).catch(() => {});
  }, []);

  const subscribe = async (userId?: string) => {
    if (!supported || !publicKey || !userId) return;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as any,
      });

      await fetch('/api/push', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          action: 'subscribe',
          subscription: sub.toJSON(),
          userId,
        }),
      });

      localStorage.setItem(SUB_KEY, 'true');
      setSubscribed(true);
    } catch {}
  };

  const unsubscribe = async (userId?: string) => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      if (userId) {
        await fetch('/api/push', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ action: 'unsubscribe', userId }),
        });
      }
    } catch {}

    localStorage.removeItem(SUB_KEY);
    setSubscribed(false);
  };

  return { supported, permission, subscribed, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
