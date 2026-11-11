import { Building2, Store, Star, Crown } from 'lucide-react';
import type { ElementType } from 'react';
import type { ExhibitionPlanId } from '../types';

export interface ExhibitionPlan {
  id: ExhibitionPlanId;
  name: string;
  price: number;
  rank: number;
  maxProducts: number;
  allowsLogo: boolean;
  allowsCover: boolean;
  allowsSocial: boolean;
  badge: string | null;
  popular: boolean;
  highlight: 'none' | 'simple' | 'strong' | 'top';
  cta: string;
  color: string;
  bg: string;
  textColor: string;
  icon: ElementType;
  features: string[];
}

export const EXHIBITION_PLANS: ExhibitionPlan[] = [
  {
    id: 'free',
    name: 'مجاني',
    price: 0,
    rank: 0,
    maxProducts: 5,
    allowsLogo: false,
    allowsCover: false,
    allowsSocial: false,
    badge: 'جديد',
    popular: false,
    highlight: 'none',
    cta: 'ابدأ مجاناً',
    color: 'border-green-200 bg-green-50',
    bg: 'bg-green-100',
    textColor: 'text-green-700',
    icon: Building2,
    features: ['معرض رقمي', 'ظهور في صفحة المعارض', 'رابط مشاركة', 'بيانات التواصل', 'حتى 5 منتجات'],
  },
  {
    id: 'basic',
    name: 'أساسي',
    price: 200,
    rank: 1,
    maxProducts: 20,
    allowsLogo: true,
    allowsCover: false,
    allowsSocial: false,
    badge: null,
    popular: false,
    highlight: 'simple',
    cta: 'اختيار الباقة',
    color: 'border-gray-200 bg-gray-50',
    bg: 'bg-gray-100',
    textColor: 'text-gray-700',
    icon: Store,
    features: ['كل مزايا المجاني', 'حتى 20 منتج', 'شعار المعرض', 'زر اتصال مباشر', 'زر واتساب', 'تمييز بسيط في المعارض'],
  },
  {
    id: 'premium',
    name: 'متقدم',
    price: 400,
    rank: 2,
    maxProducts: 50,
    allowsLogo: true,
    allowsCover: true,
    allowsSocial: true,
    badge: 'الأكثر طلباً',
    popular: true,
    highlight: 'strong',
    cta: 'اختيار المتقدم',
    color: 'border-orange/40 bg-orange/10',
    bg: 'bg-orange/10',
    textColor: 'text-orange',
    icon: Star,
    features: ['كل مزايا الأساسي', 'حتى 50 منتج', 'صورة غلاف للمعرض', 'تصميم أكثر احترافية', 'تمييز واضح في المعارض', 'أزرار اتصال واضحة', 'إبراز اسم وشعار المعرض'],
  },
  {
    id: 'vip',
    name: 'VIP',
    price: 600,
    rank: 3,
    maxProducts: 100,
    allowsLogo: true,
    allowsCover: true,
    allowsSocial: true,
    badge: 'الأعلى قيمة',
    popular: false,
    highlight: 'top',
    cta: 'اختيار VIP',
    color: 'border-amber-300 bg-amber-50',
    bg: 'bg-amber-100',
    textColor: 'text-amber-700',
    icon: Crown,
    features: ['كل مزايا المتقدم', 'حتى 100 منتج', 'صورة غلاف مميزة', 'شارة VIP بجانب الاسم', 'أولوية في ترتيب المعارض', 'الظهور أعلى صفحة المعارض', 'أولوية في نتائج البحث', 'أزرار اتصال وواتساب بارزة'],
  },
];

export function getExhibitionPlan(id?: string | null): ExhibitionPlan {
  return EXHIBITION_PLANS.find(p => p.id === id) || EXHIBITION_PLANS[0];
}

export const PLAN_CTA: Record<ExhibitionPlanId, string> = Object.fromEntries(
  EXHIBITION_PLANS.map(p => [p.id, p.cta])
) as Record<ExhibitionPlanId, string>;

export const PLAN_LABELS: Record<string, { label: string; icon: ElementType; color: string; bg: string; highlight: ExhibitionPlan['highlight'] }> =
  Object.fromEntries(
    EXHIBITION_PLANS.map(p => [p.id, {
      label: p.name,
      icon: p.icon,
      color: p.textColor,
      bg: p.bg,
      highlight: p.highlight,
    }])
  ) as Record<string, { label: string; icon: ElementType; color: string; bg: string; highlight: ExhibitionPlan['highlight'] }>;

export const HIGHLIGHT_LABEL: Record<ExhibitionPlan['highlight'], string> = {
  none: '—',
  simple: 'بسيط',
  strong: 'واضح',
  top: 'قوي',
};


