/**
 * firestoreService.ts - بدون composite indexes
 */
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, increment, serverTimestamp, Timestamp,
  documentId,
  type QueryConstraint,
  type DocumentData,
} from "firebase/firestore";
import { db, firebaseAuth } from "../firebase";
import { getApiUrl } from "./config";
import { sampleListings, sampleLoads, sampleJobs } from "./data";
import { isDemoMode } from "./demoMode";
import type { Listing, Load, Job, FinanceRequest, User, TareeqNotification, Exhibition, ExhibitionProduct, Rating, Shift } from "../types";

const SAMPLE_LISTINGS_STORAGE_KEY = "tareeq_sample_listing_edits";

function cleanId<T>(snap: any): T {
  return { id: snap.id, ...snap.data() } as T;
}
function toDate(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  return typeof ts === "string" ? ts : new Date().toISOString();
}

// ── sort client-side بدل orderBy في Firestore ──
export function sortByDate<T extends { createdAt?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

// المميز أولاً ثم الأحدث — عشان باقة "مميز" ترفع الإعلان لأول النتائج فعلًا
export function sortListingsByNewest<T extends { createdAt?: string; featured?: boolean }>(arr: T[]): T[] {
  return [...arr].sort((a, b) =>
    ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)) ||
    (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  );
}


function getSampleListingOverrides(): Record<string, Partial<Listing>> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SAMPLE_LISTINGS_STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveSampleListingOverride(id: string, data: Partial<Listing>) {
  if (typeof window === "undefined") return;
  const overrides = getSampleListingOverrides();
  overrides[id] = { ...(overrides[id] || {}), ...data, id, updatedAt: new Date().toISOString() } as any;
  localStorage.setItem(SAMPLE_LISTINGS_STORAGE_KEY, JSON.stringify(overrides));
}

function getSampleListings(): Listing[] {
  const overrides = getSampleListingOverrides();
  return sampleListings.map(listing => ({ ...listing, ...(overrides[listing.id] || {}), id: listing.id }));
}

function filterSampleListings(filters?: { category?: string; governorate?: string; status?: string }): Listing[] {
  let results = getSampleListings();
  if (filters?.status)      results = results.filter(l => l.status === filters.status);
  if (filters?.category)    results = results.filter(l => l.category === filters.category);
  if (filters?.governorate) results = results.filter(l => l.governorate === filters.governorate);
  return sortByDate(results);
}

function filterSampleLoads(filters?: { status?: string }): Load[] {
  let results = sampleLoads;
  if (filters?.status) results = results.filter(l => l.status === filters.status);
  return sortByDate(results);
}

function filterSampleJobs(filters?: { status?: string }): Job[] {
  let results = sampleJobs;
  if (filters?.status) results = results.filter(j => j.status === filters.status);
  return sortByDate(results);
}

// ══════════════════════════════════════════════════════
//  LISTINGS
// ══════════════════════════════════════════════════════
export const listingsService = {
  async create(data: any): Promise<Listing> {
    const ref = await addDoc(collection(db, "listings"), {
      ...data,
      status: "pending",
      featured: false,
      createdAt: serverTimestamp(),
    });
    return { ...data, id: ref.id, status: "pending", createdAt: new Date().toISOString() };
  },

  async getAll(filters?: { category?: string; governorate?: string; status?: string }): Promise<Listing[]> {
    // وضع العرض النضيف (للتصوير): بيانات تجريبية مرتبة بدل إنتاج
    if (isDemoMode()) return filterSampleListings(filters);
    try {
      const constraints: QueryConstraint[] = [];
      if (filters?.status)      constraints.push(where("status", "==", filters.status));
      if (filters?.category)    constraints.push(where("category", "==", filters.category));
      if (filters?.governorate) constraints.push(where("governorate", "==", filters.governorate));

      const q     = query(collection(db, "listings"), ...constraints, limit(500));
      const snaps = await getDocs(q);
      const results = snaps.docs.map(s => ({ ...cleanId<Listing>(s), createdAt: toDate(s.data().createdAt) }));

      // البيانات الحقيقية بس — الإعلانات التجريبية بتظهر بس لو Firestore واقع
      return sortByDate(results);
    } catch (error) {
      console.warn("Using sample listings because Firestore is unavailable:", error);
      return filterSampleListings(filters);
    }
  },

  async getById(id: string): Promise<Listing | null> {
    if (isDemoMode()) return getSampleListings().find(l => l.id === id) || null;
    try {
      const snap = await getDoc(doc(db, "listings", id));
      if (snap.exists()) return { ...cleanId<Listing>(snap), createdAt: toDate(snap.data().createdAt) };
    } catch (error) {
      console.warn("Using sample listing detail because Firestore is unavailable:", error);
    }
    return getSampleListings().find(l => l.id === id) || null;
  },

  async getBySlug(slug: string): Promise<Listing | null> {
    if (isDemoMode()) return getSampleListings().find(l => l.slug === slug) || null;
    try {
      const q = query(collection(db, "listings"), where("slug", "==", slug), limit(1));
      const snaps = await getDocs(q);
      if (!snaps.empty) return { ...cleanId<Listing>(snaps.docs[0]), createdAt: toDate(snaps.docs[0].data().createdAt) };
    } catch {}
    return null;
  },

  /** رابط فريد: نفس العنوان ممكن يتكرر، فبنزوّد رقم للـ slug لو مستخدم قبل كده */
  async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const clean = (base || "listing").replace(/-+$/, "");
    try {
      const q = query(collection(db, "listings"), where("slug", ">=", clean), where("slug", "<=", `${clean}￿`), limit(50));
      const snaps = await getDocs(q);
      const taken = new Set(
        snaps.docs.map(s => s.data().slug as string).filter((s): s is string => !!s && s !== excludeId)
      );
      if (!taken.has(clean)) return clean;
      let n = 2;
      while (taken.has(`${clean}-${n}`)) n += 1;
      return `${clean}-${n}`;
    } catch {
      return `${clean}-${Date.now().toString(36)}`;
    }
  },

  async getByUser(userId: string): Promise<Listing[]> {
    try {
      const q     = query(collection(db, "listings"), where("userId", "==", userId), limit(100));
      const snaps = await getDocs(q);
      return sortByDate(snaps.docs.map(s => ({ ...cleanId<Listing>(s), createdAt: toDate(s.data().createdAt) })));
    } catch {
      return [];
    }
  },

  async getByPhone(phone: string): Promise<Listing[]> {
    if (!phone) return [];
    const norm = (p: string): string => {
      let d = p.replace(/[^\d]/g, '');
      if (d.startsWith('00')) d = d.substring(2);
      if (d.startsWith('20') && d.length === 13) d = d.substring(2);
      return d;
    };
    const targets = [norm(phone)];
    if (targets[0].startsWith('0') === false) targets.push('0' + targets[0]);
    const snapshots: Listing[] = [];
    for (const p of targets) {
      try {
        const q1 = query(collection(db, "listings"), where("userPhone", "==", p), limit(100));
        snapshots.push(...(await getDocs(q1)).docs.map(s => ({ ...cleanId<Listing>(s), createdAt: toDate(s.data().createdAt) })));
      } catch { /* ignore */ }
      try {
        const q2 = query(collection(db, "listings"), where("contactPhone", "==", p), limit(100));
        snapshots.push(...(await getDocs(q2)).docs.map(s => ({ ...cleanId<Listing>(s), createdAt: toDate(s.data().createdAt) })));
      } catch { /* ignore */ }
      try {
        const q3 = query(collection(db, "listings"), where("userPhone", "==", (targets[0].startsWith('0') ? '+' : '') + p), limit(100));
        snapshots.push(...(await getDocs(q3)).docs.map(s => ({ ...cleanId<Listing>(s), createdAt: toDate(s.data().createdAt) })));
      } catch { /* ignore */ }
    }
    const seen = new Set<string>();
    return sortByDate(snapshots.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; }));
  },

  async getFeatured(): Promise<Listing[]> {
    if (isDemoMode()) {
      const featured = getSampleListings().filter(l => l.featured);
      return sortByDate(featured.length ? featured : getSampleListings().slice(0, 8));
    }
    try {
      const q     = query(collection(db, "listings"), where("featured", "==", true), limit(100));
      const snaps = await getDocs(q);
      const now = new Date();
      const results = snaps.docs
        .map(s => ({ ...cleanId<Listing>(s), createdAt: toDate(s.data().createdAt) }))
        .filter(l => !l.featuredUntil || new Date(l.featuredUntil) > now);
      return sortByDate(results);
    } catch (error) {
      console.warn("Using sample featured listings because Firestore is unavailable:", error);
      return sortByDate(getSampleListings().filter(l => l.featured));
    }
  },

  async update(id: string, data: Partial<Listing>): Promise<void> {
    if (id.startsWith("sample-")) {
      saveSampleListingOverride(id, data);
      return;
    }
    await updateDoc(doc(db, "listings", id), { ...data, updatedAt: serverTimestamp() });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, "listings", id));
  },
};

