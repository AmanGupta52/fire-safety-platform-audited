import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';
import { logger } from './logger';

if (env.cloudinary.enabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true
  });
  logger.info('[cloudinary] configured');
} else {
  logger.warn('[cloudinary] not configured — file uploads will be stored locally under /uploads');
}

export { cloudinary };
