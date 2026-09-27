import clsx from 'clsx';
import { Skeleton } from './Primitives';

/**
 * Multiple skeleton text lines with realistic, varied widths so the placeholder reads like
 * text rather than a stack of identical bars. The last line is shorter by default, matching
 * how a real paragraph or heading naturally ends.
 */
export function SkeletonText({
  lines = 3,
  className,
  lineClassName = 'h-3.5',
  lastLineWidth = '60%'
}: {
  lines?: number;
  className?: string;
  lineClassName?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={lineClassName}
          style={i === lines - 1 && lines > 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

/**
 * A fixed-ratio image placeholder — reserves the exact space the real image will occupy so
 * nothing shifts once it loads. `ratio` accepts any Tailwind aspect-ratio utility.
 */
export function SkeletonImage({ className, ratio = 'aspect-square' }: { className?: string; ratio?: string }) {
  return <Skeleton className={clsx(ratio, 'w-full rounded-card', className)} />;
}

/**
 * Mirrors ProductCard's exact shape (see components/product/ProductCard.tsx): a square image,
 * then category label / two-line title / rating / price in the same padded block — so the
 * grid doesn't jump when real cards swap in.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx('overflow-hidden rounded-card border border-line bg-card shadow-card', className)}>
      <SkeletonImage className="rounded-none rounded-t-card" />
      <div className="p-4">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-2/3" />
        <Skeleton className="mt-2.5 h-3 w-24" />
        <Skeleton className="mt-2.5 h-5 w-20" />
      </div>
    </div>
  );
}

/**
 * A grid of SkeletonCard — the common case for product/blog listings. `columns` should match
 * the real grid's column classes so the placeholder count feels intentional, not arbitrary.
 */
export function SkeletonCardGrid({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

/**
 * One row matching the "Card with a two-line left block and a badge/price on the right" shape
 * used throughout the account section (orders, invoices, quotes, service bookings).
 */
export function SkeletonRow({ className, withTrailing = true }: { className?: string; withTrailing?: boolean }) {
  return (
    <div className={clsx('flex flex-col gap-3 rounded-card border border-line bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-48" />
      </div>
      {withTrailing && (
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16 rounded-pill" />
          <Skeleton className="h-4 w-14" />
        </div>
      )}
    </div>
  );
}

export function SkeletonList({ count = 4, rowClassName, withTrailing = true }: { count?: number; rowClassName?: string; withTrailing?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonRow key={i} className={rowClassName} withTrailing={withTrailing} />)}
    </div>
  );
}

/** Matches the small stat blocks on AccountOverview / dashboards: an icon, a big number, a label. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={clsx('rounded-card border border-line bg-card p-4 shadow-card', className)}>
      <Skeleton className="h-4 w-4 rounded-sm" />
      <Skeleton className="mt-3 h-6 w-12" />
      <Skeleton className="mt-1.5 h-3 w-20" />
    </div>
  );
}
