import { useEffect, useState, createElement } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Grid3X3, List, SlidersHorizontal } from 'lucide-react';
import ListingCard from '../components/ListingCard';
import SearchBar from '../components/SearchBar';
import SeoHead from '../components/SeoHead';
import { listingsService, sortByDate } from '../lib/firestoreService';
import { equipmentCategories, governorates } from '../lib/data';
import { getIcon } from '../lib/dynamicIcons';
import type { Listing } from '../types';

export default function Equipment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const subcategory = searchParams.get('subcategory') || '';
  const governorate = searchParams.get('governorate') || '';
  const search = searchParams.get('search') || '';

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      try {
        const data = await listingsService.getAll({ category: 'equipment' });
        let filtered = data.filter(l => ['active', 'sold'].includes(l.status));
        if (subcategory) filtered = filtered.filter(l => l.subcategory === subcategory);
        if (governorate) filtered = filtered.filter(l => l.governorate === governorate);
        if (search) filtered = filtered.filter(l =>
          l.title?.toLowerCase().includes(search.toLowerCase()) ||
          l.brand?.toLowerCase().includes(search.toLowerCase())
        );
        filtered = sortByDate(filtered);
        setListings(filtered);
      } catch (error) {
        console.error('Error fetching equipment:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [subcategory, governorate, search]);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const subName = equipmentCategories.find(c => c.id === subcategory)?.name || 'معدات ثقيلة';
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead
        title={`${subName} للبيع في مصر`}
        description={`${subName} مستعملة وجديدة للبيع في مصر. ابحث عن لوادر، حفارات، بلدوزرات، أوناش، ورافعات شوكية بأفضل الأسعار.`}
      />
      <div className="bg-navy py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">سوق المعدات الثقيلة</h1>
          <SearchBar variant="header" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-4 mb-4">
          <button
            onClick={() => updateFilter('subcategory', '')}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              !subcategory ? 'bg-orange text-white' : 'bg-white text-text hover:bg-orange/10'
            }`}
          >
            الكل
          </button>
          {equipmentCategories.map((cat) => {
            const SubIcon = getIcon(cat.icon);
            return (
              <button
                key={cat.id}
                onClick={() => updateFilter('subcategory', cat.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 ${
                  subcategory === cat.id ? 'bg-orange text-white' : 'bg-white text-text hover:bg-orange/10'
                }`}
              >
                {SubIcon && createElement(SubIcon, { className: 'w-4 h-4' })}
                {cat.name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-xl text-sm font-bold text-text hover:shadow-sm transition-shadow"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>الفلاتر</span>
            </button>
            <span className="text-sm text-text-light">{listings.length} نتيجة</span>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-orange text-white' : 'text-text-light hover:text-text'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-orange text-white' : 'text-text-light hover:text-text'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-white rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-light mb-1.5">المحافظة</label>
              <select
                value={governorate}
                onChange={(e) => updateFilter('governorate', e.target.value)}
                className="w-full h-10 px-3 bg-bg rounded-lg border border-border focus:border-orange focus:outline-none text-sm"
              >
                <option value="">جميع المحافظات</option>
                {governorates.map((g) => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-light mb-1.5">البحث</label>
              <input
                type="text"
                value={search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="ابحث عن معدة..."
                className="w-full h-10 px-3 bg-bg rounded-lg border border-border focus:border-orange focus:outline-none text-sm"
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Filter className="w-16 h-16 text-text-light mx-auto mb-4" />
            <h3 className="text-lg font-bold text-text mb-2">لا توجد معدات</h3>
            <p className="text-text-light text-sm">جرّب تغيير الفلاتر أو البحث بكلمات مختلفة</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
