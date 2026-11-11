import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import type { User } from "../types";

/**
 * إنشاء مستخدم جديد إذا لم يكن موجودًا
 */
export const createUserIfNotExists = async (
  firebaseUser: User
): Promise<User> => {
  const userRef = doc(db, "users", firebaseUser.id);

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, firebaseUser);
    return firebaseUser;
  }

  return snapshot.data() as User;
};

/**
 * جلب بيانات المستخدم
 */
export const getUser = async (
  uid: string
): Promise<User | null> => {
  const userRef = doc(db, "users", uid);

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) return null;

  return snapshot.data() as User;
};

/**
 * تحديث بيانات المستخدم
 */
export const updateUser = async (
  uid: string,
  data: Partial<User>
) => {
  const userRef = doc(db, "users", uid);

  await updateDoc(userRef, data);
};