import { Request, Response } from 'express';
import { Wishlist } from '../models/Wishlist';
import { Product } from '../models/Product';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok } from '../utils/apiResponse';

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await Wishlist.findOne({ user: req.user!.id }).populate('products');
  return ok(res, wishlist?.products || []);
});

export const addToWishlist = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.body;
  const product = await Product.findById(productId);
  if (!product) throw ApiError.notFound('Product not found');

  const wishlist = await Wishlist.findOneAndUpdate(
    { user: req.user!.id },
    { $addToSet: { products: productId } },
    { upsert: true, new: true }
  ).populate('products');
  return ok(res, wishlist.products, 'Added to wishlist');
});

export const removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: req.user!.id },
    { $pull: { products: req.params.productId } },
    { new: true }
  ).populate('products');
  return ok(res, wishlist?.products || [], 'Removed from wishlist');
});
