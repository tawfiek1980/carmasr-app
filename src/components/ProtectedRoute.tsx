import { Navigate } from "react-router-dom";
import { auth } from "../lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({
  children,
  adminOnly = false,
}: ProtectedRouteProps) {
  // لو مش مسجل دخول
  if (!auth.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const user = auth.getUser();

  // احتياط لو مفيش user
  if (!user) {
    auth.logout();
    return <Navigate to="/login" replace />;
  }

  // لو Admin route
  if (adminOnly && user.type !== "admin") {
    return <Navigate to="/" replace />;
  }

  // 🔥 إجبار استكمال البروفايل
  const isProfileComplete =
    !!user.name &&
    !!user.phone &&
    !!user.governorate &&
    user.name.trim() !== "" &&
    user.phone.trim() !== "" &&
    user.governorate.trim() !== "";

  // لو البيانات ناقصة → يروح Complete Profile
  if (!isProfileComplete && window.location.pathname !== "/complete-profile") {
    return <Navigate to="/complete-profile" replace />;
  }

  return <>{children}</>;
}