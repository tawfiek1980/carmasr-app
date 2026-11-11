import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function BackButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="flex items-center justify-center w-9 h-9 text-white hover:bg-white/10 rounded-lg transition-colors"
      aria-label="رجوع"
    >
      <ArrowRight className="w-5 h-5" />
    </button>
  );
}
