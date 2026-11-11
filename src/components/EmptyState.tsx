import { Link } from 'react-router-dom';
import TruckAnimation from './TruckAnimation';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  title = 'مفيش عربية بالمواصفات دي',
  description = 'جرب توسع البحث أو شيل بعض الفلاتر',
  actionLabel,
  actionTo,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-14 px-4 ${className}`}>
      <TruckAnimation variant="sleep" tone="onLight" className="w-[280px] max-w-full h-auto" loop />
      <h3 className="mt-5 text-base sm:text-lg font-extrabold text-text">{title}</h3>
      <p className="mt-2 text-sm text-text-light max-w-sm leading-relaxed">{description}</p>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-6 inline-flex items-center gap-2 bg-orange hover:bg-orange-dark text-white text-sm font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange/25 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionTo && onAction && (
        <button
          onClick={onAction}
          className="mt-6 inline-flex items-center gap-2 bg-orange hover:bg-orange-dark text-white text-sm font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange/25 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
