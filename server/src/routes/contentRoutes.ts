import { Router } from 'express';
import * as content from '../controllers/contentController';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

export const bannerRouter = Router();
bannerRouter.get('/', content.listBanners);
bannerRouter.post('/', requireAuth, requirePermission('gallery.create'), content.adminCreateBanner);
bannerRouter.put('/:id', requireAuth, requirePermission('gallery.create'), content.adminUpdateBanner);
bannerRouter.delete('/:id', requireAuth, requirePermission('gallery.delete'), content.adminDeleteBanner);

export const galleryRouter = Router();
galleryRouter.get('/', content.listGallery);
galleryRouter.post('/', requireAuth, requirePermission('gallery.create'), content.adminCreateGalleryItem);
galleryRouter.delete('/:id', requireAuth, requirePermission('gallery.delete'), content.adminDeleteGalleryItem);

export const faqRouter = Router();
faqRouter.get('/', content.listFaqs);
faqRouter.post('/', requireAuth, requirePermission('faqs.create'), content.adminCreateFaq);
faqRouter.put('/:id', requireAuth, requirePermission('faqs.update'), content.adminUpdateFaq);
faqRouter.delete('/:id', requireAuth, requirePermission('faqs.delete'), content.adminDeleteFaq);
