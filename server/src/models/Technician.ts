import { Schema, model, Document, Types } from 'mongoose';

export interface ITechnician extends Document {
  _id: Types.ObjectId;
  user?: Types.ObjectId | null;
  name: string;
  phone: string;
  email?: string;
  employeeId: string;
  skills: string[];
  serviceArea: string[];
  profilePhoto?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const technicianSchema = new Schema<ITechnician>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    employeeId: { type: String, required: true, unique: true },
    skills: { type: [String], default: [] },
    serviceArea: { type: [String], default: [] },
    profilePhoto: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

export const Technician = model<ITechnician>('Technician', technicianSchema);
