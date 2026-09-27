import { Schema, model, Document, Types } from 'mongoose';

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  order: Types.ObjectId;
  user: Types.ObjectId;
  companySnapshot: Record<string, unknown>;
  customerSnapshot: Record<string, unknown>;
  items: {
    name: string; hsnCode?: string; quantity: number; unitPrice: number;
    gstPercentage: number; cgst: number; sgst: number; igst: number; lineTotal: number;
  }[];
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  pdfUrl?: string;
  pdfPublicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companySnapshot: { type: Schema.Types.Mixed, required: true },
    customerSnapshot: { type: Schema.Types.Mixed, required: true },
    items: {
      type: [
        {
          name: String, hsnCode: String, quantity: Number, unitPrice: Number,
          gstPercentage: Number, cgst: Number, sgst: Number, igst: Number, lineTotal: Number
        }
      ],
      required: true
    },
    subtotal: { type: Number, required: true },
    totalGst: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    pdfUrl: { type: String },
    pdfPublicId: { type: String }
  },
  { timestamps: true }
);

export const Invoice = model<IInvoice>('Invoice', invoiceSchema);
