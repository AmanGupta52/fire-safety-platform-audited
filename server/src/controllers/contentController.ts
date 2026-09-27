import { Request, Response } from 'express';
import { Banner, GalleryItem, FAQ } from '../models/Content';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ok, created } from '../utils/apiResponse';
import { mirrorGalleryImages, removeMirroredGalleryImages } from '../services/galleryMirrorService';

// ---------- Banners ----------
export const listBanners = asyncHandler(async (req: Request, res: Response) => {
  // Public storefront callers only ever see active banners. Only a logged-in staff member
  // with permission to manage banners can ask for the inactive ones too (used by the admin
  // Banners page) — without this check, ?includeInactive=true would let anyone browse
  // banners that were deliberately taken down.
  const includeInactive = req.query.includeInactive === 'true' && Boolean(req.user?.permissions.includes('gallery.read'));
  const banners = await Banner.find(includeInactive ? {} : { isActive: true }).sort({ sortOrder: 1 });
  return ok(res, banners);
});
export const adminCreateBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.create(req.body);
  void mirrorGalleryImages({ images: [banner.image], sourceType: 'banner', sourceId: banner._id, sourceLabel: banner.title });
  return created(res, banner);
});
export const adminUpdateBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!banner) throw ApiError.notFound('Banner not found');
  void mirrorGalleryImages({ images: [banner.image], sourceType: 'banner', sourceId: banner._id, sourceLabel: banner.title });
  return ok(res, banner, 'Banner updated');
});
export const adminDeleteBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (banner) void removeMirroredGalleryImages('banner', banner._id);
  return ok(res, {}, 'Banner deleted');
});

// ---------- Gallery ----------
export const listGallery = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.sourceType) filter.sourceType = req.query.sourceType;
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
