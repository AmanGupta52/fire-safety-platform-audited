import { useState, ImgHTMLAttributes } from 'react';
import { optimizeCloudinaryUrl } from '../../utils/imageUtils';

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  widthLimit?: number;
  heightLimit?: number;
  crop?: 'fill' | 'fit' | 'limit' | 'scale' | 'thumb';
  fallbackSrc?: string;
}

export function OptimizedImage({
  src,
  alt,
  widthLimit = 600,
  heightLimit,
  crop = 'limit',
  fallbackSrc = '/placeholder.png',
  className = '',
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const optimizedSrc = optimizeCloudinaryUrl(src, {
    width: widthLimit,
    height: heightLimit,
    crop,
    quality: 'auto',
    format: 'auto'
  }) || fallbackSrc;

  return (
    <img
      src={error ? fallbackSrc : optimizedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      className={`${className} ${loaded ? 'opacity-100' : 'opacity-70'} transition-opacity duration-200`}
      {...props}
    />
  );
}
