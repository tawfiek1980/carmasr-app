import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, X, Clock, LayoutGrid } from 'lucide-react';
import { getRecentSearches, addRecentSearch, clearRecentSearches } from '../lib/utils';

interface SearchBarProps {
  variant?: 'hero' | 'header' | 'mobile';
  onClose?: () => void;
}

const categoryOptions = [
  { id: '', name: 'كل الأقسام' },
  { id: 'trucks', name: 'شاحنات' },
  { id: 'equipment', name: 'معدات ثقيلة' },
  { id: 'trailers', name: 'مقطورات' },
  { id: 'buses', name: 'حافلات' },
  { id: 'spare-parts', name: 'قطع غيار' },
];

export default function SearchBar({ variant = 'hero', onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [showRecent, setShowRecent] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (recentRef.current && !recentRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowRecent(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() && !location.trim() && !category) return;

    if (query.trim()) addRecentSearch(query.trim());

    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    if (location.trim()) params.set('governorate', location.trim());
    if (category) params.set('category', category);

    navigate(`/search?${params.toString()}`);
    setShowRecent(false);
    if (onClose) onClose();
  };

  const recentSearches = getRecentSearches();

  const inputClasses = variant === 'hero'
    ? "w-full h-12 sm:h-14 pr-12 pl-4 bg-bg rounded-xl border border-transparent focus:border-orange focus:bg-white focus:outline-none transition-colors"
    : "w-full h-10 sm:h-11 pr-10 pl-9 rounded-xl bg-white/95 border border-white/25 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/40 text-sm font-medium transition-colors";

  return (
    <form onSubmit={handleSearch} className={`relative ${variant === 'hero' ? 'w-full max-w-3xl mx-auto' : 'w-full'}`}>
      {variant === 'hero' ? (
        <div className="bg-white rounded-2xl shadow-xl p-2 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-light" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowRecent(true)}
              placeholder="ابحث عن شاحنات، معدات ثقيلة، حمولات..."
              className="w-full h-12 sm:h-14 pr-12 pl-4 bg-bg rounded-xl border border-transparent focus:border-orange focus:bg-white focus:outline-none transition-colors"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative sm:w-40">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-12 sm:h-14 pr-12 pl-4 bg-bg rounded-xl border border-transparent focus:border-orange focus:bg-white focus:outline-none transition-colors text-sm cursor-pointer appearance-none"
            >
              {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-light">
              <LayoutGrid className="w-5 h-5" />
            </span>
          </div>
          <div className="relative sm:w-44">
            <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-light" />
            <input
              type="text" value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="الموقع"
              className="w-full h-12 sm:h-14 pr-12 pl-4 bg-bg rounded-xl border border-transparent focus:border-orange focus:bg-white focus:outline-none transition-colors"
            />
          </div>
          <button type="submit"
            className="h-12 sm:h-14 px-8 bg-orange hover:bg-orange-dark text-white font-bold rounded-xl transition-colors btn-press flex items-center justify-center gap-2">
            <Search className="w-5 h-5" />
            <span>بحث</span>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text" inputMode="search" enterKeyHint="search"
            autoComplete="off" autoCorrect="off" spellCheck={false}
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowRecent(true)}
            placeholder={variant === 'mobile' ? "ابحث في كار مصر..." : "ابحث عن شاحنات، معدات، حمولات..."}
            className={variant === 'mobile'
              ? "w-full h-12 pr-11 pl-10 rounded-xl bg-white/95 border border-white/25 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/40 text-sm font-medium transition-colors"
              : inputClasses}
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <Search className={variant === 'mobile' ? "w-5 h-5" : "w-4 h-4"} />
          </span>
          {query ? (
            <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="مسح"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button type="submit" aria-label="بحث"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-orange text-white hover:bg-orange-dark transition-colors">
              <Search className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Recent Searches Dropdown */}
      {showRecent && recentSearches.length > 0 && (
        <div ref={recentRef}
          className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-xl shadow-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-xs text-text-light font-semibold">آخر عمليات البحث</span>
            <button type="button" onClick={() => { clearRecentSearches(); setShowRecent(false); }}
              className="text-[10px] text-orange hover:underline">مسح الكل</button>
          </div>
          {recentSearches.map((term) => (
            <button type="button" key={term}
              onClick={() => { setQuery(term); setShowRecent(false); navigate(`/search?search=${encodeURIComponent(term)}`); if (onClose) onClose(); }}
              className="w-full text-right px-4 py-2.5 flex items-center gap-2 hover:bg-bg text-sm text-text transition-colors">
              <Clock className="w-3.5 h-3.5 text-text-light flex-shrink-0" />
              <span className="truncate">{term}</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
