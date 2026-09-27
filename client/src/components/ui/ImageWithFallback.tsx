import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { ImageOff, LucideIcon } from 'lucide-react';
import { Skeleton } from './Primitives';

/**
 * Drop-in replacement for a bare <img> that:
 *  - always reserves its final space via `ratio` (an aspect-ratio utility class), so nothing
 *    else on the page shifts while the image is loading or if it fails
 *  - shows a shimmer skeleton while loading
 *  - shows a clean icon + short message instead of a broken-image icon if it fails
 *  - never has a missing `src` collapse the container — a missing URL is treated the same as
 *    a failed load
 */
export function ImageWithFallback({
  src,
  alt,
  ratio = 'aspect-square',
  className,
  imgClassName,
  fallbackIcon: FallbackIcon = ImageOff,
  fallbackLabel = 'Image unavailable'
}: {
  src?: string | null;
  alt: string;
  ratio?: string;
  className?: string;
  imgClassName?: string;
  fallbackIcon?: LucideIcon;
  fallbackLabel?: string;
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');

  // Reset to a fresh loading state when the image being shown changes (e.g. switching between
  // product thumbnails) — otherwise a previously-successful <img> would keep showing while the
  // new `src` loads behind it with no skeleton at all.
  useEffect(() => {
    setStatus(src ? 'loading' : 'error');
  }, [src]);

  return (
    <div className={clsx('relative overflow-hidden bg-paper', ratio, className)}>
      {status === 'loading' && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}

      {status === 'error' ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-400">
          <FallbackIcon className="h-6 w-6" />
          {fallbackLabel && <span className="text-[11px]">{fallbackLabel}</span>}
        </div>
      ) : (
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          className={clsx('h-full w-full transition-opacity duration-200', status === 'loading' ? 'opacity-0' : 'opacity-100', imgClassName)}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
    </div>
  );
}
