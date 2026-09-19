import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAnyPermission } from '../middleware/rbac';
import { uploadImage, uploadDocument, uploadBuffer } from '../services/uploadService';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { created } from '../utils/apiResponse';
import { GalleryItem } from '../models/Content';

const router = Router();
// Any of these lets a user upload — the endpoint is shared across resource types, so we
// check for permission to manage ANY of the things it's used for rather than one fixed permission.
router.use(
  requireAuth,
  requireAnyPermission('products.update', 'products.create', 'categories.update', 'categories.create', 'blog.update', 'blog.create', 'gallery.create')
);

// Folders whose images should also appear in the admin Gallery automatically, so uploads
// made while editing a product/category/post are browsable in one place afterwards.
const GALLERY_MIRRORED_FOLDERS = new Set(['products', 'categories', 'blog']);

// SECURITY: :folder is attacker-controlled input that flows into a filesystem path
// (uploadService writes to `path.join(uploadsDir, folder)` when Cloudinary isn't configured)
// and into the Cloudinary folder string when it is. Without an allow-list, a value like
// `../../../../etc` would let an authenticated-but-unsanitized request traverse outside the
// intended uploads directory. Only the folders the frontend actually uses are permitted.
const ALLOWED_UPLOAD_FOLDERS = new Set(['products', 'categories', 'blog', 'gallery', 'quotes', 'invoices']);

function assertValidFolder(folder: string): string {
  if (!ALLOWED_UPLOAD_FOLDERS.has(folder)) {
    throw ApiError.badRequest('Invalid upload destination');
  }
  return folder;
}

router.post('/image/:folder', uploadImage.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file provided');
  const folder = assertValidFolder(req.params.folder);
  const result = await uploadBuffer(req.file.buffer, folder, req.file.originalname, 'image');

  if (GALLERY_MIRRORED_FOLDERS.has(folder)) {
    GalleryItem.create({
      title: (req.body?.title as string) || req.file.originalname.replace(/\.[^.]+$/, ''),
      category: folder,
      image: result.url
    }).catch(() => undefined); // best-effort mirror — never block the upload response on this
  }

  return created(res, result, 'Image uploaded');
}));

router.post('/document/:folder', uploadDocument.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file provided');
  const folder = assertValidFolder(req.params.folder);
  // Documents (PDFs, datasheets) are stored as 'raw' — see uploadService for why.
  const result = await uploadBuffer(req.file.buffer, folder, req.file.originalname, 'raw');
  return created(res, result, 'Document uploaded');
}));

export default router;
