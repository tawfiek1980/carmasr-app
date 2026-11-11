import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MarketStat } from '../types';

interface MarketStatProps {
  stat: MarketStat;
}

export default function MarketStat({ stat }: MarketStatProps) {
  const getTrendIcon = () => {
    switch (stat.trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-text-light" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-border hover:shadow-md transition-shadow">
      <p className="text-xs text-text-light mb-1 line-clamp-1">{stat.label}</p>
      <p className="text-lg sm:text-xl font-extrabold text-navy mb-2">{stat.value}</p>
      {stat.change && (
        <div className="flex items-center gap-1">
          {getTrendIcon()}
          <span className={`text-xs font-bold ${stat.trend === 'up' ? 'text-green-500' : stat.trend === 'down' ? 'text-red-500' : 'text-text-light'}`}>
            {stat.change}
          </span>
          <span className="text-[10px] text-text-light">مقارنة بالشهر الماضي</span>
        </div>
      )}
    </div>
  );
}
