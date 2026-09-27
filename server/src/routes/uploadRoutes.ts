import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { requireAnyPermission } from '../middleware/rbac';
import { uploadImage, uploadDocument, uploadBuffer } from '../services/uploadService';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { created } from '../utils/apiResponse';

const router = Router();
// Any of these lets a user upload — the endpoint is shared across resource types, so we
// check for permission to manage ANY of the things it's used for rather than one fixed permission.
router.use(
  requireAuth,
  requireAnyPermission('products.update', 'products.create', 'categories.update', 'categories.create', 'blog.update', 'blog.create', 'gallery.create', 'services.update')
);

// SECURITY: :folder is attacker-controlled input that flows into a filesystem path
// (uploadService writes to `path.join(uploadsDir, folder)` when Cloudinary isn't configured)
// and into the Cloudinary folder string when it is. Without an allow-list, a value like
// `../../../../etc` would let an authenticated-but-unsanitized request traverse outside the
// intended uploads directory. Only the folders the frontend actually uses are permitted.
const ALLOWED_UPLOAD_FOLDERS = new Set(['products', 'categories', 'blog', 'gallery', 'banners', 'quotes', 'invoices', 'service-reports']);

function assertValidFolder(folder: string): string {
  if (!ALLOWED_UPLOAD_FOLDERS.has(folder)) {
    throw ApiError.badRequest('Invalid upload destination');
  }
  return folder;
}

// multer reports problems (wrong type, >5MB, no file) via a callback rather than a thrown
// error, so by default they'd skip past our validation and land in the generic 500 handler
// with a confusing message. This turns them into a normal 400 with the specific reason —
// this is most of what shows up as an unexplained "error" when uploading from a PC.
function withMulterErrorHandling(middleware: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest('That image is too large — the maximum size is 5MB.'));
      }
      if (err instanceof Error) return next(ApiError.badRequest(err.message));
      return next(err);
    });
  };
}

router.post('/image/:folder', withMulterErrorHandling(uploadImage.single('file')), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file provided');
  const folder = assertValidFolder(req.params.folder);
  const result = await uploadBuffer(req.file.buffer, folder, req.file.originalname, 'image');
  return created(res, result, 'Image uploaded');
}));

router.post('/document/:folder', withMulterErrorHandling(uploadDocument.single('file')), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file provided');
  const folder = assertValidFolder(req.params.folder);
  // Documents (PDFs, datasheets) are stored as 'raw' — see uploadService for why.
  const result = await uploadBuffer(req.file.buffer, folder, req.file.originalname, 'raw');
  return created(res, result, 'Document uploaded');
}));

export default router;
