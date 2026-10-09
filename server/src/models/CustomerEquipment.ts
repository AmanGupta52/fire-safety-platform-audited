import { logger } from '../config/logger';
import { Schema, model, Document, Types } from 'mongoose';
import QRCode from 'qrcode';
import { env } from '../config/env';

export type EquipmentStatus = 'healthy' | 'inspection_due_soon' | 'refill_due_soon' | 'overdue';

export interface IEquipmentHistoryEntry {
  _id?: Types.ObjectId;
  date: Date;
  type: 'installation' | 'inspection' | 'refilling' | 'repair' | 'maintenance';
  technicianName?: string;
  pressureReading?: string;
  physicalCondition?: 'optimal' | 'fair' | 'damaged' | 'needs_replacement';
  sealIntact?: boolean;
  bookingId?: Types.ObjectId | null;
  notes?: string;
  reportUrl?: string;
}

export interface ICustomerEquipment extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  product?: Types.ObjectId | null;
  productNameSnapshot: string;
  serialNumber: string;
  capacity?: string;
  fireClass?: string[];
  purchaseDate?: Date;
  installationDate?: Date;
  installationLocation?: string;
  lastInspectionDate?: Date;
  lastRefillDate?: Date;
  nextInspectionDate?: Date;
  nextRefillDate?: Date;
  qrCode?: string;
  serviceHistory: IEquipmentHistoryEntry[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  computeStatus(): EquipmentStatus;
  generateQrCode(): Promise<string>;
}

const equipmentHistorySchema = new Schema<IEquipmentHistoryEntry>(
  {
    date: { type: Date, required: true, default: Date.now },
    type: {
      type: String,
      enum: ['installation', 'inspection', 'refilling', 'repair', 'maintenance'],
      required: true
    },
    technicianName: { type: String },
    pressureReading: { type: String },
    physicalCondition: {
      type: String,
      enum: ['optimal', 'fair', 'damaged', 'needs_replacement'],
      default: 'optimal'
    },
    sealIntact: { type: Boolean, default: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'ServiceBooking', default: null },
    notes: { type: String },
    reportUrl: { type: String }
  },
  { _id: true }
);

const customerEquipmentSchema = new Schema<ICustomerEquipment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    productNameSnapshot: { type: String, required: true },
    serialNumber: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    capacity: { type: String, default: '6 kg' },
    fireClass: { type: [String], default: ['A', 'B', 'C'] },
    purchaseDate: { type: Date },
    installationDate: { type: Date },
    installationLocation: { type: String },
    lastInspectionDate: { type: Date },
    lastRefillDate: { type: Date },
    nextInspectionDate: { type: Date, index: true },
    nextRefillDate: { type: Date, index: true },
    qrCode: { type: String },
    serviceHistory: { type: [equipmentHistorySchema], default: [] },
    notes: { type: String }
  },
  { timestamps: true }
);

customerEquipmentSchema.index({ user: 1, createdAt: -1 });

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

customerEquipmentSchema.methods.generateQrCode = async function (): Promise<string> {
  const passportUrl = `${env.clientUrl}/passport/${this.serialNumber}`;
  const qrDataUrl = await QRCode.toDataURL(passportUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#1e293b',
      light: '#ffffff'
    },
    width: 300
  });
  this.qrCode = qrDataUrl;
  return qrDataUrl;
};

customerEquipmentSchema.pre('save', async function (next) {
  if (!this.qrCode) {
    try {
      const passportUrl = `${env.clientUrl}/passport/${this.serialNumber}`;
      this.qrCode = await QRCode.toDataURL(passportUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' },
        width: 300
      });
    } catch (err) {
      logger.error({ err }, '[CustomerEquipment] Failed to generate QR code');
    }
  }
  next();
});

export const CustomerEquipment = model<ICustomerEquipment>('CustomerEquipment', customerEquipmentSchema);
