import { Request, Response } from 'express';
import slugify from 'slugify';
import { FilterQuery } from 'mongoose';
import { Product, IProduct } from '../models/Product';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created, paginationMeta } from '../utils/apiResponse';
import { writeAuditLog } from '../services/auditService';

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);

  const filter: FilterQuery<IProduct> = { isActive: true };

  if (req.query.q) {
    filter.$text = { $search: String(req.query.q) };
  }
  // SECURITY: coerce every filter value to a plain string before it reaches the Mongo filter
  // object. Express's query parser turns `?category[$ne]=x` into an object, and an
  // unvalidated `filter.category = req.query.category` would pass that object straight
  // through as a Mongo query operator on this public, unauthenticated endpoint.
  if (req.query.category) filter.category = String(req.query.category);
  if (req.query.brand) filter.brand = String(req.query.brand);
  if (req.query.fireClass) filter.fireClass = String(req.query.fireClass);
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
  }
  if (req.query.inStock === 'true') filter.stock = { $gt: 0 };
  if (req.query.featured === 'true') filter.isFeatured = true;
  if (req.query.bestSeller === 'true') filter.isBestSeller = true;

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    newest: { createdAt: -1 },
    popularity: { ratingCount: -1 },
    featured: { isFeatured: -1, createdAt: -1 }
  };
  const sort = sortMap[String(req.query.sort)] || { createdAt: -1 };

  const [items, total] = await Promise.all([
    Product.find(filter).populate('category', 'name slug').sort(sort).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter)
  ]);

  return ok(res, items, 'Products fetched', paginationMeta(page, limit, total));
});

export const searchSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) return ok(res, []);
  const results = await Product.find(
    { $text: { $search: q }, isActive: true },
    { name: 1, slug: 1, sku: 1, images: { $slice: 1 } }
  ).limit(8);
  return ok(res, results);
});

export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate('category', 'name slug');
  if (!product) throw ApiError.notFound('Product not found');

  const related = await Product.find({
    category: product.category, _id: { $ne: product._id }, isActive: true
  }).limit(4);

  return ok(res, { product, related });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const slug = slugify(req.body.name, { lower: true, strict: true });
  const exists = await Product.findOne({ $or: [{ slug }, { sku: req.body.sku.toUpperCase() }] });
  if (exists) throw ApiError.conflict('A product with this name or SKU already exists');

  const product = await Product.create({ ...req.body, slug, sku: req.body.sku.toUpperCase() });
  await writeAuditLog(req, 'create', 'products', 'Product', product._id, null, product.toObject());
  return created(res, product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  const previous = product.toObject();

  if (req.body.name && req.body.name !== product.name) {
    req.body.slug = slugify(req.body.name, { lower: true, strict: true });
  }
  if (req.body.sku) req.body.sku = req.body.sku.toUpperCase();

  Object.assign(product, req.body);
  await product.save();

  await writeAuditLog(req, 'update', 'products', 'Product', product._id, previous, product.toObject());
  return ok(res, product, 'Product updated');
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  // Soft delete: keep historical order/invoice references intact.
  product.isActive = false;
  await product.save();
  await writeAuditLog(req, 'delete', 'products', 'Product', product._id, { isActive: true }, { isActive: false });
  return ok(res, {}, 'Product deactivated');
});

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const { delta, reason } = req.body as { delta: number; reason?: string };
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');

  const previousStock = product.stock;
  const newStock = previousStock + delta;
  if (newStock < 0) throw ApiError.badRequest('Stock cannot go negative');

  product.stock = newStock;
  await product.save();

  await writeAuditLog(req, 'stock_adjust', 'products', 'Product', product._id, { stock: previousStock }, { stock: newStock, reason });
  return ok(res, product, 'Stock updated');
});

export const lowStockProducts = asyncHandler(async (req: Request, res: Response) => {
  const threshold = Number(req.query.threshold) || 5;
  const products = await Product.find({ isActive: true, stock: { $lte: threshold } }).sort({ stock: 1 });
  return ok(res, products);
});
