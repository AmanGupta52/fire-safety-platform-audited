export type Role = 'super_admin' | 'admin' | 'sales' | 'technician' | 'accountant' | 'customer';

export type Permission =
  | 'products.read' | 'products.create' | 'products.update' | 'products.delete'
  | 'categories.read' | 'categories.create' | 'categories.update' | 'categories.delete'
  | 'orders.read' | 'orders.update' | 'orders.delete'
  | 'quotes.read' | 'quotes.create' | 'quotes.update' | 'quotes.delete'
  | 'customers.read' | 'customers.update'
  | 'services.read' | 'services.update' | 'services.create'
  | 'technicians.read' | 'technicians.create' | 'technicians.update'
  | 'amc.read' | 'amc.create' | 'amc.update'
  | 'equipment.read' | 'equipment.update'
  | 'reviews.read' | 'reviews.update'
  | 'blog.read' | 'blog.create' | 'blog.update' | 'blog.delete'
  | 'gallery.read' | 'gallery.create' | 'gallery.delete'
  | 'faqs.read' | 'faqs.create' | 'faqs.update' | 'faqs.delete'
  | 'coupons.read' | 'coupons.create' | 'coupons.update' | 'coupons.delete'
  | 'reports.read'
  | 'settings.manage'
  | 'staff.manage'
  | 'audit.read';

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductImage { url: string; publicId?: string; alt?: string }

export interface Product {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  category: string | Category;
  subcategory?: string | null;
  brand?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  discountPrice?: number;
  gstPercentage: number;
  stock: number;
  minimumOrderQuantity: number;
  allowBackorder: boolean;
  unit: string;
  capacity?: string;
  weight?: string;
  fireClass?: string[];
  modelNumber?: string;
  specifications: { key: string; value: string }[];
  features: string[];
  certifications: string[];
  images: ProductImage[];
  datasheetUrl?: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'packed' | 'dispatched' | 'delivered' | 'cancelled' | 'refunded';

export interface OrderItem {
  product: string; name: string; sku: string; quantity: number;
  unitPrice: number; gstPercentage: number; lineTotal: number;
}

export interface Order {
  _id: string;
  orderNumber: string;
  user: { _id: string; name: string; email: string; phone?: string } | string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  gstAmount: number;
  shippingFee: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: 'unpaid' | 'paid' | 'failed' | 'refunded';
  paymentMethod: 'mock' | 'cod' | 'razorpay';
  billingAddress: Record<string, string>;
  shippingAddress: Record<string, string>;
  companyName?: string;
  gstNumber?: string;
  createdAt: string;
}

export type QuoteStatus = 'requested' | 'reviewing' | 'sent' | 'approved' | 'rejected' | 'converted';

export interface QuoteItem { product: string; name: string; quantity: number; unitPrice?: number; gstPercentage?: number }

export interface Quote {
  _id: string;
  quoteNumber: string;
  user?: string | null;
  customerName: string;
  companyName?: string;
  phone: string;
  email: string;
  gstNumber?: string;
  address?: string;
  items: QuoteItem[];
  requirements?: string;
  status: QuoteStatus;
  validUntil?: string;
  totalAmount?: number;
  pdfUrl?: string;
  createdAt: string;
}

export type ServiceType = 'installation' | 'inspection' | 'refilling' | 'repair' | 'fire_safety_audit' | 'amc_visit';
export type ServiceStatus = 'requested' | 'confirmed' | 'assigned' | 'technician_on_the_way' | 'in_progress' | 'completed' | 'cancelled';

export interface ServiceBooking {
  _id: string;
  bookingNumber: string;
  user: { _id: string; name: string; email: string; phone?: string } | string;
  serviceType: ServiceType;
  phone: string;
  address: string;
  preferredDate: string;
  preferredTime?: string;
  assignedTechnician?: { _id: string; name: string; phone: string } | string | null;
  status: ServiceStatus;
  problemDescription?: string;
  adminNotes?: string;
  createdAt: string;
}

export interface Technician {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  employeeId: string;
  skills: string[];
  serviceArea: string[];
  status: 'active' | 'inactive';
}

export type AMCStatus = 'requested' | 'active' | 'expiring_soon' | 'expired' | 'renewed' | 'cancelled';

export interface AMCContract {
  _id: string;
  contractNumber: string;
  user: { _id: string; name: string; email: string; phone?: string } | string;
  planName: string;
  startDate: string;
  endDate: string;
  status: AMCStatus;
  amount: number;
  assignedTechnician?: string | null;
}

export interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  customerType: 'b2c' | 'b2b' | 'corporate';
  companyName?: string;
  gstNumber?: string;
  isActive: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
}

export interface Coupon {
  _id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrder: number;
  maximumDiscount?: number;
  startDate: string;
  endDate: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
}

export interface Review {
  _id: string;
  product: { _id: string; name: string; slug: string } | string;
  user: { _id: string; name: string; email: string } | string;
  rating: number;
  title?: string;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  category?: string;
  tags: string[];
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
}

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  permissionOverrides: Permission[];
  createdAt: string;
}

export interface AuditLogEntry {
  _id: string;
  user: { _id: string; name: string; email: string; role: Role } | string;
  action: string;
  module: string;
  entity?: string;
  entityId?: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalRevenue: number;
  todayRevenue: number;
  monthlyRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  pendingQuotes: number;
  activeCustomers: number;
  amcDue: number;
  servicesToday: number;
  lowStockProducts: number;
}
