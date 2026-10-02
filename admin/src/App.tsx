import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { setNavigate } from './lib/navigation';
import { ErrorBoundary } from './components/ErrorBoundary';

import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import ProductsList from './pages/products/ProductsList';
import CategoriesList from './pages/categories/CategoriesList';
import OrdersList from './pages/orders/OrdersList';
import InvoicesList from './pages/invoices/InvoicesList';
import QuotesList from './pages/quotes/QuotesList';
import ServicesList from './pages/services/ServicesList';
import BookingsList from './pages/bookings/BookingsList';
import TechniciansList from './pages/technicians/TechniciansList';
import EquipmentList from './pages/equipment/EquipmentList';
import MyJobs from './pages/my-jobs/MyJobs';
import AmcList from './pages/amc/AmcList';
import CustomersList from './pages/customers/CustomersList';
import ReviewsList from './pages/reviews/ReviewsList';
import CouponsList from './pages/coupons/CouponsList';
import BlogList from './pages/blog/BlogList';
import BannersList from './pages/content/BannersList';
import GalleryList from './pages/content/GalleryList';
import FaqList from './pages/content/FaqList';
import StaffList from './pages/staff/StaffList';
import SettingsPage from './pages/settings/Settings';
import AuditLogPage from './pages/audit/AuditLogPage';
import ReportsPage from './pages/reports/ReportsPage';
import { Unauthorized401, Forbidden403, NotFound404, ServerError500, ServiceUnavailable503 } from './pages/errors/StatusPages';

// Registers the router's navigate() function for apiClient.ts to use when a 401/403/500/503
// needs to send the person to the matching status page — see lib/navigation.ts.
function NavigateRegistrar() {
  const navigate = useNavigate();
  useEffect(() => { setNavigate(navigate); }, [navigate]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <NavigateRegistrar />
      <ErrorBoundary>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/401" element={<Unauthorized401 />} />
        <Route path="/403" element={<Forbidden403 />} />
        <Route path="/500" element={<ServerError500 />} />
        <Route path="/503" element={<ServiceUnavailable503 />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />

          <Route path="/products" element={<ProtectedRoute permission="products.read"><ProductsList /></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute permission="categories.read"><CategoriesList /></ProtectedRoute>} />

          <Route path="/orders" element={<ProtectedRoute permission="orders.read"><OrdersList /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute permission="orders.read"><InvoicesList /></ProtectedRoute>} />
          <Route path="/quotes" element={<ProtectedRoute permission="quotes.read"><QuotesList /></ProtectedRoute>} />
          <Route path="/coupons" element={<ProtectedRoute permission="coupons.read"><CouponsList /></ProtectedRoute>} />

          <Route path="/services" element={<ProtectedRoute permission="services.read"><ServicesList /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute permission="services.read"><BookingsList /></ProtectedRoute>} />
          <Route path="/amc" element={<ProtectedRoute permission="amc.read"><AmcList /></ProtectedRoute>} />
          <Route path="/technicians" element={<ProtectedRoute permission="technicians.read"><TechniciansList /></ProtectedRoute>} />
          <Route path="/equipment" element={<ProtectedRoute permission="equipment.read"><EquipmentList /></ProtectedRoute>} />
          <Route path="/my-jobs" element={<ProtectedRoute><MyJobs /></ProtectedRoute>} />

          <Route path="/customers" element={<ProtectedRoute permission="customers.read"><CustomersList /></ProtectedRoute>} />
          <Route path="/reviews" element={<ProtectedRoute permission="reviews.read"><ReviewsList /></ProtectedRoute>} />

          <Route path="/blog" element={<ProtectedRoute permission="blog.read"><BlogList /></ProtectedRoute>} />
          <Route path="/banners" element={<ProtectedRoute permission="gallery.read"><BannersList /></ProtectedRoute>} />
          <Route path="/gallery" element={<ProtectedRoute permission="gallery.read"><GalleryList /></ProtectedRoute>} />
          <Route path="/faqs" element={<ProtectedRoute permission="faqs.read"><FaqList /></ProtectedRoute>} />

          <Route path="/reports" element={<ProtectedRoute permission="reports.read"><ReportsPage /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute permission="staff.read"><StaffList /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute permission="audit.read"><AuditLogPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute permission="settings.manage"><SettingsPage /></ProtectedRoute>} />

          {/* Any unmatched path — including while logged out, since the outer ProtectedRoute
              above redirects to /login before this ever renders in that case — keeps the
              sidebar/topbar for a logged-in visitor so they can navigate away. */}
          <Route path="*" element={<NotFound404 />} />
        </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
