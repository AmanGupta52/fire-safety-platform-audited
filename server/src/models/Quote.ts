import { Schema, model, Document, Types } from 'mongoose';

export type QuoteStatus = 'requested' | 'reviewing' | 'sent' | 'approved' | 'rejected' | 'converted';

export interface IQuoteItem {
  product: Types.ObjectId;
  name: string;
  quantity: number;
  unitPrice?: number;
  gstPercentage?: number;
}

export interface IQuote extends Document {
  _id: Types.ObjectId;
  quoteNumber: string;
  user?: Types.ObjectId | null;
  customerName: string;
  companyName?: string;
  phone: string;
  email: string;
  gstNumber?: string;
  address?: string;
  items: IQuoteItem[];
  requirements?: string;
  preferredDate?: Date;
  additionalNotes?: string;
  status: QuoteStatus;
  validUntil?: Date;
  totalAmount?: number;
  pdfUrl?: string;
  pdfPublicId?: string;
  convertedOrder?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const quoteItemSchema = new Schema<IQuoteItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number },
    gstPercentage: { type: Number }
  },
  { _id: false }
);

const quoteSchema = new Schema<IQuote>(
  {
    quoteNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    customerName: { type: String, required: true },
    companyName: { type: String },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    gstNumber: { type: String },
    address: { type: String },
    items: { type: [quoteItemSchema], required: true },
    requirements: { type: String },
    preferredDate: { type: Date },
    additionalNotes: { type: String },
    status: {
      type: String,
      enum: ['requested', 'reviewing', 'sent', 'approved', 'rejected', 'converted'],
      default: 'requested',
      index: true
    },
    validUntil: { type: Date },
    totalAmount: { type: Number },
    pdfUrl: { type: String },
    pdfPublicId: { type: String },
    convertedOrder: { type: Schema.Types.ObjectId, ref: 'Order', default: null }
  },
  { timestamps: true }
);

export const Quote = model<IQuote>('Quote', quoteSchema);
