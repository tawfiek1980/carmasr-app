import {
  Truck, Construction, Container, Bus, Wrench, Package, HardHat, Landmark, Siren,
  GitPullRequest, Droplet, Snowflake, Mountain, LayoutGrid, Pickaxe, Shovel,
  ArrowUpFromLine, ArrowUpDown, Cog, Cpu, Route, Warehouse, Handshake,
  CircleDot, Zap, Circle, AlertCircle,
} from 'lucide-react';

const map: Record<string, typeof Truck> = {
  Truck, Construction, Container, Bus, Wrench, Package, HardHat, Landmark, Siren,
  GitPullRequest, Droplet, Snowflake, Mountain, LayoutGrid, Pickaxe, Shovel,
  ArrowUpFromLine, ArrowUpDown, Cog, Cpu, Route, Warehouse, Handshake,
  CircleDot, Zap,
};

export function getIcon(name: string) {
  return map[name] || Circle;
}
