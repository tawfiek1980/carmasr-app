import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { User } from "../types";
import { auth } from "../lib/auth";
import { firebaseAuth } from "../firebase";
import { handleFacebookRedirectResult } from "../auth/facebookAuth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isAppNative(): boolean {
  try {
    const cap = (window as any).Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    return window.location.protocol === 'capacitor:';
  } catch { return false; }
}

// مستني Firebase يجيب الجلسة الحالية (لحد timeout_ms) — أو null
function waitForFirebaseUser(timeout_ms: number) {
  return new Promise<any>((resolve) => {
    let done = false;
    const finish = (u: any) => { if (!done) { done = true; clearTimeout(timer); resolve(u); } };
    const timer = setTimeout(() => finish(firebaseAuth.currentUser || null), timeout_ms);
    try {
      const unsub = firebaseAuth.onAuthStateChanged((u: any) => {
        finish(u || null);
        try { unsub(); } catch {}
      });
    } catch { finish(firebaseAuth.currentUser || null); }
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // تحقق من نتيجة Facebook Redirect لو كانت موجودة
      try {
        const redirectUser = await handleFacebookRedirectResult();
        if (redirectUser?.id) {
          setUser(redirectUser);
          setLoading(false);
          return;
        }
      } catch {}

      // جيب المستخدم من localStorage
      const currentUser = auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        // نساوي تطابق صلاحية الأدمن بين الواجهة والسيرفر (users/<uid>.type)
        // والتأكد إن doc المستخدم موجود — لإن verifyAdmin بيعتمد عليه مش localStorage
        try {
          const uid = firebaseAuth.currentUser?.uid;
          if (uid) {
            const { ensureServerUserDoc } = await import('../lib/userService');
            const isAdmin = await ensureServerUserDoc(uid, currentUser);
            if (isAdmin && currentUser.type !== 'admin') {
              const updated = { ...currentUser, type: 'admin' as const };
              auth.setUser(updated);
              setUser(updated);
            }
          }
        } catch {}
      } else {
        // استرجاع تلقائي: لو localStorage فاضي/ممسوح بس جلسة Firebase لسه موجودة
        // (بيحصل لما دومين التطبيق يتغيّر — زي الانتقال من localhost للموقع الحي)
        try {
          const fbUser = await waitForFirebaseUser(3000);
          if (fbUser) {
            let restored: User | null = null;
            try {
              const { getUserFromDB } = await import('../lib/userService');
              restored = await getUserFromDB(fbUser.uid);
            } catch {}
            if (!restored) {
              restored = {
                id: fbUser.uid,
                name: fbUser.displayName || (fbUser.email ? fbUser.email.split("@")[0] : "مستخدم"),
                email: fbUser.email || "",
                phone: fbUser.phoneNumber || "",
                governorate: "",
                type: "individual",
              } as User;
            }
            try {
              const { syncAdminClaim } = await import('../lib/userService');
              if (await syncAdminClaim()) restored = { ...restored, type: "admin" as const };
            } catch {}
            auth.setUser(restored);
            setUser(restored);
          }
        } catch {}
      }
      setLoading(false);
    };

    init();
  }, []);

  const login  = (u: User) => { auth.setUser(u); setUser(u); };
  const logout = ()         => {
    auth.logout();
    setUser(null);
    try { firebaseAuth.signOut(); } catch {}
    // في تطبيق الأندرويد: نشيل كمان الجلسة الأصلية (native) وإلا سيبقى متسجل عند فتح التطبيق
    if (isAppNative()) {
      try {
        import("@capacitor-firebase/authentication").then((m: any) => m.FirebaseAuthentication?.signOut()).catch(() => {});
      } catch {}
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
