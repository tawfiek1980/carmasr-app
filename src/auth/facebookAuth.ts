import {
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { createUserIfNotExists } from "../lib/userService";
import { auth } from "../lib/auth";
import type { User } from "../types";

const provider = new FacebookAuthProvider();
provider.addScope("email");
provider.addScope("public_profile");

export const signInWithFacebook = async (): Promise<User> => {
  try {
    // جرّب Popup أول
    const result = await signInWithPopup(firebaseAuth, provider);
    const firebaseUser = result.user;

    const user: User = {
      id:         firebaseUser.uid,
      name:       firebaseUser.displayName || "مستخدم جديد",
      email:      firebaseUser.email || "",
      phone:      firebaseUser.phoneNumber || "",
      avatar:     firebaseUser.photoURL || "",
      governorate:"",
      verified:   firebaseUser.emailVerified,
      type:       "individual",
      createdAt:  new Date().toISOString(),
    };

    const dbUser = await createUserIfNotExists(user, "facebook");
    auth.setUser(dbUser);
    return dbUser;

  } catch (error: any) {
    // لو Popup اتمنع — استخدم Redirect
    if (
      error.code === "auth/popup-blocked" ||
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request"
    ) {
      await signInWithRedirect(firebaseAuth, provider);
      // الصفحة هتتحمّل من أول بعد الـ redirect
      return {} as User;
    }
    console.error("Facebook Login Error:", error);
    throw error;
  }
};

// استدعيها في App.tsx أو AuthContext عشان تتعامل مع نتيجة الـ redirect
export const handleFacebookRedirectResult = async (): Promise<User | null> => {
  try {
    const result = await getRedirectResult(firebaseAuth);
    if (!result) return null;

    const firebaseUser = result.user;
    const user: User = {
      id:         firebaseUser.uid,
      name:       firebaseUser.displayName || "مستخدم جديد",
      email:      firebaseUser.email || "",
      phone:      firebaseUser.phoneNumber || "",
      avatar:     firebaseUser.photoURL || "",
      governorate:"",
      verified:   firebaseUser.emailVerified,
      type:       "individual",
      createdAt:  new Date().toISOString(),
    };

    const dbUser = await createUserIfNotExists(user, "facebook");
    auth.setUser(dbUser);
    return dbUser;
  } catch (error) {
    console.error("Facebook Redirect Error:", error);
    return null;
  }
};
