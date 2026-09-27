import { Schema, model, Document, Types } from 'mongoose';

export type OrderStatus =
  | 'pending' | 'confirmed' | 'processing' | 'packed'
  | 'dispatched' | 'delivered' | 'cancelled' | 'refunded';

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  gstPercentage: number;
  lineTotal: number;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  user: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  gstAmount: number;
  shippingFee: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: 'unpaid' | 'paid' | 'failed' | 'refunded';
  paymentMethod: 'mock' | 'cod' | 'razorpay';
  billingAddress: Record<string, unknown>;
  shippingAddress: Record<string, unknown>;
  companyName?: string;
  gstNumber?: string;
  assignedDeliveryNote?: string;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    gstPercentage: { type: Number, required: true },
    lineTotal: { type: Number, required: true }
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String },
    gstAmount: { type: Number, required: true },
    shippingFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'packed', 'dispatched', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
      index: true
    },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'failed', 'refunded'], default: 'unpaid' },
    paymentMethod: { type: String, enum: ['mock', 'cod', 'razorpay'], default: 'mock' },
    billingAddress: { type: Schema.Types.Mixed, required: true },
    shippingAddress: { type: Schema.Types.Mixed, required: true },
    companyName: { type: String },
    gstNumber: { type: String },
    assignedDeliveryNote: { type: String },
    cancelReason: { type: String }
  },
  { timestamps: true }
);

export const Order = model<IOrder>('Order', orderSchema);
