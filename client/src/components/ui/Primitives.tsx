import clsx from 'clsx';
import { LucideIcon, Star } from 'lucide-react';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-paper text-slateink border-line',
  success: 'bg-forest-light text-forest border-forest/20',
  warning: 'bg-amber-light text-amber border-amber/30',
  danger: 'bg-safety-light text-safety-dark border-safety/20',
  info: 'bg-ink/5 text-ink border-ink/10'
};
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium', badgeTones[tone])}>{children}</span>;
}

export function Card({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return <div className={clsx('rounded-card border border-line bg-card shadow-card', className)} onClick={onClick}>{children}</div>;
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <div className="rounded-full bg-paper p-3"><Icon className="h-5 w-5 text-slateink" /></div>
      <p className="heading text-base text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-slateink">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center py-20', className)}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-safety" />
    </div>
  );
}

export function StarRating({ rating, count, size = 'sm' }: { rating: number; count?: number; size?: 'sm' | 'md' }) {
  const starSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={clsx(starSize, n <= Math.round(rating) ? 'fill-amber text-amber' : 'fill-line text-line')} />
        ))}
      </div>
      {typeof count === 'number' && <span className="text-xs text-slateink">({count})</span>}
    </div>
  );
}

// Skeleton primitive for loading states — matches whatever shape you give it via className,
// so a card grid, a table row, or a text line can all use the same shimmer treatment.
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-card bg-slate-100', className)} />;
}
