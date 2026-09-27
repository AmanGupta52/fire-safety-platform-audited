import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

if (env.cloudinary.enabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true
  });
  console.log('[cloudinary] configured');
} else {
  console.warn('[cloudinary] not configured — file uploads will be stored locally under /uploads in development');
}

export { cloudinary };
