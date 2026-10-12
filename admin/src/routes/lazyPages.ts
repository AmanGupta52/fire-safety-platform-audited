import { lazy } from 'react';

// Every page is its own chunk, downloaded the first time it is opened. App.tsx renders these inside <Suspense>,
// and preloadRoute() lets a link start the download early (on hover/focus) so the click feels instant.
const importers = {
  Login: () => import('../pages/auth/Login'),
  ResetPassword: () => import('../pages/auth/ResetPassword'),
  Dashboard: () => import('../pages/dashboard/Dashboard'),
  ProductsList: () => import('../pages/products/ProductsList'),
  CategoriesList: () => import('../pages/categories/CategoriesList'),
  OrdersList: () => import('../pages/orders/OrdersList'),
  InvoicesList: () => import('../pages/invoices/InvoicesList'),
  QuotesList: () => import('../pages/quotes/QuotesList'),
  ServicesList: () => import('../pages/services/ServicesList'),
  BookingsList: () => import('../pages/bookings/BookingsList'),
  TechniciansList: () => import('../pages/technicians/TechniciansList'),
  EquipmentList: () => import('../pages/equipment/EquipmentList'),
  MyJobs: () => import('../pages/my-jobs/MyJobs'),
  AmcList: () => import('../pages/amc/AmcList'),
  CustomersList: () => import('../pages/customers/CustomersList'),
  ReviewsList: () => import('../pages/reviews/ReviewsList'),
  CouponsList: () => import('../pages/coupons/CouponsList'),
  BlogList: () => import('../pages/blog/BlogList'),
  BannersList: () => import('../pages/content/BannersList'),
  GalleryList: () => import('../pages/content/GalleryList'),
  FaqList: () => import('../pages/content/FaqList'),
  StaffList: () => import('../pages/staff/StaffList'),
  SettingsPage: () => import('../pages/settings/Settings'),
  AuditLogPage: () => import('../pages/audit/AuditLogPage'),
  ReportsPage: () => import('../pages/reports/ReportsPage'),
};

export const Login = lazy(importers.Login);
export const ResetPassword = lazy(importers.ResetPassword);
export const Dashboard = lazy(importers.Dashboard);
export const ProductsList = lazy(importers.ProductsList);
export const CategoriesList = lazy(importers.CategoriesList);
export const OrdersList = lazy(importers.OrdersList);
export const InvoicesList = lazy(importers.InvoicesList);
export const QuotesList = lazy(importers.QuotesList);
export const ServicesList = lazy(importers.ServicesList);
export const BookingsList = lazy(importers.BookingsList);
export const TechniciansList = lazy(importers.TechniciansList);
export const EquipmentList = lazy(importers.EquipmentList);
export const MyJobs = lazy(importers.MyJobs);
export const AmcList = lazy(importers.AmcList);
export const CustomersList = lazy(importers.CustomersList);
export const ReviewsList = lazy(importers.ReviewsList);
export const CouponsList = lazy(importers.CouponsList);
export const BlogList = lazy(importers.BlogList);
export const BannersList = lazy(importers.BannersList);
export const GalleryList = lazy(importers.GalleryList);
export const FaqList = lazy(importers.FaqList);
export const StaffList = lazy(importers.StaffList);
export const SettingsPage = lazy(importers.SettingsPage);
export const AuditLogPage = lazy(importers.AuditLogPage);
export const ReportsPage = lazy(importers.ReportsPage);

/** Top-level URL -> the importer for that page (only static paths; parameterised pages load on click). */
const preloadByPath: Record<string, () => Promise<unknown>> = {
  '/login': importers.Login,
  '/reset-password': importers.ResetPassword,
  '/': importers.Dashboard,
  '/products': importers.ProductsList,
  '/categories': importers.CategoriesList,
  '/orders': importers.OrdersList,
  '/invoices': importers.InvoicesList,
  '/quotes': importers.QuotesList,
  '/coupons': importers.CouponsList,
  '/services': importers.ServicesList,
  '/bookings': importers.BookingsList,
  '/amc': importers.AmcList,
  '/technicians': importers.TechniciansList,
  '/equipment': importers.EquipmentList,
  '/my-jobs': importers.MyJobs,
  '/customers': importers.CustomersList,
  '/reviews': importers.ReviewsList,
  '/blog': importers.BlogList,
  '/banners': importers.BannersList,
  '/gallery': importers.GalleryList,
  '/faqs': importers.FaqList,
  '/reports': importers.ReportsPage,
  '/staff': importers.StaffList,
  '/audit-logs': importers.AuditLogPage,
  '/settings': importers.SettingsPage,
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
