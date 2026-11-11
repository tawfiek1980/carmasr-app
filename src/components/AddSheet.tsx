import { useNavigate } from 'react-router-dom';
import { Truck, Package, HardHat, Wrench, Cog } from 'lucide-react';
import Sheet from './Sheet';
import { useAuth } from '../contexts/AuthContext';

const addOptions = [
  { label: 'شاحنة أو معدة', icon: Truck, to: '/post-listing' },
  { label: 'حمولة', icon: Package, to: '/post-listing?type=load' },
  { label: 'وظيفة', icon: HardHat, to: '/post-listing?type=job' },
  { label: 'خدمة', icon: Wrench, to: '/services' },
  { label: 'قطعة غيار', icon: Cog, to: '/post-listing?type=spare-part' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const go = (to: string) => {
    onClose();
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(to);
  };

  return (
    <Sheet open={open} onClose={onClose} title="ماذا تريد أن تضيف؟">
      <div className="space-y-2.5">
        {addOptions.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.label}
              onClick={() => go(o.to)}
              className="w-full flex items-center gap-4 p-3.5 rounded-2xl border border-border bg-white hover:border-orange/30 hover:bg-orange/5 transition-colors text-right"
            >
              <span className="w-11 h-11 rounded-xl bg-orange/10 text-orange flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <span className="font-bold text-text text-sm">{o.label}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
