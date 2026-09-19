import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard, Package, Layers, ShoppingCart, FileText, Wrench, ShieldCheck,
  Users, Newspaper, Image, HelpCircle, Ticket, Star, UserCog, Settings, History, FlameKindling
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Permission } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
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
      { to: '/quotes', label: 'Quotes', icon: FileText, permission: 'quotes.read' },
      { to: '/coupons', label: 'Coupons', icon: Ticket, permission: 'coupons.read' }
    ]
  },
  {
    label: 'Services',
    items: [
      { to: '/services', label: 'Bookings', icon: Wrench, permission: 'services.read' },
      { to: '/amc', label: 'AMC Contracts', icon: ShieldCheck, permission: 'amc.read' },
      { to: '/technicians', label: 'Technicians', icon: UserCog, permission: 'technicians.read' }
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
      { to: '/gallery', label: 'Gallery', icon: Image, permission: 'gallery.read' },
      { to: '/faqs', label: 'FAQs', icon: HelpCircle, permission: 'faqs.read' }
    ]
  },
  {
    label: 'Administration',
    items: [
      { to: '/reports', label: 'Reports', icon: LayoutDashboard, permission: 'reports.read' },
      { to: '/staff', label: 'Staff & Roles', icon: UserCog },
      { to: '/audit-logs', label: 'Audit Log', icon: History, permission: 'audit.read' },
      { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' }
    ]
  }
];

export function Sidebar() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const role = useAuthStore((s) => s.user?.role);

  return (
    <aside className="flex h-screen w-60 flex-col bg-ink text-white/90">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-brand">
          <FlameKindling className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="page-heading text-sm leading-tight text-white">Fire Safety</p>
          <p className="text-[10px] leading-tight text-white/50">Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || hasPermission(item.permission) || (item.label === 'Staff & Roles' && (role === 'super_admin' || role === 'admin'))
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-wide text-white/35">{group.label}</p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] font-medium transition-colors',
                        isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
