import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { ShieldCheck, Lock, KeyRound } from 'lucide-react';
import { hasPin, setupPin, verifyPin, isUnlocked, markUnlocked, lockNow } from '../../lib/adminPin';
import { logAdminAction } from '../../lib/audit';

interface Props {
  children: ReactNode;
}

export default function AdminPinGate({ children }: Props) {
  const [pinSet, setPinSet] = useState(() => hasPin());
  const [unlocked, setUnlocked] = useState(() => isUnlocked());
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setUnlocked(isUnlocked());
  }, []);

  if (unlocked && pinSet) return <>{children}</>;

  const submitUnlock = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const ok = await verifyPin(pin);
    if (ok) {
      markUnlocked();
      logAdminAction('admin_unlock');
      setUnlocked(true);
    } else {
      setError('كلمة المرور غير صحيحة');
      setPin('');
    }
  };

  const submitSetup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (pin.length < 4) { setError('أدخل 4 أرقام على الأقل'); return; }
    if (pin !== confirm) { setError('كلمتا المرور غير متطابقتين'); return; }
    setCreating(true);
    await setupPin(pin);
    logAdminAction('admin_pin_setup');
    setPinSet(true);
    setCreating(false);
    setConfirm('');
    setPin('');
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col items-center mb-5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${pinSet ? 'bg-orange/10 text-orange' : 'bg-orange/10 text-orange'}`}>
            {pinSet ? <Lock className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <h2 className="text-lg font-bold text-gray-900">{pinSet ? 'لوحة تحكم محمية' : 'إنشاء كلمة مرور للأدمن'}</h2>
          <p className="text-gray-500 text-xs mt-1 text-center">
            {pinSet ? 'أدخل كلمة المرور للفتح' : 'أدخل كلمة مرور رقمية تُخزّن مشفّرة على هذا الجهاز فقط'}
          </p>
        </div>

        {pinSet && (
          <form onSubmit={submitUnlock} className="space-y-3">
            <input
              type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)}
              placeholder="كلمة المرور" autoFocus
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-center text-lg tracking-widest font-bold outline-none focus:border-orange"
            />
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            <button type="submit"
              className="w-full h-11 rounded-xl bg-orange hover:bg-orange-dark text-white font-bold flex items-center justify-center gap-2 transition-colors">
              <KeyRound className="w-4 h-4" /> فتح اللوحة
            </button>
            <button type="button" onClick={() => { logAdminAction('admin_lock'); setUnlocked(false); lockNow(); }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors">
              قفل الجهاز الآن
            </button>
          </form>
        )}

        {!pinSet && (
          <form onSubmit={submitSetup} className="space-y-3">
            <input
              type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)}
              placeholder="كلمة المرور الجديدة (4 أرقام أو أكثر)" autoFocus
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-center text-lg tracking-widest font-bold outline-none focus:border-orange"
            />
            <input
              type="password" inputMode="numeric" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="تأكيد كلمة المرور"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-center text-lg tracking-widest font-bold outline-none focus:border-orange"
            />
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            <button type="submit" disabled={creating}
              className="w-full h-11 rounded-xl bg-orange hover:bg-orange-dark text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
              <ShieldCheck className="w-4 h-4" /> {creating ? 'جاري التفعيل...' : 'تفعيل الحماية'}
            </button>
            <button type="button" onClick={() => { logAdminAction('admin_lock'); setUnlocked(false); lockNow(); }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors">
              قفل الجهاز الآن
            </button>
          </form>
        )}
      </div>
    </div>
  );
}