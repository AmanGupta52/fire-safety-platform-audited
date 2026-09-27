import { Schema, model, Document, Types } from 'mongoose';

export interface IBlogPost extends Document {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  category?: string;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  author: Types.ObjectId;
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const blogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    excerpt: { type: String },
    content: { type: String, required: true },
    featuredImage: { type: String },
    category: { type: String, index: true },
    tags: { type: [String], default: [] },
    seoTitle: { type: String },
    seoDescription: { type: String },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isPublished: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date }
  },
  { timestamps: true }
);

export const BlogPost = model<IBlogPost>('BlogPost', blogPostSchema);
