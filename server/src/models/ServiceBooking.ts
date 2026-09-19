import { Schema, model, Document, Types } from 'mongoose';

export type ServiceType = 'installation' | 'inspection' | 'refilling' | 'repair' | 'fire_safety_audit' | 'amc_visit';
export type ServiceStatus =
  | 'requested' | 'confirmed' | 'assigned' | 'technician_on_the_way'
  | 'in_progress' | 'completed' | 'cancelled';

export interface IServiceBooking extends Document {
  _id: Types.ObjectId;
  bookingNumber: string;
  user: Types.ObjectId;
  serviceType: ServiceType;
  phone: string;
  address: string;
  preferredDate: Date;
  preferredTime?: string;
  equipment?: Types.ObjectId | null;
  problemDescription?: string;
  additionalNotes?: string;
  assignedTechnician?: Types.ObjectId | null;
  status: ServiceStatus;
  serviceReportUrl?: string;
  beforePhotos: string[];
  afterPhotos: string[];
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const serviceBookingSchema = new Schema<IServiceBooking>(
  {
    bookingNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceType: {
      type: String,
      enum: ['installation', 'inspection', 'refilling', 'repair', 'fire_safety_audit', 'amc_visit'],
      required: true
    },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    preferredDate: { type: Date, required: true, index: true },
    preferredTime: { type: String },
    equipment: { type: Schema.Types.ObjectId, ref: 'CustomerEquipment', default: null },
    problemDescription: { type: String },
    additionalNotes: { type: String },
    assignedTechnician: { type: Schema.Types.ObjectId, ref: 'Technician', default: null },
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'assigned', 'technician_on_the_way', 'in_progress', 'completed', 'cancelled'],
      default: 'requested',
      index: true
    },
    serviceReportUrl: { type: String },
    beforePhotos: { type: [String], default: [] },
    afterPhotos: { type: [String], default: [] },
    adminNotes: { type: String }
  },
  { timestamps: true }
);

export const ServiceBooking = model<IServiceBooking>('ServiceBooking', serviceBookingSchema);
