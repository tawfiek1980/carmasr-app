import { Link } from 'react-router-dom';
import CategorySvgIcon from './CategorySvgIcon';
import type { Category } from '../types';

interface CategoryCardProps {
  category: Category;
  to?: string;
}

export default function CategoryCard({ category, to }: CategoryCardProps) {

  const categoryRoutes: Record<string, string> = {
    trucks: '/vehicles',
    trailers: '/vehicles?category=trailers',
    buses: '/vehicles?category=buses',
    equipment: '/equipment',
    'spare-parts': '/spare-parts',
    loads: '/loads',
    jobs: '/jobs',
    finance: '/finance',
    emergency: '/emergency',
  };
  return (
    <Link
      to={to || categoryRoutes[category.id] || `/${category.id}`}
      className="group flex flex-col items-center gap-2 p-3 sm:p-4 bg-white rounded-2xl shadow-sm border border-border hover:border-orange/30 hover:shadow-md transition-all card-hover"
    >
      <div
        className="rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 overflow-hidden"
        style={{
          width: 'clamp(56px, 7vw, 88px)',
          height: 'clamp(56px, 7vw, 88px)',
          backgroundColor: `${category.color}15`,
        }}
      >
        {category.image ? (
          <img
            src={category.image}
            alt={category.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <CategorySvgIcon categoryId={category.id} className="w-8 h-8 sm:w-9 sm:h-9" color={category.color} />
        )}
      </div>
      <span className="text-xs sm:text-sm font-bold text-text text-center leading-tight line-clamp-2">
        {category.name}
      </span>
      <span className="text-[10px] sm:text-xs text-text-light">{category.count.toLocaleString('ar-EG')} إعلان</span>
    </Link>
  );
}
