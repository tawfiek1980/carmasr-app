import { ReactNode, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { trackEvent } from "../lib/analytics";
import { Phone } from "lucide-react";

interface ProtectedPhoneButtonProps {
  phone?: string | null;
  children: ReactNode;
  className?: string;
}

export default function ProtectedPhoneButton({ phone, children, className }: ProtectedPhoneButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firedRef = useRef(false);

  useEffect(() => {
    if (user && phone && !firedRef.current) {
      firedRef.current = true;
      trackEvent("phone_reveal", { has_phone: true });
    }
  }, [user, phone]);

  if (!phone) return null;

  if (user) {
    return <>{children}</>;
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate("/login");
      }}
      className={`flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors cursor-pointer ${className || "px-4 py-2.5 text-xs"}`}
    >
      <Phone className="w-4 h-4" />
      عرض رقم التواصل
    </button>
  );
}