// ══════════════════════════════════════════════════════
//  LOADS
// ══════════════════════════════════════════════════════
export const loadsService = {
  async create(data: any): Promise<Load> {
    const ref = await addDoc(collection(db, "loads"), {
      ...data,
      status: "pending",
      featured: false,
      createdAt: serverTimestamp(),
    });
    return { ...data, id: ref.id, status: "pending", createdAt: new Date().toISOString() };
  },

  async getAll(filters?: { status?: string }): Promise<Load[]> {
    if (isDemoMode()) return filterSampleLoads(filters);
    try {
      // جيب كل السيارات بدون orderBy عشان مفيش index
      const q     = query(collection(db, "loads"), limit(100));
      const snaps = await getDocs(q);
      let results = snaps.docs.map(s => ({ ...cleanId<Load>(s), createdAt: toDate(s.data().createdAt) }));

      if (filters?.status) results = results.filter(l => l.status === filters.status);

      return sortByDate(results);
    } catch (error) {
      console.warn("Using sample loads because Firestore is unavailable:", error);
      return filterSampleLoads(filters);
    }
  },

  async getById(id: string): Promise<Load | null> {
    if (isDemoMode()) return sampleLoads.find(l => l.id === id) || null;
    const snap = await getDoc(doc(db, "loads", id));
    return snap.exists() ? { ...cleanId<Load>(snap), createdAt: toDate(snap.data().createdAt) } : null;
  },

  async getByUser(userId: string): Promise<Load[]> {
    try {
      const q = query(collection(db, "loads"), where("userId", "==", userId), limit(50));
      const snaps = await getDocs(q);
      return sortByDate(snaps.docs.map(s => ({ ...cleanId<Load>(s), createdAt: toDate(s.data().createdAt) })));
    } catch {
      return [];
    }
  },

  async update(id: string, data: Partial<Load>): Promise<void> {
    await updateDoc(doc(db, "loads", id), { ...data, updatedAt: serverTimestamp() });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, "loads", id));
  },
};

// ══════════════════════════════════════════════════════
//  JOBS
// ══════════════════════════════════════════════════════
export const jobsService = {
  async create(data: any): Promise<Job> {
    const ref = await addDoc(collection(db, "jobs"), {
      ...data,
      status: "pending",
      featured: false,
      createdAt: serverTimestamp(),
    });
    return { ...data, id: ref.id, status: "pending", featured: false, createdAt: new Date().toISOString() };
  },

  async getAll(filters?: { status?: string }): Promise<Job[]> {
    if (isDemoMode()) return filterSampleJobs(filters);
    try {
      const q     = query(collection(db, "jobs"), limit(100));
      const snaps = await getDocs(q);
      let results = snaps.docs.map(s => ({ ...cleanId<Job>(s), createdAt: toDate(s.data().createdAt) }));

      if (filters?.status) results = results.filter(j => j.status === filters.status);

      return sortByDate(results);
    } catch (error) {
      console.warn("Using sample jobs because Firestore is unavailable:", error);
      return filterSampleJobs(filters);
    }
  },

  async getByUser(userId: string): Promise<Job[]> {
    try {
      const q = query(collection(db, "jobs"), where("userId", "==", userId), limit(50));
      const snaps = await getDocs(q);
      return sortByDate(snaps.docs.map(s => ({ ...cleanId<Job>(s), createdAt: toDate(s.data().createdAt) })));
    } catch {
      return [];
    }
  },

  async update(id: string, data: Partial<Job>): Promise<void> {
    await updateDoc(doc(db, "jobs", id), { ...data, updatedAt: serverTimestamp() });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, "jobs", id));
  },
};

// ══════════════════════════════════════════════════════
//  FINANCE
// ══════════════════════════════════════════════════════
export const financeService = {
  async create(data: any): Promise<FinanceRequest> {
    const ref = await addDoc(collection(db, "financeRequests"), {
      ...data,
      status: "new",
      createdAt: serverTimestamp(),
    });
    return { ...data, id: ref.id, status: "new", createdAt: new Date().toISOString() };
  },

  async getAll(): Promise<FinanceRequest[]> {
    const snaps = await getDocs(query(collection(db, "financeRequests"), limit(50)));
    return sortByDate(snaps.docs.map(s => ({ ...cleanId<FinanceRequest>(s), createdAt: toDate(s.data().createdAt) })));
  },

  async getByUser(userId: string): Promise<FinanceRequest[]> {
    const q     = query(collection(db, "financeRequests"), where("userId", "==", userId), limit(50));
    const snaps = await getDocs(q);
    return sortByDate(snaps.docs.map(s => ({ ...cleanId<FinanceRequest>(s), createdAt: toDate(s.data().createdAt) })));
  },

  async update(id: string, data: Partial<FinanceRequest>): Promise<void> {
    await updateDoc(doc(db, "financeRequests", id), { ...data, updatedAt: serverTimestamp() });
  },
};

// ══════════════════════════════════════════════════════
//  USERS
// ══════════════════════════════════════════════════════
export const usersService = {
  async getAll(): Promise<User[]> {
    const snaps = await getDocs(query(collection(db, "users"), limit(100)));
    return sortByDate(snaps.docs.map(s => ({ ...cleanId<User>(s) })));
  },

  /** كل المستخدمين مع بيانات حملة التسجيل (للأدمن) — بدون حد */
  async getSignupTracking(): Promise<User[]> {
    const snaps = await getDocs(collection(db, "users"));
    return snaps.docs.map(s => cleanId<User>(s));
  },

  async getById(id: string): Promise<User | null> {
    const snap = await getDoc(doc(db, "users", id));
    return snap.exists() ? cleanId<User>(snap) : null;
  },

  async update(id: string, data: Partial<User>): Promise<void> {
    await updateDoc(doc(db, "users", id), { ...data, updatedAt: serverTimestamp() });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, "users", id));
  },
};

