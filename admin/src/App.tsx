import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';

import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import ProductsList from './pages/products/ProductsList';
import CategoriesList from './pages/categories/CategoriesList';
import OrdersList from './pages/orders/OrdersList';
import QuotesList from './pages/quotes/QuotesList';
import ServicesList from './pages/services/ServicesList';
import TechniciansList from './pages/technicians/TechniciansList';
import AmcList from './pages/amc/AmcList';
import CustomersList from './pages/customers/CustomersList';
import ReviewsList from './pages/reviews/ReviewsList';
import CouponsList from './pages/coupons/CouponsList';
import BlogList from './pages/blog/BlogList';
import GalleryList from './pages/content/GalleryList';
import FaqList from './pages/content/FaqList';
import StaffList from './pages/staff/StaffList';
import SettingsPage from './pages/settings/Settings';
import AuditLogPage from './pages/audit/AuditLogPage';
import ReportsPage from './pages/reports/ReportsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />

          <Route path="/products" element={<ProtectedRoute permission="products.read"><ProductsList /></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute permission="categories.read"><CategoriesList /></ProtectedRoute>} />

          <Route path="/orders" element={<ProtectedRoute permission="orders.read"><OrdersList /></ProtectedRoute>} />
          <Route path="/quotes" element={<ProtectedRoute permission="quotes.read"><QuotesList /></ProtectedRoute>} />
          <Route path="/coupons" element={<ProtectedRoute permission="coupons.read"><CouponsList /></ProtectedRoute>} />

          <Route path="/services" element={<ProtectedRoute permission="services.read"><ServicesList /></ProtectedRoute>} />
          <Route path="/amc" element={<ProtectedRoute permission="amc.read"><AmcList /></ProtectedRoute>} />
          <Route path="/technicians" element={<ProtectedRoute permission="technicians.read"><TechniciansList /></ProtectedRoute>} />

          <Route path="/customers" element={<ProtectedRoute permission="customers.read"><CustomersList /></ProtectedRoute>} />
          <Route path="/reviews" element={<ProtectedRoute permission="reviews.read"><ReviewsList /></ProtectedRoute>} />

          <Route path="/blog" element={<ProtectedRoute permission="blog.read"><BlogList /></ProtectedRoute>} />
          <Route path="/gallery" element={<ProtectedRoute permission="gallery.read"><GalleryList /></ProtectedRoute>} />
          <Route path="/faqs" element={<ProtectedRoute permission="faqs.read"><FaqList /></ProtectedRoute>} />

          <Route path="/reports" element={<ProtectedRoute permission="reports.read"><ReportsPage /></ProtectedRoute>} />
          <Route path="/staff" element={<StaffList />} />
          <Route path="/audit-logs" element={<ProtectedRoute permission="audit.read"><AuditLogPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute permission="settings.manage"><SettingsPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
