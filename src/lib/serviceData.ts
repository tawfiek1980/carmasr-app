import {
  Wrench, Truck, FileText, Shield, Calendar, Gauge, Search,
  Star, Package, MapPin, Store, BadgeCheck, Car, Settings2,
} from 'lucide-react';

export type ServiceIconKey = 'wrench'|'truck'|'filetext'|'shield'|'calendar'|'gauge'|'search'|'star'|'package'|'map'|'store'|'badgecheck'|'car'|'settings';

export interface ManagedService {
  id: string;
  name: string;
  description: string;
  image: string;
  features: string[];
  iconKey: ServiceIconKey;
  active: boolean;
  order: number;
  contactPhones?: string[];
  address?: string;
  facebook?: string;
}

export const SERVICE_ICONS: Record<ServiceIconKey, React.ComponentType<{ className?: string }>> = {
  wrench: Wrench,
  truck: Truck,
  filetext: FileText,
  shield: Shield,
  calendar: Calendar,
  gauge: Gauge,
  search: Search,
  star: Star,
  package: Package,
  map: MapPin,
  store: Store,
  badgecheck: BadgeCheck,
  car: Car,
  settings: Settings2,
};

export const SERVICE_ICON_OPTIONS: { key: ServiceIconKey; label: string }[] = [
  { key: 'wrench', label: 'صيانة' },
  { key: 'gauge', label: 'قطع غيار' },
  { key: 'search', label: 'فحص' },
  { key: 'shield', label: 'تأمين' },
  { key: 'truck', label: 'نقل / لوجستيات' },
  { key: 'filetext', label: 'مستندات' },
  { key: 'car', label: 'معدات / مركبات' },
  { key: 'package', label: 'شحن' },
  { key: 'map', label: 'توصيل' },
  { key: 'store', label: 'معارض' },
  { key: 'badgecheck', label: 'توثيق' },
  { key: 'calendar', label: 'مواعيد' },
  { key: 'star', label: 'مميز' },
  { key: 'settings', label: 'خدمات عامة' },
];

export const SERVICE_FALLBACK_IMAGE = '/images/services/maintenance.svg';

export const DEFAULT_SERVICES: ManagedService[] = [
  {
    id: 'maintenance',
    name: 'صيانة الشاحنات',
    iconKey: 'wrench',
    description: 'خدمات صيانة شاملة للشاحنات الثقيلة في مصر',
    image: '/images/services/maintenance.svg',
    features: ['صيانة دورية', 'إصلاح المحركات', 'فحص شامل'],
    active: true,
    order: 0,
  },
  {
    id: 'spare-parts',
    name: 'القطع الغيار',
    iconKey: 'gauge',
    description: 'قطع غيار أصلية للشاحنات والمعدات الثقيلة',
    image: '/images/services/spare-parts.svg',
    features: ['قطع أصلية', 'تركيب سريع', 'ضمان'],
    active: true,
    order: 1,
  },
  {
    id: 'inspection',
    name: 'فحص قبل الشراء',
    iconKey: 'search',
    description: 'فحص ميكانيكي شامل قبل شراء أي شاحنة أو معدة',
    image: '/images/services/inspection.svg',
    features: ['فحص ميكانيكي', 'تقرير مفصل', 'تقييم السعر'],
    active: true,
    order: 2,
  },
  {
    id: 'insurance',
    name: 'تأمين الشاحنات',
    iconKey: 'shield',
    description: 'تأمين شامل ضد الحوادث والأعطال للشاحنات الثقيلة',
    image: '/images/services/insurance.svg',
    features: ['تأمين ضد الحوادث', 'تأمين البضائع', 'تسويق مجاني'],
    active: true,
    order: 3,
  },
  {
    id: 'logistics',
    name: 'حلول لوجستية',
    iconKey: 'truck',
    description: 'حلول لوجستية متكاملة لشركات النقل',
    image: '/images/services/logistics.svg',
    features: ['تخطيط المسارات', 'إدارة المخزن', 'تتبع الشحنات'],
    active: true,
    order: 4,
  },
  {
    id: 'documents',
    name: 'تخلصيات سيارات',
    iconKey: 'filetext',
    description: 'تقديم جميع الخدمات الحكومية للشاحنات والمعدات',
    image: '/images/services/documents.svg',
    features: ['تجديد رخصة', 'نقل الملكية', 'تسجيل شاحنة'],
    active: true,
    order: 5,
  },
];

export const normalizeService = (raw: any, index: number): ManagedService => ({
  id: raw?.id || `sv_${index}_${Math.random().toString(36).slice(2, 6)}`,
  name: raw?.name || '',
  description: raw?.description || '',
  image: raw?.image || SERVICE_FALLBACK_IMAGE,
  features: Array.isArray(raw?.features) ? raw.features.slice(0, 3) : [],
  iconKey: (SERVICE_ICONS[raw?.iconKey as ServiceIconKey] ? raw.iconKey : 'wrench') as ServiceIconKey,
  active: raw?.active !== false,
  order: raw?.order ?? index,
  contactPhones: Array.isArray(raw?.contactPhones)
    ? raw.contactPhones.filter((p: unknown) => typeof p === 'string' && p.trim()).slice(0, 3).map((p: string) => p.trim())
    : [],
  address: typeof raw?.address === 'string' ? raw.address.trim() : '',
  facebook: typeof raw?.facebook === 'string' ? raw.facebook.trim() : '',
});