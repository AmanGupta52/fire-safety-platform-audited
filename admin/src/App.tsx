import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { setNavigate } from './lib/navigation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login, ResetPassword, Dashboard, ProductsList, CategoriesList, OrdersList, InvoicesList, QuotesList, ServicesList, BookingsList, TechniciansList, EquipmentList, MyJobs, AmcList, CustomersList, ReviewsList, CouponsList, BlogList, BannersList, GalleryList, FaqList, StaffList, SettingsPage, AuditLogPage, ReportsPage } from './routes/lazyPages';
import { PageLoader } from './components/ui/Primitives';
import { ServerWakingBanner } from './components/ui/ServerWakingBanner';

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
      <ServerWakingBanner />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
          <Route path="/settings" element={<ProtectedRoute roles={['super_admin']}><SettingsPage /></ProtectedRoute>} />

          {/* Any unmatched path — including while logged out, since the outer ProtectedRoute
              above redirects to /login before this ever renders in that case — keeps the
              sidebar/topbar for a logged-in visitor so they can navigate away. */}
          <Route path="*" element={<NotFound404 />} />
        </Route>
        </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
