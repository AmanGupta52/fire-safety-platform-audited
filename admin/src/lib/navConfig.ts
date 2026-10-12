import { LayoutDashboard, Package, Layers, ShoppingCart, FileText, Wrench, ShieldCheck, Users, Newspaper, Image, ImagePlus, HelpCircle, Ticket, Star, UserCog, HardHat, Receipt, Settings, History, CalendarCheck, ClipboardList } from 'lucide-react';
import { Permission, Role } from '../types';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  roles?: Role[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Catalog',
    items: [
      { to: '/products', label: 'Products', icon: Package, permission: 'products.read' },
      { to: '/categories', label: 'Categories', icon: Layers, permission: 'categories.read' }
    ]
  },
  {
    label: 'Commerce',
    items: [
      { to: '/orders', label: 'Orders', icon: ShoppingCart, permission: 'orders.read' },
      { to: '/invoices', label: 'Invoices', icon: Receipt, permission: 'orders.read' },
      { to: '/quotes', label: 'Quotes', icon: FileText, permission: 'quotes.read' },
      { to: '/coupons', label: 'Coupons', icon: Ticket, permission: 'coupons.read' }
    ]
  },
  {
    label: 'Services',
    items: [
      { to: '/my-jobs', label: 'My jobs', icon: ClipboardList, roles: ['technician'] },
      { to: '/services', label: 'Services', icon: Wrench, permission: 'services.read' },
      { to: '/bookings', label: 'Bookings', icon: CalendarCheck, permission: 'services.read' },
      { to: '/amc', label: 'AMC Contracts', icon: ShieldCheck, permission: 'amc.read' },
      { to: '/technicians', label: 'Technicians', icon: UserCog, permission: 'technicians.read' },
      { to: '/equipment', label: 'Equipment', icon: HardHat, permission: 'equipment.read' }
    ]
  },
  {
    label: 'CRM',
    items: [
      { to: '/customers', label: 'Customers', icon: Users, permission: 'customers.read' },
      { to: '/reviews', label: 'Reviews', icon: Star, permission: 'reviews.read' }
    ]
  },
  {
    label: 'Content',
    items: [
      { to: '/blog', label: 'Blog', icon: Newspaper, permission: 'blog.read' },
      { to: '/banners', label: 'Banners', icon: ImagePlus, permission: 'gallery.read' },
      { to: '/gallery', label: 'Gallery', icon: Image, permission: 'gallery.read' },
      { to: '/faqs', label: 'FAQs', icon: HelpCircle, permission: 'faqs.read' }
    ]
  },
  {
    label: 'Administration',
    items: [
      { to: '/reports', label: 'Reports', icon: LayoutDashboard, permission: 'reports.read' },
      { to: '/staff', label: 'Staff & Roles', icon: UserCog, permission: 'staff.read' },
      { to: '/audit-logs', label: 'Audit Log', icon: History, permission: 'audit.read' },
      { to: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin'] }
    ]
  }
];


type UserLike = { role: Role } | null | undefined;

/** True when this user may open the page behind a nav item (same rule the sidebar and the route guards use). */
export function canAccessNavItem(item: NavItem, user: UserLike, hasPermission: (perm: Permission) => boolean): boolean {
  return (!item.permission || hasPermission(item.permission)) && (!item.roles || Boolean(user && item.roles.includes(user.role)));
}

/**
 * Where a signed-in user should land. Technicians go straight to their jobs; anyone without access to the dashboard
 * reports goes to the first page in the sidebar they are allowed to open; everyone else gets the dashboard.
 * Returns '/' only when there is nothing better, so callers must not redirect '/' to itself.
 */
export function getHomeRouteFor(user: UserLike, hasPermission: (perm: Permission) => boolean): string {
  if (!user) return '/login';
  if (user.role === 'technician') return '/my-jobs';
  if (hasPermission('reports.read')) return '/';
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.to !== '/' && canAccessNavItem(item, user, hasPermission)) return item.to;
    }
  }
  return '/';
}

/**
 * Whether a path like "/orders/123" is a page this user may open, judged by its top-level section against the
 * sidebar rules. Paths that are not in the sidebar (reset-password, status pages, ...) count as open.
 */
export function canOpenPath(path: string, user: UserLike, hasPermission: (perm: Permission) => boolean): boolean {
  const section = '/' + (path.split('/')[1] || '');
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.to === section) return canAccessNavItem(item, user, hasPermission);
    }
  }
  return true;
}
