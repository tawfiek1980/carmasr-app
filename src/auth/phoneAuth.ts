import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { firebaseAuth, db } from "../firebase";
import { auth as localAuth } from "../lib/auth";
import { syncAdminClaim } from "../lib/userService";
import { campaignForSignup } from "../lib/analytics";
import type { User } from "../types";

let recaptchaVerifier: RecaptchaVerifier | null = null;

const formatPhone = (phone: string): string => {
  let formatted = phone.trim().replace(/\s+/g, "");
  if (!formatted.startsWith("+")) {
    formatted = formatted.replace(/^0+/, "");
    formatted = `+20${formatted}`;
  }
  return formatted;
};

export const setupRecaptcha = () => {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, "recaptcha-container", {
      size: "invisible",
    });
  }
};

export const sendOTP = async (phone: string): Promise<ConfirmationResult> => {
  const formatted = formatPhone(phone);
  setupRecaptcha();
  if (!recaptchaVerifier) throw new Error("reCAPTCHA not initialized");
  return signInWithPhoneNumber(firebaseAuth, formatted, recaptchaVerifier);
};

export const verifyOTP = async (
  confirmation: ConfirmationResult,
  code: string
): Promise<User> => {
  const result = await confirmation.confirm(code);
  const firebaseUser = result.user;
  const userId = firebaseUser.uid;
  const phone = firebaseUser.phoneNumber || "";

  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);

  let user: User;
  if (snap.exists()) {
    user = { id: userId, ...snap.data() } as User;
  } else {
    user = {
      id: userId,
      name: "",
      email: "",
      phone,
      governorate: "",
      type: "individual",
      verified: true,
      avatar: "",
      createdAt: new Date().toISOString(),
    };
    await setDoc(userRef, { ...user, ...campaignForSignup(), createdAt: serverTimestamp() });
  }

  // صلاحية الأدمن تُمنح سيرفريًا (Custom Claim) — الرقم هنا موثّق عبر OTP
  if (await syncAdminClaim()) user = { ...user, type: "admin" };

  localAuth.setUser(user);
  return user;
};
