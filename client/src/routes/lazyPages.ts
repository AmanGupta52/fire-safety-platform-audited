import { lazy } from 'react';

// Every page is its own chunk, downloaded the first time it is opened. App.tsx renders these inside <Suspense>,
// and preloadRoute() lets a link start the download early (on hover/focus) so the click feels instant.
const importers = {
  Home: () => import('../pages/Home'),
  ProductsList: () => import('../pages/products/ProductsList'),
  ProductDetail: () => import('../pages/products/ProductDetail'),
  CartPage: () => import('../pages/cart/CartPage'),
  WishlistPage: () => import('../pages/wishlist/WishlistPage'),
  CheckoutPage: () => import('../pages/checkout/CheckoutPage'),
  OrderSuccessPage: () => import('../pages/checkout/OrderSuccessPage'),
  Login: () => import('../pages/auth/Login'),
  Register: () => import('../pages/auth/Register'),
  VerifyEmail: () => import('../pages/auth/VerifyEmail'),
  ForgotPassword: () => import('../pages/auth/ForgotPassword'),
  ResetPassword: () => import('../pages/auth/ResetPassword'),
  AccountOverview: () => import('../pages/account/AccountOverview'),
  MyOrders: () => import('../pages/account/MyOrders'),
  OrderDetail: () => import('../pages/account/OrderDetail'),
  MyQuotes: () => import('../pages/account/MyQuotes'),
  MyEquipment: () => import('../pages/account/MyEquipment'),
  MyServices: () => import('../pages/account/MyServices'),
  MyInvoices: () => import('../pages/account/MyInvoices'),
  MyAddresses: () => import('../pages/account/MyAddresses'),
  MyNotifications: () => import('../pages/account/MyNotifications'),
  Profile: () => import('../pages/account/Profile'),
  ServicesOverview: () => import('../pages/services/ServicesOverview'),
  ServiceDetail: () => import('../pages/services/ServiceDetail'),
  BookService: () => import('../pages/services/BookService'),
  RequestQuote: () => import('../pages/services/RequestQuote'),
  BlogList: () => import('../pages/blog/BlogList'),
  BlogDetail: () => import('../pages/blog/BlogDetail'),
  GalleryPage: () => import('../pages/static/GalleryPage'),
  FaqPage: () => import('../pages/static/FaqPage'),
  ContactPage: () => import('../pages/static/ContactPage'),
  AboutPage: () => import('../pages/static/AboutPage'),
  EquipmentPassport: () => import('../pages/EquipmentPassport'),
  PrivacyPage: () => import('../pages/static/StaticPages').then((m) => ({ default: m.PrivacyPage })),
  TermsPage: () => import('../pages/static/StaticPages').then((m) => ({ default: m.TermsPage })),
};

export const Home = lazy(importers.Home);
export const ProductsList = lazy(importers.ProductsList);
export const ProductDetail = lazy(importers.ProductDetail);
export const CartPage = lazy(importers.CartPage);
export const WishlistPage = lazy(importers.WishlistPage);
export const CheckoutPage = lazy(importers.CheckoutPage);
export const OrderSuccessPage = lazy(importers.OrderSuccessPage);
export const Login = lazy(importers.Login);
export const Register = lazy(importers.Register);
export const VerifyEmail = lazy(importers.VerifyEmail);
export const ForgotPassword = lazy(importers.ForgotPassword);
export const ResetPassword = lazy(importers.ResetPassword);
export const AccountOverview = lazy(importers.AccountOverview);
export const MyOrders = lazy(importers.MyOrders);
export const OrderDetail = lazy(importers.OrderDetail);
export const MyQuotes = lazy(importers.MyQuotes);
export const MyEquipment = lazy(importers.MyEquipment);
export const MyServices = lazy(importers.MyServices);
export const MyInvoices = lazy(importers.MyInvoices);
export const MyAddresses = lazy(importers.MyAddresses);
export const MyNotifications = lazy(importers.MyNotifications);
export const Profile = lazy(importers.Profile);
export const ServicesOverview = lazy(importers.ServicesOverview);
export const ServiceDetail = lazy(importers.ServiceDetail);
export const BookService = lazy(importers.BookService);
export const RequestQuote = lazy(importers.RequestQuote);
export const BlogList = lazy(importers.BlogList);
export const BlogDetail = lazy(importers.BlogDetail);
export const GalleryPage = lazy(importers.GalleryPage);
export const FaqPage = lazy(importers.FaqPage);
export const ContactPage = lazy(importers.ContactPage);
export const AboutPage = lazy(importers.AboutPage);
export const EquipmentPassport = lazy(importers.EquipmentPassport);
export const PrivacyPage = lazy(importers.PrivacyPage);
export const TermsPage = lazy(importers.TermsPage);

/** Top-level URL -> the importer for that page (only static paths; parameterised pages load on click). */
const preloadByPath: Record<string, () => Promise<unknown>> = {
  '/': importers.AccountOverview,
  '/products': importers.ProductsList,
  '/products/:category': importers.ProductsList,
  '/product/:slug': importers.ProductDetail,
  '/search': importers.ProductsList,
  '/cart': importers.CartPage,
  '/wishlist': importers.WishlistPage,
  '/checkout': importers.CheckoutPage,
  '/order-success': importers.OrderSuccessPage,
  '/login': importers.Login,
  '/register': importers.Register,
  '/verify-email': importers.VerifyEmail,
  '/forgot-password': importers.ForgotPassword,
  '/reset-password': importers.ResetPassword,
  '/services': importers.ServicesOverview,
  '/services/:slug': importers.ServiceDetail,
  '/book-service': importers.BookService,
  '/request-quote': importers.RequestQuote,
  '/blog': importers.BlogList,
  '/blog/:slug': importers.BlogDetail,
  '/gallery': importers.GalleryPage,
  '/faq': importers.FaqPage,
  '/contact': importers.ContactPage,
  '/about': importers.AboutPage,
  '/privacy-policy': importers.PrivacyPage,
  '/terms': importers.TermsPage,
  '/passport/:identifier': importers.EquipmentPassport,
  'orders': importers.MyOrders,
  'orders/:id': importers.OrderDetail,
  'quotes': importers.MyQuotes,
  'equipment': importers.MyEquipment,
  'services': importers.MyServices,
  'invoices': importers.MyInvoices,
  'addresses': importers.MyAddresses,
  'notifications': importers.MyNotifications,
  'profile': importers.Profile,
  '/account': importers.AccountOverview,
  '/account/orders': importers.MyOrders,
  '/account/quotes': importers.MyQuotes,
  '/account/equipment': importers.MyEquipment,
  '/account/services': importers.MyServices,
  '/account/invoices': importers.MyInvoices,
  '/account/addresses': importers.MyAddresses,
  '/account/notifications': importers.MyNotifications,
  '/account/profile': importers.Profile,
};

const preloaded = new Set<string>();

/** Starts downloading the page behind `path` (a no-op for unknown paths or when already requested). */
export function preloadRoute(path: string): void {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const load = preloadByPath[clean];
  if (!load || preloaded.has(clean)) return;
  preloaded.add(clean);
  // A failed prefetch is harmless: the normal navigation will try again and show the error boundary if needed.
  load().catch(() => preloaded.delete(clean));
}
