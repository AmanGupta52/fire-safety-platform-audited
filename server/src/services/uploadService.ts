import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { detectFileType } from '../utils/fileSignature';
import { logger } from '../config/logger';
import { cloudinary } from '../config/cloudinary';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

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
 * Verifies magic bytes of the file buffer to prevent MIME-type spoofing
 * before forwarding anything to Cloudinary or writing to the local filesystem.
 */
/**
 * Stores a verified upload (Cloudinary when configured, local disk otherwise).
 *
 * `resourceType` should be 'raw' for non-image documents (PDFs, etc). Cloudinary treats
 * PDFs uploaded as 'image' specially (page rasterization) which isn't needed for documents
 * we only ever want to serve as-is — 'raw' is the correct type for those.
 */
export async function uploadBuffer(
  buffer: Buffer, folder: string, _filename: string, resourceType: 'image' | 'raw' = 'image'
): Promise<UploadResult> {
  // Magic bytes inspection: Do not trust client-supplied Content-Type header
  const detected = detectFileType(buffer);
  if (!detected) {
    throw ApiError.badRequest('File type verification failed: The uploaded file has unrecognized magic bytes or is corrupted.');
  }

  if (resourceType === 'image') {
    if (!ALLOWED_IMAGE_TYPES.includes(detected.mime)) {
      throw ApiError.badRequest(
        `Invalid file content: Client reported image, but magic bytes indicate '${detected.mime}'. Only JPEG, PNG, WEBP, and GIF images are permitted.`
      );
    }
  } else {
    const allowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];
    if (!allowed.includes(detected.mime)) {
      throw ApiError.badRequest(
        `Invalid file content: Magic bytes indicate '${detected.mime}'. Only PDF documents and standard image formats are permitted.`
      );
    }
  }

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
          if (error || !result) {
            // Cloudinary's own error (bad/expired credentials, quota, network) is logged in
            // full for diagnosis, but the client gets a clear, actionable message instead of
            // a raw provider error object or a generic 500.
            logger.error({ err: error }, '[uploadService] Cloudinary upload failed');
            return reject(ApiError.badRequest('Image upload failed — the storage provider rejected the file. Please try again in a moment.'));
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      stream.end(buffer);
    });
  }

  const dir = path.join(__dirname, '../../uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  // The stored name and extension come from the verified content, never from the client's file name: a file
  // called "x.html" that starts with PNG bytes is saved as .png and so can never be served as HTML.
  const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${detected.ext}`;
  fs.writeFileSync(path.join(dir, safeName), buffer);
  // Absolute URL (see env.publicUrl) so this renders correctly from any frontend
  // (admin, client, or a mirrored Gallery entry), not just one served from this same origin.
  return { url: `${env.publicUrl}/uploads/${folder}/${safeName}` };
}

export async function deleteUploaded(publicId?: string, resourceType: 'image' | 'raw' = 'image'): Promise<void> {
  if (!publicId || !env.cloudinary.enabled) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => undefined);
}
