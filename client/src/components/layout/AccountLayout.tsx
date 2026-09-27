import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Package, FileText, MapPin, FlameKindling, FileBadge, Wrench, User, Bell } from 'lucide-react';
import clsx from 'clsx';

const links = [
  { to: '/account', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/account/orders', label: 'My orders', icon: Package },
  { to: '/account/quotes', label: 'My quotes', icon: FileText },
  { to: '/account/equipment', label: 'My equipment', icon: FlameKindling },
  { to: '/account/services', label: 'Service history', icon: Wrench },
  { to: '/account/invoices', label: 'Invoices', icon: FileBadge },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin },
  { to: '/account/notifications', label: 'Notifications', icon: Bell },
  { to: '/account/profile', label: 'Profile', icon: User }
];

export function AccountLayout() {
  return (
    <div className="container-page py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                clsx(
                  'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-ink text-white' : 'text-slateink hover:bg-white'
                )
              }
            >
              <link.icon className="h-4 w-4" /> {link.label}
            </NavLink>
          ))}
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
