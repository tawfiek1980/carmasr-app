import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import type { User } from "../types";
import { notifyWhatsApp } from "./notifyWhatsApp";
import { campaignForSignup, trackEvent } from "./analytics";
import { getApiUrl } from "./config";
import { firebaseAuth } from "../firebase";

// صلاحية الأدمن تُحدَّد سيرفريًا عبر Custom Claim (token.admin).
// كانت تُكتب type:'admin' من العميل — الآن القاعدة تمنع ذلك، ونتصل بالسيرفر بدلاً منها.
export const syncAdminClaim = async (): Promise<boolean> => {
  try {
    const cu = firebaseAuth.currentUser;
    if (!cu) return false;
    const token = await cu.getIdToken();
    const res = await fetch(`${getApiUrl()}/admin?action=sync-self`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    if (data?.admin) {
      try { await cu.getIdToken(true); } catch {}
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const ADMIN_EMAILS = ["tawfiek.fayez@gmail.com", "tawfiek1980@gmail.com"];
// أرقام تليفون الأدمن (بدون صفر البداية): 01018870145 => 1018870145 ، 01277177710 => 1277177710
const ADMIN_PHONES = ["1018870145", "1277177710"];

export const normalizePhoneForCompare = (phone: string): string => {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("0020")) return d.slice(3);                                 // 00201018870145
  if (d.startsWith("20") && d.length === 12) return d.slice(2);                // +201018870145
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);                 // 01018870145
  return d.replace(/^0+/, "");                                                 // 1018870145
};

export const isAdminPhone = (phone: string): boolean =>
  ADMIN_PHONES.includes(normalizePhoneForCompare(phone));

export const createUserIfNotExists = async (
  user: Partial<User> & { id: string; email: string },
  method: string = "social"
): Promise<User> => {
  const ref = doc(db, "users", user.id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const defaultUser: User = {
      id: user.id,
      name: user.name || "مستخدم جديد",
      email: user.email,
      phone: user.phone || "",
      whatsapp: user.whatsapp || user.phone || "",
      type: user.type || "individual",
      governorate: user.governorate || "القاهرة",
      city: user.city || "",
      currentLocation: user.currentLocation || "",
      avatar: user.avatar || "",
      drivingType: user.drivingType || "",
      experienceYears: user.experienceYears || 0,
      businessName: user.businessName || "",
      specialization: user.specialization || "",
      verified: user.verified || false,
      createdAt: user.createdAt || new Date().toISOString(),
      ...campaignForSignup(),
    };

    await setDoc(ref, {
      ...defaultUser,
      updatedAt: serverTimestamp(),
    });

    trackEvent("sign_up", { method });

    notifyWhatsApp('new-user', { name: defaultUser.name, phone: defaultUser.phone, type: defaultUser.type, governorate: defaultUser.governorate });

    try {
      const { notificationsService } = await import('./firestoreService');
      await notificationsService.notifyWelcome(defaultUser.id, defaultUser.name);
    } catch {}

    // الأدمن يُمنح سيرفريًا عبر Custom Claim (لا نكتب type:'admin' من العميل)
    if (await syncAdminClaim()) defaultUser.type = "admin";

    return defaultUser;
  }

  const existing = snap.data() as User;
  if (await syncAdminClaim()) return { ...existing, type: "admin" as const };
  return existing;
};

export const getUserFromDB = async (
  id: string
): Promise<User | null> => {
  const ref = doc(db, "users", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  return snap.data() as User;
};

export const updateUser = async (
  id: string,
  data: Partial<User>
): Promise<void> => {
  const ref = doc(db, "users", id);

  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const userExists = async (
  id: string
): Promise<boolean> => {
  const ref = doc(db, "users", id);
  const snap = await getDoc(ref);
  return snap.exists();
};

// يضمن وجود doc المستخدم في قاعدة البيانات وتطابق صلاحية الأدمن بين الواجهة والسيرفر،
// لأن السيرفر (verifyAdmin) بيقرأ users/<uid>.type ولا بيعتمد على localStorage.
export const ensureServerUserDoc = async (
  uid: string,
  local: Partial<User> | null
): Promise<boolean> => {
  if (!uid) return false;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    if (!local) return await syncAdminClaim(); // مش عندنا بيانات للإنشاء
    await setDoc(ref, {
      id: uid,
      name: local.name || "مستخدم جديد",
      email: local.email || "",
      phone: local.phone || "",
      whatsapp: local.whatsapp || local.phone || "",
      type: "individual",
      governorate: local.governorate || "القاهرة",
      city: local.city || "",
      currentLocation: local.currentLocation || "",
      avatar: local.avatar || "",
      drivingType: local.drivingType || "",
      experienceYears: local.experienceYears || 0,
      businessName: local.businessName || "",
      specialization: local.specialization || "",
      verified: local.verified || false,
      createdAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
    return await syncAdminClaim();
  }

  // الأدمن يُمنح سيرفريًا عبر Custom Claim (لا نرقّي من العميل)
  return await syncAdminClaim();
};

export const completeProfile = async (
  id: string,
  profile: Partial<User>
): Promise<void> => {
  await updateUser(id, profile);
};