import { Schema, model, Document, Types } from 'mongoose';

export interface IServiceImage {
  url: string;
  publicId?: string;
  alt?: string;
}

export interface IService extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  shortDescription?: string;
  description: string;
  startingPrice: number;
  priceUnit: string;
  currency: string;
  category: string;
  image?: IServiceImage;
  gallery: IServiceImage[];
  features: string[];
  inclusions: string[];
  exclusions: string[];
  estimatedDuration?: string;
  displayOrder: number;
  isActive: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  isDeleted: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const serviceImageSchema = new Schema<IServiceImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    alt: { type: String }
  },
  { _id: false }
);

const serviceSchema = new Schema<IService>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    shortDescription: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    startingPrice: { type: Number, required: true, min: 0 },
    priceUnit: { type: String, trim: true, default: '/unit' },
    currency: { type: String, trim: true, default: 'INR' },
    category: { type: String, trim: true, default: 'general', index: true },
    image: { type: serviceImageSchema },
    gallery: { type: [serviceImageSchema], default: [] },
    features: { type: [String], default: [] },
    inclusions: { type: [String], default: [] },
    exclusions: { type: [String], default: [] },
    estimatedDuration: { type: String, trim: true },
    displayOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isPublished: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// Composite indexes for fast public catalog queries & admin filtering
serviceSchema.index({ isDeleted: 1, isActive: 1, isPublished: 1, displayOrder: 1 });
serviceSchema.index({ isDeleted: 1, category: 1, isActive: 1, isPublished: 1 });
serviceSchema.index({ isDeleted: 1, isFeatured: 1, isActive: 1, isPublished: 1 });
serviceSchema.index({ createdAt: -1 });

// Service search uses escaped, case-insensitive partial matching (see serviceController): a service catalog is
// small, and partial words ("insta" -> "Installation") matter more than stemming. A text index here would never be
// used by those queries, so none is defined.

export const Service = model<IService>('Service', serviceSchema);
