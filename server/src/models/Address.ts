import { Schema, model, Document, Types } from 'mongoose';

export interface IAddress extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
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
  type: 'billing' | 'shipping' | 'both';
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, default: 'Home' },
    contactName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false },
    type: { type: String, enum: ['billing', 'shipping', 'both'], default: 'both' }
  },
  { timestamps: true }
);

export const Address = model<IAddress>('Address', addressSchema);
