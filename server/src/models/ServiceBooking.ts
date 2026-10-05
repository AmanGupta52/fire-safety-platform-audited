import { Schema, model, Document, Types } from 'mongoose';

export type ServiceType = string;
export type ServiceStatus =
  | 'requested' | 'confirmed' | 'assigned' | 'technician_on_the_way'
  | 'in_progress' | 'completed' | 'cancelled' | 'rejected';

export interface IServiceBooking extends Document {
  _id: Types.ObjectId;
  bookingNumber: string;
  user: Types.ObjectId;
  service?: Types.ObjectId | null;
  serviceType: ServiceType;
  phone: string;
  address: string;
  preferredDate: Date;
  preferredTime?: string;
  timeSlot?: string;
  equipment?: Types.ObjectId | null;
  problemDescription?: string;
  additionalNotes?: string;
  assignedTechnician?: Types.ObjectId | null;
  status: ServiceStatus;
  checkInLocation?: {
    latitude: number;
    longitude: number;
    timestamp: Date;
    address?: string;
  };
  customerSignature?: string;
  workSummary?: string;
  pressureReading?: string;
  sealIntact?: boolean;
  physicalCondition?: string;
  partsReplaced?: string[];
  serviceReportUrl?: string;
  beforePhotos: string[];
  afterPhotos: string[];
  /** INTERNAL staff notes. Never sent to customers. */
  adminNotes?: string;
  /** Customer-visible history of what happened to the booking (status changes, reschedules, cancellation). */
  timeline: { at: Date; by: 'customer' | 'staff' | 'technician' | 'system'; action: string; note?: string }[];
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const serviceBookingSchema = new Schema<IServiceBooking>(
  {
    bookingNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service', default: null, index: true },
    serviceType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    preferredDate: { type: Date, required: true, index: true },
    preferredTime: { type: String },
    timeSlot: { type: String },
    equipment: { type: Schema.Types.ObjectId, ref: 'CustomerEquipment', default: null },
    problemDescription: { type: String },
    additionalNotes: { type: String },
    assignedTechnician: { type: Schema.Types.ObjectId, ref: 'Technician', default: null },
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'assigned', 'technician_on_the_way', 'in_progress', 'completed', 'cancelled', 'rejected'],
      default: 'requested',
      index: true
    },
    checkInLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      timestamp: { type: Date },
      address: { type: String }
    },
    customerSignature: { type: String },
    workSummary: { type: String },
    pressureReading: { type: String },
    sealIntact: { type: Boolean, default: true },
    physicalCondition: { type: String },
    partsReplaced: { type: [String], default: [] },
    serviceReportUrl: { type: String },
    beforePhotos: { type: [String], default: [] },
    afterPhotos: { type: [String], default: [] },
    adminNotes: { type: String },
    timeline: {
      type: [
        {
          _id: false,
          at: { type: Date, default: Date.now },
          by: { type: String, enum: ['customer', 'staff', 'technician', 'system'], required: true },
          action: { type: String, required: true },
          note: { type: String }
        }
      ],
      default: []
    },
    completedAt: { type: Date }
  },
  { timestamps: true }
);

serviceBookingSchema.index({ service: 1, user: 1, status: 1, preferredDate: 1 });
serviceBookingSchema.index({ user: 1, createdAt: -1 });
serviceBookingSchema.index({ assignedTechnician: 1, status: 1, preferredDate: 1 });
serviceBookingSchema.index({ status: 1, preferredDate: 1 });
serviceBookingSchema.index({ serviceType: 1, status: 1 });

export const ServiceBooking = model<IServiceBooking>('ServiceBooking', serviceBookingSchema);

