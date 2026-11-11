import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, MapPin, BadgeCheck, Package, ArrowLeft } from 'lucide-react';
import { Skeleton } from '../../components/Skeleton';
import { getUserFromDB } from '../../lib/userService';
import { listingsService } from '../../lib/firestoreService';
import type { User as UserType, Listing } from '../../types';
import ListingCard from '../../components/ListingCard';

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserType | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [userData, userListings] = await Promise.all([
          getUserFromDB(id),
          listingsService.getByUser(id),
        ]);
        if (cancelled) return;
        if (userData) setProfile(userData);
        setListings(userListings);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-text-light">
        <User className="w-16 h-16" />
        <p className="text-lg font-bold">المستخدم غير موجود</p>
        <Link to="/" className="text-orange hover:underline text-sm">العودة للرئيسية</Link>
      </div>
    );
  }

  const userTypeLabels: Record<string, string> = {
    individual: 'فرد',
    company: 'شركة',
    dealer: 'تاجر',
    workshop: 'ورشة',
    finance: 'تمويل',
    admin: 'إدارة',
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-gradient-to-b from-navy to-[#0D1B2A] text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 rtl-flip" />
            العودة
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-white/60" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold truncate">{profile.name}</h1>
                {profile.verified && <BadgeCheck className="w-5 h-5 text-orange flex-shrink-0" />}
              </div>
              <p className="text-white/60 text-sm">{userTypeLabels[profile.type] || profile.type}</p>
              <div className="flex items-center gap-1 text-white/50 text-xs mt-1">
                <MapPin className="w-3 h-3" />
                <span>{profile.governorate}{profile.city ? ` - ${profile.city}` : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-orange" />
          <h2 className="text-lg font-bold">الإعلانات</h2>
          <span className="text-sm text-text-light">({listings.length})</span>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-16 text-text-light">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>لا توجد إعلانات بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings
              .filter(l => l.status === 'active' || l.status === 'sold')
              .map((listing) => (
                <ListingCard key={listing.id} listing={listing} featured={listing.featured} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
