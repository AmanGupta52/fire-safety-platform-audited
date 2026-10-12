import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import { StorefrontLayout } from './components/layout/StorefrontLayout';
import { AccountLayout } from './components/layout/AccountLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';

import { Unauthorized401, Forbidden403, NotFound404, ServerError500, ServiceUnavailable503 } from './pages/errors/StatusPages';
import { setNavigate } from './lib/navigation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home, ProductsList, ProductDetail, CartPage, WishlistPage, CheckoutPage, OrderSuccessPage, Login, Register, VerifyEmail, ForgotPassword, ResetPassword, AccountOverview, MyOrders, OrderDetail, MyQuotes, MyEquipment, MyServices, MyInvoices, MyAddresses, MyNotifications, Profile, ServicesOverview, ServiceDetail, BookService, RequestQuote, BlogList, BlogDetail, GalleryPage, FaqPage, ContactPage, AboutPage, EquipmentPassport, PrivacyPage, TermsPage } from './routes/lazyPages';
import { PageLoader } from './components/ui/Loader';
import { ServerWakingBanner } from './components/ui/ServerWakingBanner';

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
        <Route element={<StorefrontLayout />}>
          <Route index element={<Home />} />
          <Route path="/products" element={<ProductsList />} />
          <Route path="/products/:category" element={<ProductsList />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/search" element={<ProductsList />} />

          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
          <Route path="/order-success" element={<ProtectedRoute><OrderSuccessPage /></ProtectedRoute>} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/services" element={<ServicesOverview />} />
          <Route path="/services/:slug" element={<ServiceDetail />} />
          <Route path="/book-service" element={<BookService />} />
          <Route path="/request-quote" element={<RequestQuote />} />

          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogDetail />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy-policy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/passport/:identifier" element={<EquipmentPassport />} />

          <Route path="/401" element={<Unauthorized401 />} />
          <Route path="/403" element={<Forbidden403 />} />
          <Route path="/500" element={<ServerError500 />} />
          <Route path="/503" element={<ServiceUnavailable503 />} />

          <Route path="/account" element={<ProtectedRoute><AccountLayout /></ProtectedRoute>}>
            <Route index element={<AccountOverview />} />
            <Route path="orders" element={<MyOrders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="quotes" element={<MyQuotes />} />
            <Route path="equipment" element={<MyEquipment />} />
            <Route path="services" element={<MyServices />} />
            <Route path="invoices" element={<MyInvoices />} />
            <Route path="addresses" element={<MyAddresses />} />
            <Route path="notifications" element={<MyNotifications />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<NotFound404 />} />
        </Route>
        </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
