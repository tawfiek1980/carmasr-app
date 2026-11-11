import { Clock, Bell } from 'lucide-react';
import { useState } from 'react';
export default function ComingSoon() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-navy">
      <div className="text-center max-w-lg">
        <img src="/tareeq-logo.png" alt="كار مصر" className="h-16 w-16 mx-auto mb-6 object-contain" />
        <div className="inline-flex items-center gap-2 bg-orange/20 text-orange px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
          <Clock className="w-4 h-4" /> قريباً
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">ميزة جديدة قادمة</h1>
        <p className="text-gray-400 mb-8">نعمل على تطوير ميزة مثيرة ستُحوّل تجربتك على كار مصر. كن من أول من يعرف!</p>
        {done ? (
          <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-success">
            <Bell className="w-6 h-6 mx-auto mb-2" />
            شكراً! سنُخطرك عند الإطلاق.
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); setDone(true); }} className="flex gap-2 max-w-sm mx-auto">
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="بريدك الإلكتروني" className="flex-1 bg-white/10 text-white placeholder-gray-500 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange" />
            <button type="submit" className="bg-orange hover:bg-orange-dark text-white px-5 py-3 rounded-xl font-bold transition-colors text-sm">أخبرني</button>
          </form>
        )}
      </div>
    </div>
  );
}
