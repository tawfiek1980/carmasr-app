/** حالة الإعلان المتاحة للمستخدم: متاح / محجوز / تم البيع / موقوف / منتهي */
export type ListingStatus = "available" | "reserved" | "sold" | "paused" | "expired";

/** كل الحالات مع النص اللي يظهر على البطاقة */
export const STATUS_LABELS: Record<string, string> = {
  available: "متاح",
  reserved: "محجوز",
  sold: "تم البيع",
  paused: "موقوف",
  expired: "منتهي",
};

/** الحالات اللي بتخفي الإعلان من القوائم الافتراضية */
export const HIDDEN_STATUSES = ["sold", "expired", "paused"];

/**
 * هل الإعلان معروض للبيع؟
 * sold أو expired أو paused أو status مفيشش = مش معروض
 */
export const isAvailable = (status?: string, priceType?: string): boolean => {
  const s = (status || "available").toLowerCase();
  if (s === "sold" || s === "expired" || s === "paused") return false;
  if (priceType === "sold") return false;
  return true;
};

export { isSold } from "./utils";

/** فلتر سريع للقوائم: يشيل المباع والمنتهي والموقوف */
export const filterAvailable = <T extends { status?: string; priceType?: string }>(
  items: T[]
): T[] => items.filter((it) => isAvailable(it.status, it.priceType));

/** تسمية الحالة للعرض */
export const statusLabel = (status?: string): string =>
  STATUS_LABELS[(status || "available").toLowerCase()] || "";

/** كل الحالات اللي صاحب الإعلان يقدر يختارها بنفسه (من غير «منتهي» — ده تلقائي) */
export const OWNER_STATUS_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "available", label: "متاح", hint: "الإعلان ظاهر ومتاح للبيع" },
  { value: "reserved", label: "محجوز", hint: "محجوز لعميل — يظهر بعلامة محجوز" },
  { value: "paused", label: "موقوف مؤقتًا", hint: "أوقفته مؤقتًا لحد ما تجهز" },
  { value: "sold", label: "تم البيع", hint: "الإعلان انتهى" },
];

/** الحالات اللي بتتعرض كشارة في صفحة التفاصيل */
export const VISIBLE_STATUS_BADGES = ["reserved", "paused", "sold", "expired"];

/** هل الحالة دي بتتقال في الكارت؟ (متاح مبيتقالش) */
export const showsStatusBadge = (status?: string, priceType?: string): boolean => {
  const st = priceType === "sold" ? "sold" : (status || "available").toLowerCase();
  return VISIBLE_STATUS_BADGES.includes(st);
};