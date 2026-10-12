import { Request, Response } from 'express';
import slugify from 'slugify';
import { Category } from '../models/Category';
import { asyncHandler } from '../utils/asyncHandler';
import { publicCache, setPublicCacheHeader, cacheKey, PUBLIC_TTL_MS } from '../utils/ttlCache';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { writeAuditLog } from '../services/auditService';
import { mirrorGalleryImages, removeMirroredGalleryImages } from '../services/galleryMirrorService';

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  // Same reasoning as products' listProducts: only an authenticated staff member with
  // categories.read may see inactive categories — previously this checked only the query
  // string, so any public visitor could pass ?includeInactive=true to see categories that
  // had been deliberately hidden.
  const includeInactive = req.query.includeInactive === 'true' && Boolean(req.user?.permissions.includes('categories.read'));
  const filter = includeInactive ? {} : { isActive: true };

  // Staff asking for inactive categories get a fresh, uncached, non-public response.
  if (includeInactive) {
    return ok(res, await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean());
  }
  // The public list is the same for every visitor, so it is cached (key includes the query string).
  const categories = await publicCache.wrap(cacheKey('categories', req), PUBLIC_TTL_MS, async () =>
    Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean()
  );
  setPublicCacheHeader(res);
  return ok(res, categories);
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true });
  if (!category) throw ApiError.notFound('Category not found');
  return ok(res, category);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const slug = slugify(req.body.name, { lower: true, strict: true });
  const exists = await Category.findOne({ slug });
  if (exists) throw ApiError.conflict('A category with this name already exists');

  const category = await Category.create({ ...req.body, slug });
  await writeAuditLog(req, 'create', 'categories', 'Category', category._id, null, category.toObject());
  void mirrorGalleryImages({ images: [category.image], sourceType: 'category', sourceId: category._id, sourceLabel: category.name });
  publicCache.deleteByPrefix('categories:');
  return created(res, category);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  const previous = category.toObject();

  if (req.body.name && req.body.name !== category.name) {
    req.body.slug = slugify(req.body.name, { lower: true, strict: true });
  }
  Object.assign(category, req.body);
  await category.save();

  await writeAuditLog(req, 'update', 'categories', 'Category', category._id, previous, category.toObject());
  void mirrorGalleryImages({ images: [category.image], sourceType: 'category', sourceId: category._id, sourceLabel: category.name });
  publicCache.deleteByPrefix('categories:');
  return ok(res, category, 'Category updated');
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  await category.deleteOne();
  await writeAuditLog(req, 'delete', 'categories', 'Category', category._id, category.toObject(), null);
  void removeMirroredGalleryImages('category', category._id);
  publicCache.deleteByPrefix('categories:');
  return ok(res, {}, 'Category deleted');
});
