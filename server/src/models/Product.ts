import { Schema, model, Document, Types } from 'mongoose';

export interface IProductImage {
  url: string;
  publicId?: string;
  alt?: string;
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  sku: string;
  category: Types.ObjectId;
  subcategory?: Types.ObjectId | null;
  brand?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  discountPrice?: number;
  hsnCode?: string;
  gstPercentage: number;
  stock: number;
  minimumOrderQuantity: number;
  allowBackorder: boolean;
  unit: string;
  capacity?: string;
  weight?: string;
  fireClass?: string[];
  modelNumber?: string;
  specifications: { key: string; value: string }[];
  features: string[];
  certifications: string[];
  images: IProductImage[];
  datasheetUrl?: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  ratingAverage: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, index: true },
    hsnCode: { type: String, default: '8424', trim: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subcategory: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    brand: { type: String, trim: true, index: true },
    description: { type: String },
    shortDescription: { type: String },
    price: { type: Number, required: true, min: 0, index: true },
    discountPrice: { type: Number, min: 0 },
    gstPercentage: { type: Number, default: 18 },
    stock: { type: Number, required: true, min: 0, default: 0, index: true },
    minimumOrderQuantity: { type: Number, default: 1, min: 1 },
    allowBackorder: { type: Boolean, default: false },
    unit: { type: String, default: 'pcs' },
    capacity: { type: String },
    weight: { type: String },
    fireClass: { type: [String], default: [], index: true },
    modelNumber: { type: String },
    specifications: { type: [{ key: String, value: String }], default: [] },
    features: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    images: {
      type: [{ url: String, publicId: String, alt: String }],
      default: []
    },
    datasheetUrl: { type: String },
    isFeatured: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Compound query indexes for storefront filtering and admin sorting
productSchema.index({ isActive: 1, category: 1, createdAt: -1 });
productSchema.index({ isActive: 1, brand: 1 });
productSchema.index({ isActive: 1, fireClass: 1 });
productSchema.index({ isActive: 1, price: 1 });
productSchema.index({ isActive: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ isActive: 1, isBestSeller: 1 });
productSchema.index({ isActive: 1, stock: 1 });

// Full-text search index on product name, short description, full description, brand, and SKU
productSchema.index(
  { name: 'text', shortDescription: 'text', description: 'text', brand: 'text', sku: 'text' },
  { weights: { name: 10, sku: 5, brand: 3, shortDescription: 2, description: 1 }, name: 'product_text_search' }
);

export const Product = model<IProduct>('Product', productSchema);