// ══════════════════════════════════════════════════════
//  PASSWORD RESET REQUESTS
// ══════════════════════════════════════════════════════
import type { PasswordResetRequest } from '../types';

export const passwordResetsService = {
  async getAll(): Promise<PasswordResetRequest[]> {
    const snaps = await getDocs(query(collection(db, "passwordResets"), orderBy("createdAt", "desc"), limit(50)));
    return snaps.docs.map(s => ({ ...cleanId<PasswordResetRequest>(s), createdAt: toDate(s.data().createdAt) }));
  },

  async add(data: Omit<PasswordResetRequest, 'id' | 'createdAt'>) {
    await addDoc(collection(db, "passwordResets"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },

  async update(id: string, data: Partial<PasswordResetRequest>) {
    await updateDoc(doc(db, "passwordResets", id), { ...data, updatedAt: serverTimestamp() });
  },
};

// ══════════════════════════════════════════════════════
//  ADMIN STATS
// ══════════════════════════════════════════════════════
export async function getAdminStats() {
  const [users, listings, loads, jobs, finance] = await Promise.all([
    getDocs(query(collection(db, "users"), limit(500))),
    getDocs(query(collection(db, "listings"), limit(500))),
    getDocs(query(collection(db, "loads"), limit(500))),
    getDocs(query(collection(db, "jobs"), limit(500))),
    getDocs(query(collection(db, "financeRequests"), limit(500))),
  ]);

  let activeListings = 0, pendingListings = 0, featuredListings = 0, pendingFinance = 0, rejectedListings = 0, soldListings = 0;
  const govCount: Record<string, number> = {};
  const catCount: Record<string, number> = {};
  const userTypeCount: Record<string, number> = {};
  const jobTypeCount: Record<string, number> = {};
  const listingStatusCount: Record<string, number> = {};

  listings.docs.forEach(d => {
    const s = d.data().status;
    if (s === "active")  activeListings++;
    if (s === "pending") pendingListings++;
    if (s === "rejected") rejectedListings++;
    if (s === "sold") soldListings++;
    if (d.data().featured === true) featuredListings++;
    listingStatusCount[s] = (listingStatusCount[s] || 0) + 1;
    const gov = d.data().governorate;
    if (gov) govCount[gov] = (govCount[gov] || 0) + 1;
    const cat = d.data().category;
    if (cat) catCount[cat] = (catCount[cat] || 0) + 1;
  });

  finance.docs.forEach(d => {
    if (d.data().status === "new") pendingFinance++;
  });

  jobs.docs.forEach(d => {
    const jt = d.data().type;
    if (jt) jobTypeCount[jt] = (jobTypeCount[jt] || 0) + 1;
  });

  users.docs.forEach(d => {
    const ut = d.data().type;
    if (ut) userTypeCount[ut] = (userTypeCount[ut] || 0) + 1;
  });

  const topGovernorates = Object.entries(govCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topCategories = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  let totalViews = 0;
  let viewsCount = 0;
  listings.docs.forEach(d => {
    const v = d.data().views || 0;
    totalViews += v;
    if (v > 0) viewsCount++;
  });

  const conversionRate = listings.size > 0 ? Math.round((soldListings / listings.size) * 100) : 0;
  const avgViewsPerListing = listings.size > 0 ? Math.round(totalViews / listings.size) : 0;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dailyMap: Record<string, number> = {};
  const dailyListingMap: Record<string, number> = {};

  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = 0;
    dailyListingMap[key] = 0;
  }

  users.docs.forEach(d => {
    const cd = d.data().createdAt;
    if (cd) {
      let dateStr = '';
      if (cd?.toDate) dateStr = cd.toDate().toISOString().slice(0, 10);
      else if (typeof cd === 'string') dateStr = cd.slice(0, 10);
      else if (cd?.seconds) dateStr = new Date(cd.seconds * 1000).toISOString().slice(0, 10);
      if (dateStr && dateStr in dailyMap) dailyMap[dateStr]++;
    }
  });

  listings.docs.forEach(d => {
    const cd = d.data().createdAt;
    if (cd) {
      let dateStr = '';
      if (cd?.toDate) dateStr = cd.toDate().toISOString().slice(0, 10);
      else if (typeof cd === 'string') dateStr = cd.slice(0, 10);
      else if (cd?.seconds) dateStr = new Date(cd.seconds * 1000).toISOString().slice(0, 10);
      if (dateStr && dateStr in dailyListingMap) dailyListingMap[dateStr]++;
    }
  });

  const dailySignups = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));
  const dailyListings = Object.entries(dailyListingMap).map(([date, count]) => ({ date, count }));

  return {
    totalUsers:      users.size,
    totalListings:   listings.size,
    activeListings,
    pendingListings,
    rejectedListings,
    soldListings,
    featuredListings,
    totalLoads:      loads.size,
    totalJobs:       jobs.size,
    financeRequests: finance.size,
    pendingFinance,
    topGovernorates,
    topCategories,
    listingStatusCount,
    userTypeCount,
    jobTypeCount,
    conversionRate,
    totalViews,
    avgViewsPerListing,
    dailySignups,
    dailyListings,
  };
}

