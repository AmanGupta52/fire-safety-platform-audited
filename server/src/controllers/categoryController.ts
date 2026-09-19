import { Request, Response } from 'express';
import slugify from 'slugify';
import { Category } from '../models/Category';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { writeAuditLog } from '../services/auditService';

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === 'true';
  const filter = includeInactive ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
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
  return ok(res, category, 'Category updated');
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  await category.deleteOne();
  await writeAuditLog(req, 'delete', 'categories', 'Category', category._id, category.toObject(), null);
  return ok(res, {}, 'Category deleted');
});
