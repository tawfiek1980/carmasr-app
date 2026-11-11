import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowLeft, ShoppingBag } from 'lucide-react';
import ListingCard from '../components/ListingCard';
import { listingsService } from '../lib/firestoreService';
import type { Listing } from '../types';

export default function Favorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const favs = JSON.parse(localStorage.getItem('tareeq_favorites') || '[]');
    setFavorites(favs);

    const fetchFavorites = async () => {
      if (favs.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const allListings = await listingsService.getAll();
        setListings(allListings.filter((l) => favs.includes(l.id) && ['active', 'sold'].includes(l.status)));
      } catch (error) {
        console.error('Error fetching favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-6 h-6 text-orange" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">المفضلات</h1>
          </div>
          <p className="text-gray-300 text-sm sm:text-base">الإعلانات التي قمت بحفظها لمشاهدتها في وقت لاحق</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Heart className="w-16 h-16 text-text-light mx-auto mb-4" />
            <h3 className="text-lg font-bold text-text mb-2">لا توجد مفضلات</h3>
            <p className="text-text-light text-sm mb-4">ابدأ بالتصفح واضغط على أيقونة القلب لحفظ الإعلانات</p>
            <Link
              to="/vehicles"
              className="inline-flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              تصفح السوق
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
