import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PageLoader } from '../ui/Loader';
import { LayoutDashboard, Package, FileText, MapPin, FlameKindling, FileBadge, Wrench, User, Bell } from 'lucide-react';
import clsx from 'clsx';
import { MetaTags } from '../seo/MetaTags';

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
      <MetaTags title="My account" noindex />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="glass flex h-fit gap-1 overflow-x-auto rounded-card p-2 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                clsx(
                  'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'skeuo-key text-on-ink' : 'text-slateink hover:bg-ink/10 hover:text-ink'
                )
              }
            >
              <link.icon className="h-4 w-4" /> {link.label}
            </NavLink>
          ))}
        </aside>
        <div className="min-w-0">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
