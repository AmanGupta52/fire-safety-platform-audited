import { Request, Response } from 'express';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { Coupon } from '../models/Coupon';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok } from '../utils/apiResponse';
import { priceLines, applyDiscount } from '../services/pricingService';

async function buildCartSummary(userId: string) {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart) return { items: [], subtotal: 0, discount: 0, gstAmount: 0, shippingFee: 0, total: 0, couponCode: undefined };

  const lines = cart.items
    .filter((i) => i.product) // skip items whose product was deleted
    .map((i) => {
      const product = i.product as any;
      const unitPrice = product.discountPrice ?? product.price;
      return { quantity: i.quantity, unitPrice, gstPercentage: product.gstPercentage ?? 18 };
    });

  const { subtotal, gstAmount } = priceLines(lines);

  let discount = 0;
  if (cart.couponCode) {
    const coupon = await Coupon.findOne({ code: cart.couponCode, isActive: true });
    if (coupon && subtotal >= coupon.minimumOrder && coupon.startDate <= new Date() && coupon.endDate >= new Date()) {
      discount = applyDiscount(subtotal, coupon);
    }
  }

  const shippingFee = subtotal > 0 && subtotal < 2000 ? 99 : 0;
  const total = Math.round((subtotal - discount + gstAmount + shippingFee) * 100) / 100;

  return {
    items: cart.items.filter((i) => i.product),
    subtotal, discount, gstAmount, shippingFee, total, couponCode: cart.couponCode
  };
}

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const summary = await buildCartSummary(req.user!.id);
  return ok(res, summary);
});

export const addToCart = asyncHandler(async (req: Request, res: Response) => {
  const { productId, quantity } = req.body;
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw ApiError.notFound('Product not found');

  if (quantity < product.minimumOrderQuantity) {
    throw ApiError.badRequest(`Minimum order quantity for this product is ${product.minimumOrderQuantity}`);
  }
  if (!product.allowBackorder && product.stock < quantity) {
    throw ApiError.badRequest(`Only ${product.stock} unit(s) in stock`);
  }

  let cart = await Cart.findOne({ user: req.user!.id });
  if (!cart) cart = await Cart.create({ user: req.user!.id, items: [] });

  const existing = cart.items.find((i) => i.product.toString() === productId);
  if (existing) {
    const newQty = existing.quantity + quantity;
    if (!product.allowBackorder && product.stock < newQty) {
      throw ApiError.badRequest(`Only ${product.stock} unit(s) in stock`);
    }
    existing.quantity = newQty;
  } else {
    cart.items.push({ product: product._id, quantity, priceAtAdd: product.discountPrice ?? product.price });
  }

  await cart.save();
  return ok(res, await buildCartSummary(req.user!.id), 'Item added to cart');
});

export const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  const product = await Product.findById(productId);
  if (!product) throw ApiError.notFound('Product not found');
  if (!product.allowBackorder && product.stock < quantity) {
    throw ApiError.badRequest(`Only ${product.stock} unit(s) in stock`);
  }

  const cart = await Cart.findOne({ user: req.user!.id });
  if (!cart) throw ApiError.notFound('Cart not found');
  const item = cart.items.find((i) => i.product.toString() === productId);
  if (!item) throw ApiError.notFound('Item not in cart');
  item.quantity = quantity;
  await cart.save();
  return ok(res, await buildCartSummary(req.user!.id), 'Cart updated');
});

export const removeCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await Cart.findOne({ user: req.user!.id });
  if (!cart) throw ApiError.notFound('Cart not found');
  cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
  await cart.save();
  return ok(res, await buildCartSummary(req.user!.id), 'Item removed');
});

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  await Cart.findOneAndUpdate({ user: req.user!.id }, { items: [], couponCode: undefined });
  return ok(res, await buildCartSummary(req.user!.id), 'Cart cleared');
});

export const applyCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase(), isActive: true });
  if (!coupon) throw ApiError.notFound('Invalid coupon code');
  if (coupon.startDate > new Date() || coupon.endDate < new Date()) {
    throw ApiError.badRequest('This coupon is not currently valid');
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw ApiError.badRequest('This coupon has reached its usage limit');
  }

  await Cart.findOneAndUpdate({ user: req.user!.id }, { couponCode: coupon.code }, { upsert: true });
  return ok(res, await buildCartSummary(req.user!.id), 'Coupon applied');
});

export { buildCartSummary };
