import { Schema, model, Document, Types } from 'mongoose';

// Grouping smaller content models in one file to keep the codebase easy to navigate.

export interface IBanner extends Document {
  _id: Types.ObjectId;
  title: string;
  image: string;
  linkUrl?: string;
  sortOrder: number;
  isActive: boolean;
}
const bannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true },
    image: { type: String, required: true },
    linkUrl: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);
export const Banner = model<IBanner>('Banner', bannerSchema);

export interface IGalleryItem extends Document {
  _id: Types.ObjectId;
  title: string;
  category: string;
  image: string;
  description?: string;
}
const gallerySchema = new Schema<IGalleryItem>(
  {
    title: { type: String, required: true },
    category: { type: String, index: true },
    image: { type: String, required: true },
    description: { type: String }
  },
  { timestamps: true }
);
export const GalleryItem = model<IGalleryItem>('GalleryItem', gallerySchema);

export interface IFAQ extends Document {
  _id: Types.ObjectId;
  question: string;
  answer: string;
  category?: string;
  sortOrder: number;
  isActive: boolean;
}
const faqSchema = new Schema<IFAQ>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, index: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);
export const FAQ = model<IFAQ>('FAQ', faqSchema);
