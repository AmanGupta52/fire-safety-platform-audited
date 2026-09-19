export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent?: string | null;
}

export interface ProductImage { url: string; alt?: string }

export interface Product {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  category: string | Category;
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
  ratingAverage: number;
  ratingCount: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  priceAtAdd: number;
}

export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  discount: number;
  gstAmount: number;
  shippingFee: number;
  total: number;
  couponCode?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'packed' | 'dispatched' | 'delivered' | 'cancelled' | 'refunded';

export interface OrderItem { product: string; name: string; sku: string; quantity: number; unitPrice: number; gstPercentage: number; lineTotal: number }

export interface Order {
  _id: string;
  orderNumber: string;
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
  createdAt: string;
}

export interface Address {
  _id: string;
  label: string;
  contactName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export type QuoteStatus = 'requested' | 'reviewing' | 'sent' | 'approved' | 'rejected' | 'converted';
export interface QuoteItem { product: string; name: string; quantity: number }
export interface Quote {
  _id: string;
  quoteNumber: string;
  items: QuoteItem[];
  status: QuoteStatus;
  pdfUrl?: string;
  totalAmount?: number;
  createdAt: string;
}

export type EquipmentStatus = 'healthy' | 'inspection_due_soon' | 'refill_due_soon' | 'overdue';
export interface CustomerEquipment {
  _id: string;
  productNameSnapshot: string;
  serialNumber: string;
  installationLocation?: string;
  purchaseDate?: string;
  installationDate?: string;
  lastInspectionDate?: string;
  lastRefillDate?: string;
  nextInspectionDate?: string;
  nextRefillDate?: string;
  notes?: string;
  status: EquipmentStatus;
}

export type ServiceType = 'installation' | 'inspection' | 'refilling' | 'repair' | 'fire_safety_audit' | 'amc_visit';
export type ServiceStatus = 'requested' | 'confirmed' | 'assigned' | 'technician_on_the_way' | 'in_progress' | 'completed' | 'cancelled';
export interface ServiceBooking {
  _id: string;
  bookingNumber: string;
  serviceType: ServiceType;
  address: string;
  preferredDate: string;
  preferredTime?: string;
  status: ServiceStatus;
  createdAt: string;
}

export type AMCStatus = 'requested' | 'active' | 'expiring_soon' | 'expired' | 'renewed' | 'cancelled';
export interface AMCContract {
  _id: string;
  contractNumber: string;
  planName: string;
  startDate: string;
  endDate: string;
  status: AMCStatus;
  amount: number;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  order: string;
  grandTotal: number;
  pdfUrl?: string;
  createdAt: string;
}

export interface Review {
  _id: string;
  user: { name: string } | string;
  rating: number;
  title?: string;
  comment: string;
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
  publishedAt?: string;
}

export interface FAQ { _id: string; question: string; answer: string; category?: string }
export interface GalleryItem { _id: string; title: string; category: string; image: string; description?: string }

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
