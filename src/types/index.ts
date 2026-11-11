// index.ts
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp?: string;
  type:
    | "individual"
    | "company"
    | "dealer"
    | "workshop"
    | "finance"
    | "admin";
  avatar?: string;
  governorate: string;
  city?: string;
  currentLocation?: string;
  drivingType?: string;
  experienceYears?: number;
  businessName?: string;
  specialization?: string;
  verified: boolean;
  createdAt: string;
  updatedAt?: string;
  signupSource?: string;
  signupMedium?: string;
  signupCampaign?: string;
  signupReferrer?: string;
}

export interface Listing {
  id: string;
  title: string;
  slug?: string;
  description: string;
  price: number;
  category: string;
  subcategory: string;
  location: string;
  governorate: string;
  images: string[];
  videoUrl?: string;
  userId: string;
  userName: string;
  userPhone: string;
  contactPhone?: string;
  whatsappPhone?: string;
  facebook?: string;
  advertiserName?: string;
  userType: string;
  verified: boolean;
  status: "active" | "pending" | "rejected" | "sold" | "reserved" | "paused" | "expired";
  featured: boolean;
  featuredUntil?: string;
  soldThroughTareeq?: boolean;
  year?: number;
  brand?: string;
  model?: string;
  condition?: "new" | "used";
  listingType?: "sell" | "rent";
  priceType?: "fixed" | "negotiable" | "call" | "sold";
  dailyPrice?: number;
  weeklyPrice?: number;
  monthlyPrice?: number;
  deposit?: number;
  availableFrom?: string;
  availableTo?: string;
  insuranceRequired?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Load {
  id: string;
  origin: string;
  destination: string;
  cargoType: string;
  vehicleType: string;
  weight: string;
  price: number;
  priceType?: "fixed" | "negotiable" | "call" | "sold";
  distance?: string;
  date: string;
  loadType: 'single' | 'period';
  periodDays?: number;
  isReturnLoad: boolean;
  returnOrigin?: string;
  returnDestination?: string;
  international?: boolean;
  originCountry?: string;
  destinationCountry?: string;
  userId: string;
  userName: string;
  userPhone: string;
  contactPhone?: string;
  whatsappPhone?: string;
  secondaryPhone?: string;
  description?: string;
  paymentTerms?: string;
  loadingInstructions?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  loadingTime?: string;
  status: "available" | "in_transit" | "delivered" | "sold" | "reserved" | "paused" | "expired";
  createdAt: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  jobPostType: 'hire' | 'available';
  type:
    | "driver"
    | "mechanic"
    | "technician"
    | "logistics"
    | "warehouse"
    | "sales"
    | "heavy-equip"
    | "electrician"
    | "welder"
    | "craftsman"
    | "tinsmith"
    | "carpenter"
    | "other";
  location: string;
  governorate: string;
  salary?: string;
  description?: string;
  requirements: string[];
  experience: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  contactPhone?: string;
  whatsappPhone?: string;
  secondaryPhone?: string;
  status: "pending" | "active" | "rejected" | "filled" | "closed";
  featured: boolean;
  createdAt: string;
}

export interface FinanceRequest {
  id: string;
  name: string;
  phone: string;
  governorate: string;
  vehicleType: string;
  vehiclePrice: number;
  downPayment: number;
  monthlyIncome?: number;
  status: "new" | "reviewing" | "approved" | "rejected";
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  count: number;
  color: string;
  image?: string;
}

export interface Governorate {
  id: string;
  name: string;
  nameEn: string;
  listingsCount: number;
  loadsCount: number;
}

export interface MarketStat {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "stable";
}

export interface EmergencyService {
  id: string;
  name: string;
  icon: string;
  description: string;
  responseTime: string;
  phone: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantsData: Record<string, { name: string; avatar?: string }>;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  listingId?: string;
  listingTitle?: string;
  unreadCount: Record<string, number>;
  createdAt: string;
}

export interface SocialLink {
  id: string;
  platform: string;
  name: string;
  url: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface ContactNumber {
  id: string;
  title: string;
  phone: string;
  department?: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface SiteSettings {
  [key: string]: string;
}

export interface TareeqNotification {
  id: string;
  userId: string;
  type: "listing_review" | "listing_approved" | "listing_rejected" | "new_listing_admin" |
    "message" | "system" | "contact" | "exhibition_product";
  title: string;
  body: string;
  read: boolean;
  listingId?: string;
  url?: string;
  createdAt: string;
}

export interface PasswordResetRequest {
  id: string;
  phone: string;
  email: string;
  userName?: string;
  status: "pending" | "completed" | "cancelled";
  createdAt: string;
  completedAt?: string;
  completedBy?: string;
}

export type ExhibitionPlanId = "free" | "basic" | "premium" | "vip";

export interface Exhibition {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  governorate: string;
  city?: string;
  contactPhone: string;
  whatsapp?: string;
  plan: ExhibitionPlanId;
  category?: 'general' | 'import';
  userId: string;
  status: "active" | "inactive";
  createdAt: string;
  productCount?: number;
  views?: number;
  contacts?: number;
  expiresAt?: string;
  facebook?: string;
  instagram?: string;
  website?: string;
  workingHours?: string;
  googleMapsUrl?: string;
  products?: ExhibitionProduct[];
}

export interface ExhibitionProduct {
  id: string;
  name: string;
  description?: string;
  price?: string;
  brand?: string;
  model?: string;
  year?: string | number;
  subcategory?: string;
  condition?: 'new' | 'used';
  priceType?: 'fixed' | 'negotiable' | 'call';
  images?: string[];
  image?: string;
  category?: string;
  exhibitionId?: string;
  exhibitionName?: string;
  exhibitionPhone?: string;
  governorate?: string;
  userId?: string;
  status?: 'active' | 'sold';
  createdAt?: any;
}

export interface BannerAd {
  id: string;
  companyName: string;
  position: 'home_top' | 'home_middle' | 'category_top';
  imageUrl?: string;
  linkUrl?: string;
  price: number;
  userId: string;
  status: 'active' | 'inactive';
  clicks?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: 'featured_listing' | 'exhibition' | 'banner_ad';
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  paymentMethod: 'manual';
  listingId?: string;
  listingTitle?: string;
  proofImage?: string;
  adminNote?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  paidAt?: string;
  updatedAt?: string;
}

export interface FinanceCompany {
  id: string;
  name: string;
  description: string;
  logo?: string;
  rate: string;
  maxPeriod: string;
  phone: string;
  whatsapp: string;
  stars: number;
  isFree?: boolean;
  userId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Rating {
  id: string;
  listingId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// ═══ حاسبة الوردية (وردية نقل ثقيل) ═══
export interface ShiftTrip {
  id: string;
  client: string;
  cargo: string;
  quarry: string;
  from: string;
  to: string;
  fare: number;
}

export interface ShiftExpenses {
  diesel: number;
  salaries: number;
  custody: number;
  other: number;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  /** تاريخ الوردية بصيغة YYYY-MM-DD */
  date: string;
  truck: string;
  driver: string;
  assistant: string;
  trips: ShiftTrip[];
  expenses: ShiftExpenses;
  /** رسوم كل محجر — المفتاح اسم المحجر */
  quarryFees: Record<string, number>;
  revenue: number;
  totalExpenses: number;
  net: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

