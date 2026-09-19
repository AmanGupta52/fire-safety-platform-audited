import { Request, Response } from 'express';
import { Banner, GalleryItem, FAQ } from '../models/Content';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';

// ---------- Banners ----------
export const listBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await Banner.find({ isActive: true }).sort({ sortOrder: 1 });
  return ok(res, banners);
});
export const adminCreateBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.create(req.body);
  return created(res, banner);
});
export const adminUpdateBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!banner) throw ApiError.notFound('Banner not found');
  return ok(res, banner, 'Banner updated');
});
export const adminDeleteBanner = asyncHandler(async (req: Request, res: Response) => {
  await Banner.findByIdAndDelete(req.params.id);
  return ok(res, {}, 'Banner deleted');
});

// ---------- Gallery ----------
export const listGallery = asyncHandler(async (req: Request, res: Response) => {
  const filter = req.query.category ? { category: req.query.category } : {};
  const items = await GalleryItem.find(filter).sort({ createdAt: -1 });
  return ok(res, items);
});
export const adminCreateGalleryItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await GalleryItem.create(req.body);
  return created(res, item);
});
export const adminDeleteGalleryItem = asyncHandler(async (req: Request, res: Response) => {
  await GalleryItem.findByIdAndDelete(req.params.id);
  return ok(res, {}, 'Gallery item deleted');
});

// ---------- FAQ ----------
export const listFaqs = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { isActive: true };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.q) filter.question = { $regex: String(req.query.q), $options: 'i' };
  const faqs = await FAQ.find(filter).sort({ sortOrder: 1 });
  return ok(res, faqs);
});
export const adminCreateFaq = asyncHandler(async (req: Request, res: Response) => {
  const faq = await FAQ.create(req.body);
  return created(res, faq);
});
export const adminUpdateFaq = asyncHandler(async (req: Request, res: Response) => {
  const faq = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!faq) throw ApiError.notFound('FAQ not found');
  return ok(res, faq, 'FAQ updated');
});
export const adminDeleteFaq = asyncHandler(async (req: Request, res: Response) => {
  await FAQ.findByIdAndDelete(req.params.id);
  return ok(res, {}, 'FAQ deleted');
});
