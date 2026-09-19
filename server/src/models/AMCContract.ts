import { Schema, model, Document, Types } from 'mongoose';

export type AMCStatus = 'requested' | 'active' | 'expiring_soon' | 'expired' | 'renewed' | 'cancelled';

export interface IAMCVisit {
  scheduledDate: Date;
  completedDate?: Date;
  technician?: Types.ObjectId | null;
  notes?: string;
  status: 'scheduled' | 'completed' | 'missed';
}

export interface IAMCContract extends Document {
  _id: Types.ObjectId;
  contractNumber: string;
  user: Types.ObjectId;
  planName: string;
  equipmentCovered: Types.ObjectId[];
  startDate: Date;
  endDate: Date;
  renewalDate?: Date;
  assignedTechnician?: Types.ObjectId | null;
  visits: IAMCVisit[];
  status: AMCStatus;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

const amcVisitSchema = new Schema<IAMCVisit>(
  {
    scheduledDate: { type: Date, required: true },
    completedDate: { type: Date },
    technician: { type: Schema.Types.ObjectId, ref: 'Technician', default: null },
    notes: { type: String },
    status: { type: String, enum: ['scheduled', 'completed', 'missed'], default: 'scheduled' }
  },
  { _id: false }
);

const amcContractSchema = new Schema<IAMCContract>(
  {
    contractNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planName: { type: String, required: true },
    equipmentCovered: [{ type: Schema.Types.ObjectId, ref: 'CustomerEquipment' }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true, index: true },
    renewalDate: { type: Date },
    assignedTechnician: { type: Schema.Types.ObjectId, ref: 'Technician', default: null },
    visits: { type: [amcVisitSchema], default: [] },
    status: {
      type: String,
      enum: ['requested', 'active', 'expiring_soon', 'expired', 'renewed', 'cancelled'],
      default: 'requested',
      index: true
    },
    amount: { type: Number, required: true }
  },
  { timestamps: true }
);

export const AMCContract = model<IAMCContract>('AMCContract', amcContractSchema);
