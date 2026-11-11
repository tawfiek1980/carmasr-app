import { createElement } from 'react';
import { Truck, Construction, Container, Bus, Wrench, Package, HardHat, Landmark, Siren, Cog, Circle } from 'lucide-react';

const iconMap: Record<string, typeof Truck> = {
  trucks: Truck,
  equipment: Construction,
  trailers: Container,
  buses: Bus,
  'spare-parts': Cog,
  loads: Package,
  jobs: HardHat,
  finance: Landmark,
  emergency: Siren,
};

interface Props {
  categoryId: string;
  className?: string;
  color?: string;
}

export default function CategorySvgIcon({ categoryId, className = 'w-6 h-6', color }: Props) {
  const Icon = iconMap[categoryId] || Circle;
  return createElement(Icon, { className, style: color ? { color } : undefined });
}
