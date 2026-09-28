// Central catalog of granular permissions. Every protected route checks against this list
// on the backend — the frontend never decides authorization on its own.

export const PERMISSIONS = [
  'products.read', 'products.create', 'products.update', 'products.delete',
  'categories.read', 'categories.create', 'categories.update', 'categories.delete',
  'orders.read', 'orders.update', 'orders.cancel', 'orders.delete',
  'quotes.read', 'quotes.create', 'quotes.update', 'quotes.delete',
  'customers.read', 'customers.create', 'customers.update', 'customers.delete',
  'services.read', 'services.create', 'services.update', 'services.delete', 'services.publish', 'services.manage',
  'service_bookings.read', 'service_bookings.create', 'service_bookings.update', 'service_bookings.assign', 'service_bookings.delete',
  'technicians.read', 'technicians.create', 'technicians.update', 'technicians.delete',
  'amc.read', 'amc.create', 'amc.update', 'amc.delete',
  'equipment.read', 'equipment.create', 'equipment.update', 'equipment.delete',
  'reviews.read', 'reviews.update', 'reviews.moderate', 'reviews.delete',
  'blog.read', 'blog.create', 'blog.update', 'blog.delete',
  'gallery.read', 'gallery.create', 'gallery.delete',
  'faqs.read', 'faqs.create', 'faqs.update', 'faqs.delete',
  'coupons.read', 'coupons.create', 'coupons.update', 'coupons.delete',
  'reports.read',
  'settings.read', 'settings.manage',
  'staff.read', 'staff.create', 'staff.update', 'staff.delete', 'staff.manage',
  'roles.read', 'roles.manage',
  'notifications.read', 'notifications.manage',
  'audit.read'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = 'super_admin' | 'admin' | 'sales' | 'technician' | 'accountant' | 'customer';

// Role -> permission set. 'super_admin' implicitly has everything (checked in middleware).
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [...PERMISSIONS],
  admin: [...PERMISSIONS].filter((p) => p !== 'staff.manage' && p !== 'staff.delete' && p !== 'roles.manage'),
  sales: [
    'products.read', 'categories.read',
    'orders.read', 'orders.update',
    'quotes.read', 'quotes.create', 'quotes.update',
    'customers.read', 'customers.create', 'customers.update',
    'services.read', 'service_bookings.read', 'service_bookings.create',
    'coupons.read',
    'reports.read'
  ],
  technician: [
    'services.read', 'services.update',
    'service_bookings.read', 'service_bookings.update',
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