// ══════════════════════════════════════════════════════
//  RATINGS
// ══════════════════════════════════════════════════════
export const ratingsService = {
  async create(data: Omit<Rating, 'id' | 'createdAt'>): Promise<Rating> {
    const ref = await addDoc(collection(db, 'ratings'), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return { ...data, id: ref.id, createdAt: new Date().toISOString() };
  },

  async getByListing(listingId: string): Promise<Rating[]> {
    try {
      const q = query(collection(db, 'ratings'), where('listingId', '==', listingId), limit(20));
      const snaps = await getDocs(q);
      return sortByDate(snaps.docs.map(s => ({
        ...cleanId<Rating>(s),
        createdAt: toDate(s.data().createdAt),
      })));
    } catch { return []; }
  },

  async getByUser(userId: string): Promise<Rating[]> {
    try {
      const q = query(collection(db, 'ratings'), where('toUserId', '==', userId), limit(50));
      const snaps = await getDocs(q);
      return sortByDate(snaps.docs.map(s => ({
        ...cleanId<Rating>(s),
        createdAt: toDate(s.data().createdAt),
      })));
    } catch { return []; }
  },

  async getAverage(toUserId: string): Promise<number> {
    try {
      const ratings = await ratingsService.getByUser(toUserId);
      if (!ratings.length) return 0;
      return Math.round(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length * 10) / 10;
    } catch { return 0; }
  },

  async hasUserRated(fromUserId: string, listingId: string): Promise<boolean> {
    try {
      const q = query(collection(db, 'ratings'), where('fromUserId', '==', fromUserId));
      const snaps = await getDocs(q);
      return snaps.docs.some(s => s.data().listingId === listingId);
    } catch { return false; }
  },
};

// ══════════════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════════════

export const notificationsService = {
  async notifyWelcome(userId: string, userName: string): Promise<void> {
    await notificationsService.create({
      userId,
      type: "system" as const,
      title: "مرحباً بك في كار مصر! 🚛",
      body: `أهلاً ${userName}! شكراً لانضمامك لأكبر سوق للنقل الثقيل في مصر. ابدأ الآن بتصفح الإعلانات أو نشر إعلانك.`,
      read: false,
    });
  },

  async create(data: Omit<TareeqNotification, "id" | "createdAt">): Promise<TareeqNotification> {
    const ref = await addDoc(collection(db, "notifications"), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return { ...data, id: ref.id, createdAt: new Date().toISOString() };
  },

  async getByUser(userId: string): Promise<TareeqNotification[]> {
    try {
      // نجيب أقصى 50 إشعار
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        limit(50)
      );
      const snaps = await getDocs(q);
      return sortByDate(
        snaps.docs.map((s) => ({
          ...cleanId<TareeqNotification>(s),
          createdAt: toDate(s.data().createdAt),
        }))
      );
    } catch {
      return [];
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("read", "==", false)
      );
      const snaps = await getDocs(q);
      return snaps.size;
    } catch {
      return 0;
    }
  },

  async markAsRead(id: string): Promise<void> {
    await updateDoc(doc(db, "notifications", id), { read: true });
  },

  async markAllAsRead(userId: string): Promise<void> {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false)
    );
    const snaps = await getDocs(q);
    await Promise.all(snaps.docs.map((s) => updateDoc(s.ref, { read: true })));
  },

  // إشعار للأدمن عند إنشاء إعلان جديد
  async notifyAdminNewListing(listing: { id: string; title: string; userName: string }): Promise<void> {
    try {
      const adminSnap = await getDocs(query(collection(db, "users"), where("type", "==", "admin")));
      const adminIds = adminSnap.docs.map((d) => d.id);
      await Promise.all(adminIds.map((uid) =>
        notificationsService.create({
          userId: uid,
          type: "new_listing_admin",
          title: "إعلان جديد",
          body: `قام ${listing.userName} بنشر إعلان "${listing.title}" وهو قيد المراجعة.`,
          read: false,
          listingId: listing.id,
          url: `/listing/${listing.id}`,
        })
      ));
    } catch (err) {
      console.error("notifyAdminNewListing error:", err);
    }
  },

  // إشعار للأدمن عند إنشاء معرض جديد
  async notifyAdminNewExhibition(ex: { id: string; name: string; userName: string }): Promise<void> {
    try {
      const adminSnap = await getDocs(query(collection(db, "users"), where("type", "==", "admin")));
      const adminIds = adminSnap.docs.map((d) => d.id);
      await Promise.all(adminIds.map((uid) =>
        notificationsService.create({
          userId: uid,
          type: "new_listing_admin",
          title: "معرض جديد",
          body: `أنشأ ${ex.userName || "مستخدم"} معرض "${ex.name}".`,
          read: false,
          listingId: ex.id,
          url: `/exhibitions/${ex.id}`,
        })
      ));
    } catch (err) {
      console.error("notifyAdminNewExhibition error:", err);
    }
  },

  // تأكيد لصاحب المعرض عند إنشائه
  async notifyExhibitionCreated(userId: string, name: string): Promise<void> {
    await notificationsService.create({
      userId,
      type: "system",
      title: "تم إنشاء معرضك 🎉",
      body: `معرض "${name}" أصبح نشطاً. أضف منتجاتك الآن ليراها العملاء.`,
      read: false,
      url: `/exhibitions`,
    });
  },

  // إشعار للأدمن عند تقديم طلب تمويل جديد
  async notifyAdminNewFinanceRequest(req: { id: string; name: string }): Promise<void> {    try {
      const adminSnap = await getDocs(query(collection(db, "users"), where("type", "==", "admin")));
      const adminIds = adminSnap.docs.map((d) => d.id);
      await Promise.all(adminIds.map((uid) =>
        notificationsService.create({
          userId: uid,
          type: "new_listing_admin",
          title: "طلب تمويل جديد",
          body: `تقدّم ${req.name} بطلب تمويل جديد وهو قيد المراجعة.`,
          read: false,
          listingId: req.id,
          url: "/my-finance",
        })
      ));
    } catch (err) {
      console.error("notifyAdminNewFinanceRequest error:", err);
    }
  },

  // إشعار للمستخدم عند الموافقة على إعلانه
  async notifyUserListingApproved(userId: string, listing: { id: string; title: string }): Promise<void> {
    await notificationsService.create({
      userId,
      type: "listing_approved",
      title: "تمت الموافقة على إعلانك",
      body: `تمت الموافقة على إعلان "${listing.title}" وهو الآن منشور.`,
      read: false,
      listingId: listing.id,
      url: `/listing/${listing.id}`,
    });
  },

  // إشعار للمستخدم عند رفض إعلانه
  async notifyUserListingRejected(userId: string, listing: { id: string; title: string }): Promise<void> {
    await notificationsService.create({
      userId,
      type: "listing_rejected",
      title: "تم رفض الإعلان",
      body: `عذراً، لم تتم الموافقة على إعلان "${listing.title}"، يرجى مراجعة الشروط.`,
      read: false,
      listingId: listing.id,
      url: "/my-listings",
    });
  },

  // إشعار للمستخدم عند الموافقة على وظيفته
  async notifyUserJobApproved(userId: string, job: { id: string; title: string }): Promise<void> {
    await notificationsService.create({
      userId,
      type: "listing_approved",
      title: "تمت الموافقة على وظيفتك",
      body: `تمت الموافقة على وظيفة "${job.title}" وهي الآن منشورة.`,
      read: false,
      listingId: job.id,
      url: "/jobs",
    });
  },

  // إشعار للمستخدم عند رفض وظيفته
  async notifyUserJobRejected(userId: string, job: { id: string; title: string }): Promise<void> {
    await notificationsService.create({
      userId,
      type: "listing_rejected",
      title: "تم رفض الوظيفة",
      body: `عذراً، لم تتم الموافقة على وظيفة "${job.title}"، يرجى مراجعة الشروط.`,
      read: false,
      listingId: job.id,
      url: "/my-listings",
    });
  },

  // إشعار برسالة جديدة
  async notifyNewMessage(recipientId: string, senderName: string, conversationId: string, senderId?: string): Promise<void> {
    await notificationsService.create({
      userId: recipientId,
      type: 'message',
      title: 'رسالة جديدة',
      body: `لديك رسالة جديدة من ${senderName}`,
      read: false,
      listingId: conversationId,
      url: senderId ? `/inbox/${senderId}` : '',
    });
  },

  // إشعار للأدمن بطلب إعادة تعيين كلمة سر
  async notifyAdminPasswordResetRequest(req: { phone: string; userName?: string }): Promise<void> {
    try {
      const adminSnap = await getDocs(query(collection(db, "users"), where("type", "==", "admin")));
      const adminIds = adminSnap.docs.map((d) => d.id);
      await Promise.all(adminIds.map((uid) =>
        notificationsService.create({
          userId: uid,
          type: "new_listing_admin",
          title: "طلب إعادة تعيين كلمة سر",
          body: `المستخدم ${req.userName || req.phone} طلب إعادة تعيين كلمة السر.`,
          read: false,
        })
      ));
    } catch (err) {
      console.error("notifyAdminPasswordResetRequest error:", err);
    }
  },
};

