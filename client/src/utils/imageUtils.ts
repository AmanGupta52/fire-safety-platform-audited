/**
 * Cloudinary image URL transformation utility
 * Injects auto format (f_auto), auto compression quality (q_auto), and responsive dimensions
 * for sized, lazy-loaded performance.
 */
export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'limit' | 'scale' | 'thumb';
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'avif';
}

export function optimizeCloudinaryUrl(
  url?: string | null,
  options: ImageOptimizationOptions = {}
): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com')) return url;

  // Don't double-transform if transformations are already present
  if (url.includes('/image/upload/f_auto') || url.includes('/image/upload/w_')) {
    return url;
  }

  const { width, height, crop = 'limit', quality = 'auto', format = 'auto' } = options;

  const transforms: string[] = [`f_${format}`, `q_${quality}`];
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (width || height) transforms.push(`c_${crop}`);

  const transformString = transforms.join(',');

  return url.replace('/image/upload/', `/image/upload/${transformString}/`);
}
