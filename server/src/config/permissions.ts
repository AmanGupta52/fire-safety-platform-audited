// Central catalog of granular permissions. Every protected route checks against this list
// on the backend — the frontend never decides authorization on its own.

export const PERMISSIONS = [
  'products.read', 'products.create', 'products.update', 'products.delete',
  'categories.read', 'categories.create', 'categories.update', 'categories.delete',
  'orders.read', 'orders.update', 'orders.delete',
  'quotes.read', 'quotes.create', 'quotes.update', 'quotes.delete',
  'customers.read', 'customers.update',
  'services.read', 'services.update', 'services.create',
  'technicians.read', 'technicians.create', 'technicians.update',
  'amc.read', 'amc.create', 'amc.update',
  'equipment.read', 'equipment.update',
  'reviews.read', 'reviews.update',
  'blog.read', 'blog.create', 'blog.update', 'blog.delete',
  'gallery.read', 'gallery.create', 'gallery.delete',
  'faqs.read', 'faqs.create', 'faqs.update', 'faqs.delete',
  'coupons.read', 'coupons.create', 'coupons.update', 'coupons.delete',
  'reports.read',
  'settings.manage',
  'staff.manage',
  'audit.read'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = 'super_admin' | 'admin' | 'sales' | 'technician' | 'accountant' | 'customer';

// Role -> permission set. 'super_admin' implicitly has everything (checked in middleware).
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [...PERMISSIONS],
  admin: [...PERMISSIONS].filter((p) => p !== 'staff.manage'),
  sales: [
    'products.read', 'categories.read',
    'orders.read', 'orders.update',
    'quotes.read', 'quotes.create', 'quotes.update',
    'customers.read', 'customers.update',
    'coupons.read',
    'reports.read'
  ],
  technician: [
    'services.read', 'services.update',
    'amc.read',
    'equipment.read',
    'technicians.read'
  ],
  accountant: [
    'orders.read',
    'quotes.read',
    'reports.read',
    'coupons.read'
  ],
  customer: []
};