// ══════════════════════════════════════════════════════
//  PAYMENTS
// ══════════════════════════════════════════════════════
export const paymentsService = {
  async create(data: any): Promise<any> {
    const ref = await addDoc(collection(db, "payments"), { ...data, createdAt: serverTimestamp() });
    return { ...data, id: ref.id, createdAt: new Date().toISOString() };
  },
  async getAll(): Promise<any[]> {
    const snaps = await getDocs(query(collection(db, "payments"), limit(100)));
    return snaps.docs.map(s => ({ id: s.id, ...s.data(), createdAt: toDate(s.data().createdAt) }));
  },
  async getByUser(userId: string): Promise<any[]> {
    const snaps = await getDocs(query(collection(db, "payments"), where("userId", "==", userId), limit(50)));
    return snaps.docs.map(s => ({ id: s.id, ...s.data(), createdAt: toDate(s.data().createdAt) }));
  },
  async update(id: string, data: any): Promise<void> {
    await updateDoc(doc(db, "payments", id), { ...data, updatedAt: serverTimestamp() });
  },
};

// ══════════════════════════════════════════════════════
//  EXHIBITIONS
// ══════════════════════════════════════════════════════
export const exhibitionsService = {
  async create(data: Omit<Exhibition, 'id' | 'createdAt'>): Promise<Exhibition> {
    const ref = await addDoc(collection(db, "exhibitions"), {
      ...data, status: 'active', productCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return { ...data, id: ref.id, status: 'active', productCount: 0, createdAt: new Date().toISOString() } as Exhibition;
  },
  async getAll(): Promise<Exhibition[]> {
    try {
      const snaps = await getDocs(query(collection(db, "exhibitions"), orderBy("createdAt", "desc"), limit(100)));
      return snaps.docs.map(s => ({ id: s.id, ...s.data(), createdAt: toDate(s.data().createdAt) })) as Exhibition[];
    } catch (error) {
      console.warn("exhibitionsService.getAll failed (returning empty):", error);
      return [];
    }
  },
  async getActive(): Promise<Exhibition[]> {
    try {
      // بدون orderBy: where(status) + orderBy(createdAt) يتطلب composite index غير منشور
      const snaps = await getDocs(query(collection(db, "exhibitions"), where("status", "==", "active"), limit(100)));
      const results = snaps.docs.map(s => ({ id: s.id, ...s.data(), createdAt: toDate(s.data().createdAt) })) as Exhibition[];
      return sortByDate(results);
    } catch (error) {
      console.warn("exhibitionsService.getActive failed (returning empty):", error);
      return [];
    }
  },
  async getById(id: string): Promise<Exhibition | null> {
    try {
      const snap = await getDoc(doc(db, "exhibitions", id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data(), createdAt: toDate(snap.data().createdAt) } as Exhibition;
    } catch { return null; }
  },
  async getByUserId(userId: string): Promise<Exhibition[]> {
    try {
      const snaps = await getDocs(query(collection(db, "exhibitions"), where("userId", "==", userId), limit(20)));
      return snaps.docs.map(s => ({ id: s.id, ...s.data(), createdAt: toDate(s.data().createdAt) })) as Exhibition[];
    } catch { return []; }
  },
  async update(id: string, data: Partial<Exhibition>): Promise<void> {
    await updateDoc(doc(db, "exhibitions", id), { ...data, updatedAt: serverTimestamp() });
  },
  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, "exhibitions", id));
  },
  async addProduct(exhibitionId: string, product: Omit<ExhibitionProduct, 'id'>): Promise<ExhibitionProduct> {
    const data = { ...product, exhibitionId, status: 'active' as const };
    const ref = await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
    try { await updateDoc(doc(db, "exhibitions", exhibitionId), { productCount: increment(1) }); } catch { /* ignore */ }
    return { ...data, id: ref.id, images: product.images?.length ? product.images : undefined } as ExhibitionProduct;
  },
  async getProducts(exhibitionId: string): Promise<ExhibitionProduct[]> {
    try {
      const q = query(collection(db, "products"), where("exhibitionId", "==", exhibitionId), limit(200));
      const snaps = await getDocs(q);
      const main = snaps.docs.map(s => ({ id: s.id, ...s.data() })) as ExhibitionProduct[];
      let legacy: ExhibitionProduct[] = [];
      try {
        const legacySnaps = await getDocs(query(collection(db, "exhibitions", exhibitionId, "products"), limit(200)));
        legacy = legacySnaps.docs.map(s => ({ id: s.id, ...s.data() })) as ExhibitionProduct[];
      } catch { /* ignore */ }
      const merged = [...main, ...legacy];
      const seen = new Set<string>();
      return merged.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
    } catch { return []; }
  },
  async getProductById(productId: string): Promise<ExhibitionProduct | null> {
    try {
      const snap = await getDoc(doc(db, "products", productId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as ExhibitionProduct;
    } catch { return null; }
  },
  async getAllProducts(): Promise<ExhibitionProduct[]> {
    try {
      const snaps = await getDocs(query(collection(db, "products"), limit(200)));
      const all = snaps.docs.map(s => ({ id: s.id, ...s.data() })) as ExhibitionProduct[];
      return all.sort((a, b) => {
        const ta = (a.createdAt as any)?.seconds || (a.createdAt as any)?.toMillis?.() || 0;
        const tb = (b.createdAt as any)?.seconds || (b.createdAt as any)?.toMillis?.() || 0;
        return Number(tb) - Number(ta);
      });
    } catch { return []; }
  },
  async updateProduct(productId: string, data: Partial<ExhibitionProduct>, exhibitionId?: string): Promise<void> {
    const patch = { ...data, updatedAt: serverTimestamp() };
    let done = false;
    try {
      await updateDoc(doc(db, "products", productId), patch);
      done = true;
    } catch (e: any) {
      if (e?.code !== "not-found") throw e;
    }
    // نسخ قديمة محفوظة داخل exhibitions/{id}/products
    if (exhibitionId) {
      try {
        const sub = doc(db, "exhibitions", exhibitionId, "products", productId);
        if ((await getDoc(sub)).exists()) { await updateDoc(sub, patch); done = true; }
      } catch { /* ignore */ }
    }
    if (!done) throw new Error("لم يتم العثور على المنتج لتحديثه");
  },
  async setProductSold(exhibitionId: string, productId: string, sold: boolean): Promise<void> {
    const status = sold ? 'sold' : 'active';
    const patch = { status, updatedAt: serverTimestamp() };
    try {
      await updateDoc(doc(db, "products", productId), patch);
    } catch (e: any) {
      if (e?.code !== 'not-found') throw e;
    }
    const subCol = collection(db, "exhibitions", exhibitionId, "products");
    try {
      const byDocId = doc(db, "exhibitions", exhibitionId, "products", productId);
      if ((await getDoc(byDocId)).exists()) await updateDoc(byDocId, patch);
    } catch { /* ignore */ }
    try {
      const snaps = await getDocs(query(subCol, where("id", "==", productId)));
      await Promise.all(snaps.docs.map(s => updateDoc(s.ref, patch)));
    } catch { /* ignore */ }
  },
  async removeProduct(exhibitionId: string, productId: string): Promise<void> {
    try {
      let token: string | null = null;
      try {
        token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : null;
      } catch {}
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await fetch(`${getApiUrl()}/products-delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ productId, exhibitionId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!data?.success) throw new Error(data?.message || `HTTP ${resp.status}`);
    } catch (error) {
      console.warn("removeProduct: server delete failed, falling back to direct Firestore:", error);
    }
    try { await deleteDoc(doc(db, "products", productId)); } catch { /* ignore */ }
    try { await deleteDoc(doc(db, "exhibitions", exhibitionId, "products", productId)); } catch { /* ignore */ }
    try {
      const snaps = await getDocs(query(collection(db, "exhibitions", exhibitionId, "products"), where("id", "==", productId)));
      await Promise.all(snaps.docs.map(s => deleteDoc(s.ref)));
    } catch { /* ignore */ }
    try { await updateDoc(doc(db, "exhibitions", exhibitionId), { productCount: increment(-1) }); } catch { /* ignore */ }
  },
};

// ══════════════════════════════════════════════════════
//  BANNER ADS
// ══════════════════════════════════════════════════════
import type { BannerAd } from '../types';

export const bannerAdsService = {
  async getAll(): Promise<BannerAd[]> {
    try {
      const snaps = await getDocs(query(collection(db, "bannerAds"), orderBy("createdAt", "desc"), limit(50)));
      return snaps.docs.map(s => ({ id: s.id, ...s.data(), createdAt: toDate(s.data().createdAt) })) as BannerAd[];
    } catch (error) {
      console.warn("bannerAdsService.getAll failed (returning empty):", error);
      return [];
    }
  },
  async getActive(): Promise<BannerAd[]> {
    try {
      // بدون orderBy: where(status) + orderBy(createdAt) يتطلب composite index غير منشور
      const snaps = await getDocs(query(collection(db, "bannerAds"), where("status", "==", "active"), limit(20)));
      const results = snaps.docs.map(s => ({ id: s.id, ...s.data(), createdAt: toDate(s.data().createdAt) })) as BannerAd[];
      return sortByDate(results);
    } catch (error) {
      console.warn("bannerAdsService.getActive failed (returning empty):", error);
      return [];
    }
  },
  async getByPosition(position: string): Promise<BannerAd[]> {
    try {
      // فلترتا مساواة فقط (status + position) — Firestore يدمج single-field indexes ولا يحتاج composite
      const snaps = await getDocs(query(
        collection(db, "bannerAds"),
        where("status", "==", "active"),
        where("position", "==", position),
        limit(20),
      ));
      const results = snaps.docs.map(s => ({ id: s.id, ...s.data(), createdAt: toDate(s.data().createdAt) })) as BannerAd[];
      return sortByDate(results).slice(0, 5);
    } catch (error) {
      console.warn(`bannerAdsService.getByPosition("${position}") failed (returning empty):`, error);
      return [];
    }
  },
  async update(id: string, data: Partial<BannerAd>): Promise<void> {
    await updateDoc(doc(db, "bannerAds", id), { ...data, updatedAt: serverTimestamp() });
  },
};

// ══════════════════════════════════════════════════════
//  AD ANALYTICS (نقرات ومشاهدات الإعلانات)
// ══════════════════════════════════════════════════════
export const adAnalyticsService = {
  /** تجميع النقرات/المشاهدات من adAnalytics — لكل إعلان + لكل مصدر + لكل يوم */
  async getOverview() {
    const snaps = await getDocs(query(collection(db, "adAnalytics"), limit(500)));

    const perListing: Record<string, { clicks: number; impressions: number; last?: string }> = {};
    const perSource: Record<string, { clicks: number; impressions: number }> = {};
    const perDay: Record<string, { clicks: number; impressions: number }> = {};
    const listingIds = new Set<string>();

    snaps.docs.forEach(d => {
      const data = d.data() as any;
      const clicks = data.clicks || 0;
      const impressions = data.impressions || 0;
      const source = data.source || 'direct';
      const day = data.day || '';
      const listingId = data.listingId || '';

      if (d.id.startsWith("total_")) {
        if (!perListing[listingId]) perListing[listingId] = { clicks: 0, impressions: 0 };
        perListing[listingId].clicks += data.totalClicks || 0;
        perListing[listingId].impressions += data.totalImpressions || 0;
        perListing[listingId].last = data.lastClick?.toDate?.()?.toISOString() || perListing[listingId].last;
        return;
      }

      listingIds.add(listingId);
      if (!perSource[source]) perSource[source] = { clicks: 0, impressions: 0 };
      perSource[source].clicks += clicks;
      perSource[source].impressions += impressions;
      if (day) {
        if (!perDay[day]) perDay[day] = { clicks: 0, impressions: 0 };
        perDay[day].clicks += clicks;
        perDay[day].impressions += impressions;
      }
    });

    // جلب عناوين الإعلانات لأهم النتائج
    const ids = [...listingIds].slice(0, 60);
    const titles: Record<string, string> = {};
    for (let i = 0; i < ids.length; i += 10) {
      const chunk = ids.slice(i, i + 10);
      try {
        const tSnaps = await getDocs(query(collection(db, "listings"), where(documentId(), "in", chunk)));
        tSnaps.docs.forEach(t => { titles[t.id] = t.data().title || ''; });
      } catch { /* ignore */ }
    }

    const listings = Object.entries(perListing)
      .filter(([id]) => id)
      .map(([id, v]) => ({ id, title: titles[id] || id, ...v }))
      .sort((a, b) => (b.clicks + b.impressions) - (a.clicks + a.impressions))
      .slice(0, 30);

    const sources = Object.entries(perSource)
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => (b.clicks + b.impressions) - (a.clicks + a.impressions));

    const days = Object.entries(perDay)
      .filter(([d]) => d)
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14);

    const totalClicks = listings.reduce((s, l) => s + l.clicks, 0);
    const totalImpressions = listings.reduce((s, l) => s + l.impressions, 0);

    return { totalClicks, totalImpressions, ctr: totalImpressions ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0, listings, sources, days };
  },
};

// ══════════════════════════════════════════════════════
//  FINANCE COMPANIES
// ══════════════════════════════════════════════════════
import type { FinanceCompany } from '../types';

export const financeCompaniesService = {
  async getAll(): Promise<FinanceCompany[]> {
    try {
      const snaps = await getDocs(collection(db, "financeCompanies"));
      return snaps.docs.map(s => ({ id: s.id, ...s.data(), createdAt: toDate(s.data().createdAt) })) as FinanceCompany[];
    } catch { return []; }
  },
  async create(data: Omit<FinanceCompany, 'id' | 'createdAt'>): Promise<FinanceCompany> {
    const ref = await addDoc(collection(db, "financeCompanies"), { ...data, isActive: true, createdAt: serverTimestamp() });
    return { ...data, id: ref.id, isActive: true, createdAt: new Date().toISOString() } as FinanceCompany;
  },
  async update(id: string, data: Partial<FinanceCompany>): Promise<void> {
    await updateDoc(doc(db, "financeCompanies", id), { ...data, updatedAt: serverTimestamp() });
  },
  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, "financeCompanies", id));
  },
};

// ══════════════════════════════════════════════════════
//  SEED DATA
// ══════════════════════════════════════════════════════
export async function seedData(): Promise<{ listings: number; loads: number; jobs: number }> {
  const SEED_USER_ID = "seed-admin";
  const SEED_USER_NAME = "إدارة كار مصر";
  const SEED_USER_PHONE = "01018870145";

  const images: Record<string, string[]> = {
    trucks: [
      "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=900&q=80",
      "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=900&q=80",
      "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=900&q=80",
      "https://images.unsplash.com/photo-1670509295484-df0c2512fec4?w=900&q=80",
      "https://images.unsplash.com/photo-1559921565-086218ebdc18?w=900&q=80",
      "https://images.unsplash.com/photo-1559921565-086218ebdc18?w=900&q=80",
    ],
    equipment: [
      "https://images.unsplash.com/photo-1603814744247-ca3e77714471?w=900&q=80",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80",
      "https://images.unsplash.com/photo-1578262825743-a199d2f0a28e?w=900&q=80",
      "https://images.unsplash.com/photo-1590272456521-1bbe0cb0d032?w=900&q=80",
      "https://images.unsplash.com/photo-1603814744247-ca3e77714471?w=900&q=80",
      "https://images.unsplash.com/photo-1637076988526-f7a77037845c?w=900&q=80",
    ],
    trailers: [
      "https://images.unsplash.com/photo-1616432043562-3671ea2e5242?w=900&q=80",
      "https://images.unsplash.com/photo-1591768793355-74d04bb6608f?w=900&q=80",
      "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=900&q=80",
      "https://images.unsplash.com/photo-1566576912329-6b1f5f9d7437?w=900&q=80",
    ],
    buses: [
      "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=900&q=80",
      "https://images.unsplash.com/photo-1570125909232-eb263c188f90?w=900&q=80",
      "https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=900&q=80",
      "https://images.unsplash.com/photo-1637076988526-f7a77037845c?w=900&q=80",
    ],
    "spare-parts": [
      "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=900&q=80",
      "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=900&q=80",
      "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=900&q=80",
      "https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=900&q=80",
      "https://images.unsplash.com/photo-1590496793929-36417ef04be0?w=900&q=80",
    ],
  };

  const governorates = ["القاهرة", "الإسكندرية", "الجيزة", "الشرقية", "القليوبية", "الغربية", "الدقهلية", "البحيرة", "المنيا", "بورسعيد", "السويس", "دمياط", "المنوفية"];

  const cats = [
    {
      cat: "trucks", count: 10,
      subs: ["tractor-heads", "dump-trucks", "tankers", "flatbeds", "refrigerated"],
      titles: ["مرسيدس أكتروس 1845", "فولفو FH 460", "مان TGX 440", "سكانيا R500", "شاحنة قلاب", "رأس تانكر نقل وقود", "إيفكو ستراليس", "داف XF 480", "رينو T 460", "جاك HFC"],
      desc: ["صيانة دورية بالكامل، كاوتش بحالة جيدة، جاهز للعمل فوراً.", "موتور وفتيس بحالة ممتازة، مناسب للنقل الثقيل والمسافات الطويلة.", "ماشي 400 ألف كم فقط، بحالة الوكالة.", "فرش جديد، تكييف شغال، مناسب للنقل بين المحافظات."],
      brands: ["مرسيدس", "فولفو", "مان", "سكانيا", "شاكمان", "إيفكو", "داف", "رينو", "جاك", "دونغفنغ"],
      minP: 1500000, maxP: 5000000, years: [2018, 2019, 2020, 2021, 2022],
    },
    {
      cat: "equipment", count: 8,
      subs: ["excavators", "loaders", "cranes", "bulldozers", "forklifts"],
      titles: ["حفار كاتربيلر 320D", "لودر كوماتسو WA380", "كرين هيدروليك 50 طن", "بلدوزر كوماتسو D155", "رافعة شوكية 5 طن", "حفار هيونداي R220", "لودر فولفو L120", "هراس أسفلت"],
      desc: ["ساعات تشغيل مناسبة، بحالة ميكانيكية ممتازة.", "جاهز للعمل في المحاجر والمواقع الإنشائية.", "صيانة دورية، متوفر مع مشغل.", "استيراد الخارج، بحالة الوكالة."],
      brands: ["Caterpillar", "Komatsu", "Volvo", "Hitachi", "JCB", "هيونداي", "Daewoo", "Liebherr"],
      minP: 800000, maxP: 5500000, years: [2015, 2016, 2017, 2018, 2019, 2020],
    },
    {
      cat: "trailers", count: 8,
      subs: ["flatbeds", "refrigerated", "tankers", "dump-trailers"],
      titles: ["نصف مقطورة سطحة 3 محاور", "براد نقل مبرد 40 قدم", "تنكة نقل مياه 30 طن", "مقطورة قلاب 4 محاور", "هيكل نقل بضائع 12م", "مقطورة خيل", "لوبد نقل سيارات", "مقطورة ثلاجة 20 قدم"],
      desc: ["شاسيه قوي، 3 محاور، حمولة 40 طن.", "وحدة تبريد تعمل بكفاءة، مناسب للمنتجات الغذائية.", "صناعة محلية متينة، جاهز للعمل.", "حمولة عالية، مناسب للمقاولات."],
      brands: ["محلي", "Carrier", "Thermo King", "هيونداي", "مصرية", "تريلا", "Kogel", "Schmitz"],
      minP: 250000, maxP: 1800000, years: [2018, 2019, 2020, 2021, 2022, 2023],
    },
    {
      cat: "buses", count: 6,
      subs: ["passenger", "tourism", "school", "minibus"],
      titles: ["أتوبيس ركاب 50 راكب", "باص سياحي فاخر", "أتوبيس مدرسي", "ميني باص 15 راكب", "باص نقل عام", "فان ركاب 12 راكب"],
      desc: ["مكيف، كراسي مريحة، مناسب للخطوط الداخلية.", "مكيف سبليت، شاشات عرض، ثلاجة، مناسب للسياحة.", "لون أصفر، صلاحية مدرسية، بحالة جيدة.", "ماتور ديزل، توفير في الوقود."],
      brands: ["مرسيدس", "فولفو", "هيونداي", "كيا", "تويوتا", "نيسان"],
      minP: 350000, maxP: 2800000, years: [2016, 2017, 2018, 2019, 2020, 2021],
    },
    {
      cat: "spare-parts", count: 10,
      subs: ["engine", "transmission", "tires", "brakes", "electrical", "body"],
      titles: ["موتور MAN أوروبي كامل", "فتيس ZF استيراد", "طقم إطارات نقل 315/80R22.5", "طقم فرامل كامل هواء", "دينمو مرسيدس أصلي", "طقم كابوت كامل", "كمبروسر هواء شاحنة", "طقم دبرياج كامل", "رمان بلي عجل أمريكي", "حساسات موتور أكتروس"],
      desc: ["وارد الخارج، بالملحقات، ضمان 3 شهور.", "أصلي، بحالة ممتازة، فحص قبل التركيب.", "مقاس 315/80R22.5، متوفر أكثر من طقم.", "صناعة ألماني، ضمان 6 شهور."],
      brands: ["MAN", "ZF", "Mercedes", "Bridgestone", "Michelin", "Bosch", "Wabco", "Knorr"],
      minP: 8000, maxP: 450000, years: [],
    },
  ];

  let listingCount = 0;
  // إنشاء الإعلانات
  for (const c of cats) {
    for (let i = 0; i < c.count; i++) {
      const subcat = c.subs[i % c.subs.length];
      const title = c.titles[i % c.titles.length];
      const desc = c.desc[i % c.desc.length];
      const price = Math.floor(Math.random() * (c.maxP - c.minP) + c.minP);
      const gov = governorates[Math.floor(Math.random() * governorates.length)];
      const catImg = images[c.cat] || images.trucks;
      const year = c.years.length > 0 ? c.years[Math.floor(Math.random() * c.years.length)] : undefined;

      await addDoc(collection(db, "listings"), {
        title, description: desc, price, category: c.cat, subcategory: subcat,
        location: gov, governorate: gov,
        images: [catImg[i % catImg.length]],
        userId: SEED_USER_ID, userName: SEED_USER_NAME, userPhone: SEED_USER_PHONE,
        userType: "admin", verified: true, status: "active",
        featured: i < 2,
        brand: c.brands[i % c.brands.length], condition: "used",
        ...(year ? { year } : {}),
        createdAt: serverTimestamp(),
      });
      listingCount++;
    }
  }

  // إنشاء السيارات
  let loadCount = 0;
  const loadRoutes = [
    { origin: "القاهرة", dest: "الإسكندرية", cargo: "حديد", w: "24", p: 18500 },
    { origin: "السويس", dest: "الجيزة", cargo: "أسمنت", w: "30", p: 22000 },
    { origin: "دمياط", dest: "القاهرة", cargo: "أخشاب", w: "18", p: 14500 },
    { origin: "البحيرة", dest: "المنيا", cargo: "منتجات غذائية", w: "12", p: 19500 },
    { origin: "بورسعيد", dest: "القاهرة", cargo: "بضائع عامة", w: "20", p: 16500 },
    { origin: "الإسكندرية", dest: "أسيوط", cargo: "مواد بناء", w: "26", p: 28000 },
    { origin: "القليوبية", dest: "الغربية", cargo: "خضروات", w: "10", p: 8500 },
    { origin: "السويس", dest: "دمياط", cargo: "وقود", w: "32", p: 35000 },
    { origin: "الفيوم", dest: "القاهرة", cargo: "فاكهة", w: "8", p: 7000 },
    { origin: "الإسكندرية", dest: "الأقصر", cargo: "أجهزة كهربائية", w: "14", p: 32000 },
    { origin: "قنا", dest: "القاهرة", cargo: "مواد كيميائية", w: "16", p: 24000 },
    { origin: "العاشر من رمضان", dest: "بورسعيد", cargo: "بلاستيك", w: "11", p: 12000 },
  ];

  for (const r of loadRoutes) {
    await addDoc(collection(db, "loads"), {
      origin: r.origin, destination: r.dest, cargoType: r.cargo, weight: r.w, price: r.p,
      distance: "",
      date: new Date(Date.now() + Math.random() * 14 * 86400000).toISOString().split("T")[0],
      userId: SEED_USER_ID, userName: SEED_USER_NAME, userPhone: SEED_USER_PHONE,
      status: "available", createdAt: serverTimestamp(),
    });
    loadCount++;
  }

  // إنشاء الوظائف
  let jobCount = 0;
  const jobs = [
    { t: "سائق السيارات الملاكي" , c: "شركة النقل الآمن"      , ty: "driver"   , s: "12,000 - 16,000 جنيه" , e: "5 سنوات"   },
    { t: "فني ميكانيكا ديزل", c: "مركز صيانة متطور"      , ty: "mechanic", s: "10,000 - 14,000 جنيه", e: "3 سنوات"   },
    { t: "منسق عمليات لوجستية", c: "شركة شحن وتوزيع"    , ty: "logistics", s: "9,000 - 13,000 جنيه" , e: "سنتان"    },
    { t: "مندوب مبيعات سيارات", c: "معرض سيارات"    , ty: "sales"    , s: "راتب + عمولة"        , e: "سنة"      },
    { t: "فني كهرباء سيارات", c: "مركز كهرباء متخصص"    , ty: "technician", s: "8,000 - 11,000 جنيه", e: "3 سنوات"  },
    { t: "أمين مستودع قطع غيار", c: "مستودع كار مصر"        , ty: "warehouse", s: "7,000 - 9,000 جنيه" , e: "سنة"      },
    { t: "سائق تريلا", c: "شركة نقل العجمي", ty: "driver", s: "15,000 - 20,000 جنيه", e: "7 سنوات" },
    { t: "محاسب تكاليف نقل", c: "مجموعة شحن متكاملة"    , ty: "logistics", s: "8,000 - 12,000 جنيه", e: "3 سنوات"  },
    { t: "فني كاوتش", c: "مركز خدمة إطارات"             , ty: "mechanic" , s: "6,000 - 8,000 جنيه"  , e: "سنتان"   },
    { t: "مدير ورشة", c: "ورشة صيانة كبرى"              , ty: "technician", s: "14,000 - 18,000 جنيه", e: "10 سنوات" },
  ];

  for (const j of jobs) {
    const gov = governorates[Math.floor(Math.random() * governorates.length)];
    await addDoc(collection(db, "jobs"), {
      title: j.t, company: j.c, type: j.ty, salary: j.s,
      location: gov, governorate: gov,
      description: `مطلوب ${j.t} للعمل في ${gov}، دوام كامل، راتب مجزي.`,
      requirements: ["خبرة في المجال", "رخصة سارية", "التزام", "قدرة على العمل تحت الضغط"],
      experience: j.e,
      userId: SEED_USER_ID, userName: SEED_USER_NAME, userPhone: SEED_USER_PHONE,
      status: "active", featured: false, createdAt: serverTimestamp(),
    });
    jobCount++;
  }

  return { listings: listingCount, loads: loadCount, jobs: jobCount };
}

export async function deleteSeedData(): Promise<{ listings: number; loads: number; jobs: number }> {
  const SEED_USER_ID = "seed-admin";
  let listingCount = 0, loadCount = 0, jobCount = 0;

  const listingSnap = await getDocs(query(collection(db, "listings"), where("userId", "==", SEED_USER_ID), limit(500)));
  await Promise.all(listingSnap.docs.map(d => deleteDoc(d.ref)));
  listingCount = listingSnap.size;

  const loadSnap = await getDocs(query(collection(db, "loads"), where("userId", "==", SEED_USER_ID), limit(500)));
  await Promise.all(loadSnap.docs.map(d => deleteDoc(d.ref)));
  loadCount = loadSnap.size;

  const jobSnap = await getDocs(query(collection(db, "jobs"), where("userId", "==", SEED_USER_ID), limit(500)));
  await Promise.all(jobSnap.docs.map(d => deleteDoc(d.ref)));
  jobCount = jobSnap.size;



  return { listings: listingCount, loads: loadCount, jobs: jobCount };
}

// ═══════════════════════════════════════════════════════════════
//  SHIFTS — حاسبة الوردية (بيانات خاصة بكل مستخدم)
// ═══════════════════════════════════════════════════════════════
export const shiftsService = {
  async create(data: Omit<Shift, "id" | "createdAt">): Promise<Shift> {
    const ref = await addDoc(collection(db, "shifts"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...data, id: ref.id, createdAt: new Date().toISOString() };
  },

  async update(id: string, data: Partial<Omit<Shift, "id" | "userId" | "createdAt">>): Promise<void> {
    await updateDoc(doc(db, "shifts", id), { ...data, updatedAt: serverTimestamp() });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, "shifts", id));
  },

  /** ورديات المستخدم الحالي — الأحدث أولًا (بدون composite index) */
  async getMine(userId: string): Promise<Shift[]> {
    try {
      const q = query(collection(db, "shifts"), where("userId", "==", userId), limit(200));
      const snaps = await getDocs(q);
      return snaps.docs
        .map(s => ({ ...cleanId<Shift>(s), createdAt: toDate(s.data().createdAt) }))
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    } catch {
      return [];
    }
  },

  /** كل الورديات — للأدمن فقط (القواعد تمنع غير الأدمن) */
  async getAll(): Promise<Shift[]> {
    try {
      const snaps = await getDocs(query(collection(db, "shifts"), limit(300)));
      return snaps.docs
        .map(s => ({ ...cleanId<Shift>(s), createdAt: toDate(s.data().createdAt) }))
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    } catch {
      return [];
    }
  },
};