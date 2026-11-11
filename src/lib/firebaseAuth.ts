import { firebaseAuth, db } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  const result = await signInWithPopup(firebaseAuth, provider);

  const firebaseUser = result.user;

  const userRef = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(userRef);

  // أول مرة
  if (!snap.exists()) {
    const newUser = {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || "User",
      email: firebaseUser.email || "",
      phone: "",
      governorate: "",
      type: "individual",
      verified: true,
      createdAt: new Date().toISOString(),
    };

    await setDoc(userRef, newUser);
    return newUser;
  }

  return snap.data();
};