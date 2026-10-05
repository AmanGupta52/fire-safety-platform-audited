import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Review } from '../models/Review';
import { Product } from '../models/Product';
import { ServiceBooking } from '../models/ServiceBooking';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { isHttpUrl } from '../services/bookingRules';

/** Rating must be a whole number from 1 to 5. Anything else is rejected instead of silently becoming 5 stars. */
function parseRating(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw ApiError.badRequest('Rating must be a whole number from 1 to 5');
  return n;
}

function parseReviewText(title: unknown, comment: unknown) {
  const body = String(comment ?? '').trim();
  if (body.length < 3) throw ApiError.badRequest('Please write a short comment');
  const heading = title === undefined || title === null ? undefined : String(title).trim().slice(0, 120) || undefined;
  return { title: heading, comment: body.slice(0, 3000) };
}

function cleanImages(images: unknown): string[] {
  return Array.isArray(images) ? images.filter(isHttpUrl).slice(0, 5) : [];
}

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

export const listServiceReviews = asyncHandler(async (req: Request, res: Response) => {
  const reviews = await Review.find({ service: req.params.serviceId, status: 'approved' })
    .populate('user', 'name').sort({ createdAt: -1 });
  return ok(res, reviews);
});

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const { productId, rating, title, comment, images, orderId } = req.body;
  if (!Types.ObjectId.isValid(String(productId))) throw ApiError.badRequest('Invalid product');
  const product = await Product.findById(productId);
  if (!product) throw ApiError.notFound('Product not found');

  const text = parseReviewText(title, comment);
  const review = await Review.create({
    product: productId, user: req.user!.id,
    order: orderId && Types.ObjectId.isValid(String(orderId)) ? orderId : null,
    rating: parseRating(rating), ...text, images: cleanImages(images), status: 'pending'
  });
  return created(res, review, 'Review submitted and pending approval');
});

// Reviews tied strictly to completed bookings only
export const createBookingReview = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId, rating, title, comment, images } = req.body;
  if (!bookingId || !Types.ObjectId.isValid(String(bookingId))) throw ApiError.badRequest('A valid booking ID is required');
  const parsedRating = parseRating(rating);
  const text = parseReviewText(title, comment);

  const booking = await ServiceBooking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Service booking not found');

  if (booking.user.toString() !== req.user!.id) {
    throw ApiError.forbidden('You can only review your own service bookings');
  }

  if (booking.status !== 'completed') {
    throw ApiError.badRequest('Reviews can only be submitted for completed services');
  }

  const existingReview = await Review.findOne({ booking: booking._id, user: req.user!.id });
  if (existingReview) {
    throw ApiError.conflict('You have already submitted a review for this service booking');
  }

  let review;
  try {
    review = await Review.create({
      booking: booking._id,
      service: booking.service || null,
      user: req.user!.id,
      rating: parsedRating,
      ...text,
      images: cleanImages(images),
      status: 'pending'
    });
  } catch (err) {
    // The unique index on (booking, user) is the real guard against two simultaneous submissions.
    if ((err as { code?: number }).code === 11000) {
      throw ApiError.conflict('You have already submitted a review for this service booking');
    }
    throw err;
  }

  return created(res, review, 'Service review submitted for moderation');
});

// ---------- Admin moderation ----------

export const adminListReviews = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type === 'service') filter.booking = { $ne: null };
  if (req.query.type === 'product') filter.product = { $ne: null };

  const reviews = await Review.find(filter)
    .populate('user', 'name email phone')
    .populate('product', 'name slug')
    .populate({
      path: 'booking',
      select: 'bookingNumber serviceType preferredDate status'
    })
    .populate('service', 'name slug')
    .sort({ createdAt: -1 });

  return ok(res, reviews);
});

export const adminModerateReview = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: 'approved' | 'rejected' };
  if (!['approved', 'rejected'].includes(status)) throw ApiError.badRequest("status must be 'approved' or 'rejected'");
  if (!Types.ObjectId.isValid(req.params.id)) throw ApiError.badRequest('Invalid review id');
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');

  review.status = status;
  await review.save();

  if (review.product) {
    await recalcProductRating(review.product.toString());
  }

  return ok(res, review, `Review ${status}`);
});
