import { Schema, model, Document, Types } from 'mongoose';

export interface IReview extends Document {
  _id: Types.ObjectId;
  product?: Types.ObjectId | null;
  service?: Types.ObjectId | null;
  booking?: Types.ObjectId | null;
  user: Types.ObjectId;
  order?: Types.ObjectId | null;
  rating: number;
  title?: string;
  comment: string;
  images: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service', default: null, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'ServiceBooking', default: null, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String },
    comment: { type: String, required: true },
    images: { type: [String], default: [] },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true }
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ service: 1, status: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });
// One review per booking per customer, enforced by the database. Partial so ordinary product reviews (which have
// no booking) are not affected.
reviewSchema.index({ booking: 1, user: 1 }, { unique: true, partialFilterExpression: { booking: { $type: 'objectId' } } });

export const Review = model<IReview>('Review', reviewSchema);
