import { Wrench, RefreshCw, ClipboardCheck, ClipboardList, ShieldCheck, Flame, LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  installation: Wrench,
  refilling: RefreshCw,
  inspection: ClipboardCheck,
  'fire-safety-audit': ClipboardList,
  audit: ClipboardList,
  amc: ShieldCheck,
  maintenance: ShieldCheck,
  repair: Wrench,
  general: Flame
};

export function getServiceIcon(slug?: string, category?: string): LucideIcon {
  if (slug && ICON_MAP[slug]) return ICON_MAP[slug];
  if (category && ICON_MAP[category]) return ICON_MAP[category];
  return Wrench;
}

export function formatServicePrice(price: number, unit?: string, currency = '₹'): string {
  const formatted = price.toLocaleString('en-IN');
  return `${currency}${formatted}${unit ? unit : ''}`;
}
