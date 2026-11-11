import { GoogleAuthProvider, signInWithPopup, signInWithCredential } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { createUserIfNotExists } from "../lib/userService";
import type { User } from "../types";

const provider = new GoogleAuthProvider();

export function isCapacitor(): boolean {
  try {
    const cap = (window as any).Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    return window.location.protocol === 'capacitor:';
  } catch { return false; }
}

export async function processGoogleUser(firebaseUser: any): Promise<User> {
  if (!firebaseUser) throw new Error("No Firebase user returned");

  const user: User = {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || "مستخدم جديد",
    email: firebaseUser.email || "",
    phone: firebaseUser.phoneNumber || "",
    avatar: firebaseUser.photoURL || "",
    governorate: "",
    verified: firebaseUser.emailVerified,
    type: "individual",
    createdAt: new Date().toISOString(),
  };

  return await createUserIfNotExists(user, "google");
}

export const signInWithGoogle = async (): Promise<User> => {

  if (isCapacitor()) {
    try {
      const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
      const result = await FirebaseAuthentication.signInWithGoogle();

      // الأهم: نسلّم الجلسة في الـweb SDK عبر idToken (signInWithCredential) بدل الاعتماد
      // على الربط التلقائي غير الثابت. كان الـweb SDK بيفصل من غير صلاحية → كل
      // عمليات Firestore بتتنكب بـ permission-denied.
      const idToken = result.credential?.idToken;
      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(firebaseAuth, credential);
        return await processGoogleUser(userCredential.user);
      }

      // لو الركن مش موجود لكن النشطة bridge سلّم الجلسة فعلا (صلاحية مستخدم جاهز)
      if (result.user?.uid) {
        const firebaseUser = firebaseAuth.currentUser;
        if (firebaseUser && firebaseUser.uid === result.user.uid) {
          return await processGoogleUser(firebaseUser);
        }
        throw new Error("لم يتم ربط جلسة الدخول بشكل صحيح — أعد المحاولة");
      }

      throw new Error("لم يتم استلام بيانات تسجيل الدخول");
    } catch (error: any) {
      console.error("🔴 Capacitor Google Sign-In error:", error?.code, error?.message);
      throw error;
    }
  }

  const result = await signInWithPopup(firebaseAuth, provider);
  return await processGoogleUser(result.user);
};

export const handleGoogleRedirectResult = async (): Promise<User | null> => {
  // No longer needed — native plugin handles everything inline
  return null;
};
