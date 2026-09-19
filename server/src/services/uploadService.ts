import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { cloudinary } from '../config/cloudinary';
import { env } from '../config/env';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOC_TYPES = ['application/pdf'];
const MAX_FILE_SIZE_MB = 5;

const storage = multer.memoryStorage();

export const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP and GIF images are allowed'));
    }
    cb(null, true);
  }
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (![...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES].includes(file.mimetype)) {
      return cb(new Error('Only images and PDF documents are allowed'));
    }
    cb(null, true);
  }
});

export interface UploadResult {
  url: string;
  publicId?: string;
}

/**
 * Uploads a buffer to Cloudinary when configured; otherwise writes to local /uploads
 * so development works without any paid/external storage account.
 *
 * `resourceType` should be 'raw' for non-image documents (PDFs, etc). Cloudinary treats
 * PDFs uploaded as 'image' specially (page rasterization) which isn't needed for documents
 * we only ever want to serve as-is — 'raw' is the correct type for those.
 */
export async function uploadBuffer(
  buffer: Buffer, folder: string, filename: string, resourceType: 'image' | 'raw' = 'image'
): Promise<UploadResult> {
  // Defense in depth: callers should already restrict `folder` to a known allow-list (see
  // uploadRoutes.ts), but this function writes to the filesystem, so it never trusts a caller
  // to have done that — strip anything that isn't a simple path segment before it can reach
  // path.join/Cloudinary's folder string.
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeFolder) throw new Error('Invalid upload folder');
  folder = safeFolder;

  if (env.cloudinary.enabled) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `fire-safety/${folder}`, resource_type: resourceType },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      stream.end(buffer);
    });
  }

  const dir = path.join(__dirname, '../../uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  fs.writeFileSync(path.join(dir, safeName), buffer);
  return { url: `/uploads/${folder}/${safeName}` };
}

export async function deleteUploaded(publicId?: string, resourceType: 'image' | 'raw' = 'image'): Promise<void> {
  if (!publicId || !env.cloudinary.enabled) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => undefined);
}
