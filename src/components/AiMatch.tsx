import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import { getApiUrl } from '../lib/config';
import { formatPrice, listingUrl } from '../lib/utils';

interface MatchItem {
  id: string;
  score: number;
  reasons?: string[];
  item?: any;
}

interface AiMatchProps {
  target: 'load' | 'truck';
  id: string;
  title: string;
  accent?: string;
}

export default function AiMatch({ target, id, title, accent = 'orange' }: AiMatchProps) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${getApiUrl()}/ai/index`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'match', target, id }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setError(data.message || 'تعذر جلب النتائج');
          return;
        }
        setMatches((data.matches || []).filter((m: MatchItem) => m?.item));
      } catch {
        if (!cancelled) setError('تعذر الاتصال بالخدمة');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [target, id]);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm ${accent === 'orange' ? 'text-orange' : 'text-blue-600'} py-2`}>
        <Loader2 className="w-4 h-4 animate-spin" /> جاري البحث عن الأنسب...
      </div>
    );
  }

  if (error) return null;

  if (matches.length === 0) return null;

  const colorBar = accent === 'orange'
    ? 'bg-gradient-to-l from-orange to-orange-300'
    : 'bg-gradient-to-l from-blue-500 to-blue-300';

  return (
    <div className="bg-gradient-to-l from-orange/5 to-transparent rounded-xl border border-orange/15 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
        <Sparkles className="w-3.5 h-3.5 text-orange" />
        {title}
        <span className="text-[10px] text-gray-400 font-normal">(ذكاء اصطناعي)</span>
      </div>
      <div className="space-y-1.5">
        {matches.map(m => {
          const it = m.item;
          const label = target === 'load'
            ? (it.title || `${it.brand || ''} ${it.model || ''}`.trim() || 'شاحنة')
            : `${it.origin} ← ${it.destination}`;
          const sub = target === 'load'
            ? `${it.governorate || ''}${it.price ? ` · ${formatPrice(it.price)}` : ''}`
            : `${it.vehicleType || it.cargoType || ''}${it.weight ? ` · ${it.weight} طن` : ''}${it.price ? ` · ${formatPrice(it.price)}` : ''}`;
          const href = target === 'load' ? listingUrl(m.id, m.item?.slug) : '/loads';
          return (
            <Link key={m.id} to={href}
              className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{label}</p>
                <p className="text-[11px] text-gray-500 truncate">{sub}</p>
                {m.reasons && m.reasons.length > 0 && (
                  <p className="text-[10px] text-orange-600 truncate">{m.reasons.join(' · ')}</p>
                )}
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${colorBar}`} style={{ width: `${Math.max(5, m.score)}%` }} />
                </div>
                <span className="text-[10px] text-gray-500 font-bold">{m.score}%</span>
              </div>
              <ArrowLeft className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
