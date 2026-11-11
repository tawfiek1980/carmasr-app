import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

const counted = new Set<string>();

export function bumpExhibitionView(id?: string | null) {
  if (!id) return;
  const key = `view:${id}`;
  if (counted.has(key)) return;
  counted.add(key);
  updateDoc(doc(db, 'exhibitions', id), { views: increment(1) }).catch(() => {});
}

export function bumpExhibitionContact(id?: string | null) {
  if (!id) return;
  const key = `contact:${id}`;
  if (counted.has(key)) return;
  counted.add(key);
  updateDoc(doc(db, 'exhibitions', id), { contacts: increment(1) }).catch(() => {});
}
