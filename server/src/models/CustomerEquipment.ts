import { Schema, model, Document, Types } from 'mongoose';

export type EquipmentStatus = 'healthy' | 'inspection_due_soon' | 'refill_due_soon' | 'overdue';

export interface ICustomerEquipment extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  product?: Types.ObjectId | null;
  productNameSnapshot: string;
  serialNumber: string;
  purchaseDate?: Date;
  installationDate?: Date;
  installationLocation?: string;
  lastInspectionDate?: Date;
  lastRefillDate?: Date;
  nextInspectionDate?: Date;
  nextRefillDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  computeStatus(): EquipmentStatus;
}

const customerEquipmentSchema = new Schema<ICustomerEquipment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    productNameSnapshot: { type: String, required: true },
    serialNumber: { type: String, required: true, index: true },
    purchaseDate: { type: Date },
    installationDate: { type: Date },
    installationLocation: { type: String },
    lastInspectionDate: { type: Date },
    lastRefillDate: { type: Date },
    nextInspectionDate: { type: Date, index: true },
    nextRefillDate: { type: Date, index: true },
    notes: { type: String }
  },
  { timestamps: true }
);

customerEquipmentSchema.methods.computeStatus = function (): EquipmentStatus {
  const now = new Date();
  const soonThresholdDays = 15;
  const dates = [this.nextInspectionDate, this.nextRefillDate].filter(Boolean) as Date[];
  if (dates.length === 0) return 'healthy';

  const msPerDay = 1000 * 60 * 60 * 24;
  let status: EquipmentStatus = 'healthy';

  for (const date of dates) {
    const diffDays = Math.floor((date.getTime() - now.getTime()) / msPerDay);
    if (diffDays < 0) return 'overdue';
    if (diffDays <= soonThresholdDays) {
      status = date === this.nextRefillDate ? 'refill_due_soon' : 'inspection_due_soon';
    }
  }
  return status;
};

export const CustomerEquipment = model<ICustomerEquipment>('CustomerEquipment', customerEquipmentSchema);
