import type { ExhibitionProduct, Listing } from '../types';

/** يحوّل منتج معرض لشكل إعلان عادي عشان يتعرض بنفس كارت الإعلانات (ListingCard) بالظبط */
export function productToListing(p: ExhibitionProduct): Listing {
  const images = p.images?.length ? p.images : (p.image ? [p.image] : []);
  const price = Number(String(p.price ?? '').replace(/[^\d]/g, '')) || 0;
  const yearNum = Number(String(p.year ?? '').replace(/[^\d]/g, '')) || undefined;
  return {
    id: p.id,
    title: p.name,
    slug: undefined,
    description: p.description || '',
    price,
    category: p.category || 'exhibition',
    subcategory: p.subcategory || '',
    location: p.governorate || '',
    governorate: p.governorate || '',
    images,
    userId: p.userId || '',
    userName: p.exhibitionName || '',
    userPhone: p.exhibitionPhone || '',
    contactPhone: p.exhibitionPhone || '',
    whatsappPhone: p.exhibitionPhone || '',
    advertiserName: p.exhibitionName,
    userType: 'dealer',
    verified: false,
    status: p.status === 'sold' ? 'sold' : 'active',
    featured: false,
    year: yearNum,
    brand: p.brand,
    model: p.model,
    condition: p.condition || 'used',
    listingType: 'sell',
    priceType: p.priceType || 'fixed',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
  };
}
