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

// 'manual' = added directly on the Gallery page. 'product' | 'category' | 'blog' | 'banner' =
// mirrored automatically from that module whenever it saves an image (see
// galleryMirrorService) — this is what lets Gallery show every image in use across the
// site, not just photos added here, and lets the admin UI link a mirrored photo back to the
// record that uses it.
export type GallerySourceType = 'manual' | 'product' | 'category' | 'blog' | 'banner';

export interface IGalleryItem extends Document {
  _id: Types.ObjectId;
  title: string;
  category: string;
  image: string;
  description?: string;
  sourceType: GallerySourceType;
  sourceId?: Types.ObjectId;
  sourceLabel?: string;
}
const gallerySchema = new Schema<IGalleryItem>(
  {
    title: { type: String, required: true },
    category: { type: String, index: true },
    image: { type: String, required: true },
    description: { type: String },
    sourceType: { type: String, enum: ['manual', 'product', 'category', 'blog', 'banner'], default: 'manual', index: true },
    sourceId: { type: Schema.Types.ObjectId, index: true },
    sourceLabel: { type: String }
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
