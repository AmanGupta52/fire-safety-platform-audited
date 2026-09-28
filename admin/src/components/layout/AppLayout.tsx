import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const titleMap: Record<string, string> = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/categories': 'Categories',
  '/orders': 'Orders',
  '/quotes': 'Quotations',
  '/coupons': 'Coupons',
  '/services': 'Services',
  '/bookings': 'Service Bookings',
  '/invoices': 'Invoices',
  '/equipment': 'Equipment',
  '/banners': 'Banners',
  '/my-jobs': 'My Jobs',
  '/amc': 'AMC Contracts',
  '/technicians': 'Technicians',
  '/customers': 'Customers',
  '/reviews': 'Reviews',
  '/blog': 'Blog',
  '/gallery': 'Gallery',
  '/faqs': 'FAQs',
  '/reports': 'Reports & Analytics',
  '/staff': 'Staff & Roles',
  '/audit-logs': 'Audit Log',
  '/settings': 'Settings'
};

export function AppLayout() {
  const location = useLocation();
  const base = '/' + (location.pathname.split('/')[1] || '');
  const title = titleMap[base] || titleMap['/'];
  // Below the lg breakpoint the sidebar is an off-canvas drawer opened from the Topbar menu button.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  return (
    <div className="flex h-dvh bg-paper">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar title={title} onMenuClick={() => setNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
