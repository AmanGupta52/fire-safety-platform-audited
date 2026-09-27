import { Schema, model, Document, Types } from 'mongoose';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  user: Types.ObjectId;
  amount: number;
  method: 'mock' | 'cod' | 'razorpay';
  status: 'initiated' | 'success' | 'failed' | 'refunded';
  providerReferenceId?: string;
  rawResponse?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['mock', 'cod', 'razorpay'], required: true },
    status: { type: String, enum: ['initiated', 'success', 'failed', 'refunded'], default: 'initiated' },
    providerReferenceId: { type: String },
    rawResponse: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export const Payment = model<IPayment>('Payment', paymentSchema);
