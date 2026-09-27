import { Request, Response } from 'express';
import { Review } from '../models/Review';
import { Product } from '../models/Product';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';

async function recalcProductRating(productId: string) {
  const approved = await Review.find({ product: productId, status: 'approved' });
  const ratingCount = approved.length;
  const ratingAverage = ratingCount ? approved.reduce((sum, r) => sum + r.rating, 0) / ratingCount : 0;
  await Product.findByIdAndUpdate(productId, { ratingAverage: Math.round(ratingAverage * 10) / 10, ratingCount });
}

export const listProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const reviews = await Review.find({ product: req.params.productId, status: 'approved' })
    .populate('user', 'name').sort({ createdAt: -1 });
  return ok(res, reviews);
});

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const { productId, rating, title, comment, images, orderId } = req.body;
  const product = await Product.findById(productId);
  if (!product) throw ApiError.notFound('Product not found');

  const review = await Review.create({
    product: productId, user: req.user!.id, order: orderId || null,
    rating, title, comment, images: images || [], status: 'pending'
  });
  return created(res, review, 'Review submitted and pending approval');
});

// ---------- Admin moderation ----------

export const adminListReviews = asyncHandler(async (req: Request, res: Response) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const reviews = await Review.find(filter).populate('user', 'name email').populate('product', 'name slug').sort({ createdAt: -1 });
  return ok(res, reviews);
});

export const adminModerateReview = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: 'approved' | 'rejected' };
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');

  review.status = status;
  await review.save();
  await recalcProductRating(review.product.toString());

  return ok(res, review, `Review ${status}`);
});
