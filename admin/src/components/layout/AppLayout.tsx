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
  '/services': 'Service Bookings',
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

  return (
    <div className="flex h-screen bg-paper">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
