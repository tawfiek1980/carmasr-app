import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';

interface BreadcrumbItem { name: string; path?: string; }

interface PageLayoutProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
  icon?: ReactNode;
  lastUpdated?: string;
}

// Matches EXACTLY the same outer shell used by Vehicles, Jobs, Loads etc.
// min-h-screen bg-bg pb-20 sm:pb-8
export default function PageLayout({
  title, description, breadcrumbs = [], children, icon, lastUpdated,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      {/* Navy hero band */}
      <div className="bg-navy py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-5 flex-wrap">
            <Link to="/" className="flex items-center gap-1 hover:text-orange transition-colors">
              <Home className="w-3.5 h-3.5" />
              <span>الرئيسية</span>
            </Link>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2">
                <ChevronLeft className="w-3.5 h-3.5 rtl-flip" />
                {crumb.path
                  ? <Link to={crumb.path} className="hover:text-orange transition-colors">{crumb.name}</Link>
                  : <span className="text-gray-300">{crumb.name}</span>}
              </span>
            ))}
          </nav>

          <div className="flex items-start gap-4">
            {icon && (
              <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center text-orange flex-shrink-0 mt-1">
                {icon}
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{title}</h1>
              {description && (
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-2xl">{description}</p>
              )}
              {lastUpdated && (
                <p className="text-gray-500 text-xs mt-2">آخر تحديث: {lastUpdated}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </div>
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6 mb-5 shadow-sm">
      <h2 className="text-base font-bold text-text mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-orange rounded-full inline-block flex-shrink-0" />
        {title}
      </h2>
      <div className="text-text-light text-sm leading-7 space-y-3">
        {children}
      </div>
    </div>
  );
}
