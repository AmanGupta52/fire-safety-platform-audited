import clsx from 'clsx';
import { LucideIcon, Star, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

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

// `transition-shadow` is on every Card by default so the many call sites that add a
// `hover:shadow-lift`/`hover:shadow-card-hover` className (product cards, order rows, blog
// cards...) get a smooth animated transition instead of an abrupt shadow swap, without each
// of them having to remember to add the transition class themselves.
export function Card({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return <div className={clsx('rounded-card border border-line bg-card shadow-card transition-shadow duration-200', className)} onClick={onClick}>{children}</div>;
}

// Empty state: content loaded successfully, there's just nothing to show. Never paired with
// an error message or a retry action — those belong to ErrorState below.
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

// Error/fallback state: a request actually failed. Distinct from EmptyState both visually
// (safety-red tone, since something went wrong) and functionally (offers "Try again" when a
// retry function is passed). `role="alert"` announces it proactively to assistive tech,
// unlike the passive `role="status"` used for loading/skeleton containers.
export function ErrorState({
  icon: Icon = AlertTriangle,
  title = 'Something went wrong',
  description = 'Please try again in a moment.',
  onRetry,
  className
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={clsx('flex flex-col items-center justify-center gap-2 py-20 text-center', className)}>
      <div className="rounded-full bg-safety-light p-3"><Icon className="h-5 w-5 text-safety" /></div>
      <p className="heading text-base text-ink">{title}</p>
      <p className="max-w-sm text-sm text-slateink">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

// Groups a cluster of Skeleton pieces under one accessible loading announcement, instead of
// tagging every individual shimmer box — a screen reader only needs to hear "Loading products"
// once per section, not once per placeholder line.
export function SkeletonGroup({ children, label = 'Loading', className }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={className}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

// One shared loading path, reused for the track and for the three animated dashes that chase
// each other around it — keeping it as a single constant means the four <path> elements
// below can't drift out of sync with each other.
const SPINNER_PATH =
  'M55.00,32.00L54.94,33.11L54.76,34.22L54.46,35.32L54.04,36.42L53.51,37.50L52.86,38.58L52.10,39.63L51.24,40.67L50.28,41.69L49.22,42.69L48.07,43.66L46.83,44.60L45.52,45.52L44.14,46.40L42.69,47.25L41.19,48.07L39.63,48.84L38.04,49.58L36.42,50.28L34.77,50.93L33.11,51.54L31.44,52.10L29.78,52.62L28.13,53.09L26.50,53.51L24.89,53.87L23.33,54.19L21.81,54.46L20.34,54.67L18.93,54.83L17.60,54.94L16.34,54.99L15.16,54.99L14.07,54.94L13.07,54.83L12.17,54.67L11.38,54.46L10.70,54.19L10.13,53.87L9.67,53.51L9.33,53.09L9.11,52.62L9.01,52.10L9.03,51.54L9.17,50.93L9.43,50.28L9.81,49.58L10.30,48.84L10.91,48.07L11.63,47.25L12.46,46.40L13.39,45.52L14.42,44.60L15.54,43.66L16.75,42.69L18.04,41.69L19.40,40.67L20.82,39.63L22.31,38.58L23.84,37.50L25.42,36.42L27.04,35.32L28.68,34.22L30.33,33.11L32.00,32.00L33.67,30.89L35.32,29.78L36.96,28.68L38.58,27.58L40.16,26.50L41.69,25.42L43.18,24.37L44.60,23.33L45.96,22.31L47.25,21.31L48.46,20.34L49.58,19.40L50.61,18.48L51.54,17.60L52.37,16.75L53.09,15.93L53.70,15.16L54.19,14.42L54.57,13.72L54.83,13.07L54.97,12.46L54.99,11.90L54.89,11.38L54.67,10.91L54.33,10.49L53.87,10.13L53.30,9.81L52.62,9.54L51.83,9.33L50.93,9.17L49.93,9.06L48.84,9.01L47.66,9.01L46.40,9.06L45.07,9.17L43.66,9.33L42.19,9.54L40.67,9.81L39.11,10.13L37.50,10.49L35.87,10.91L34.22,11.38L32.56,11.90L30.89,12.46L29.23,13.07L27.58,13.72L25.96,14.42L24.37,15.16L22.81,15.93L21.31,16.75L19.86,17.60L18.48,18.48L17.17,19.40L15.93,20.34L14.78,21.31L13.72,22.31L12.76,23.33L11.90,24.37L11.14,25.42L10.49,26.50L9.96,27.58L9.54,28.68L9.24,29.78L9.06,30.89L9.00,32.00L9.06,33.11L9.24,34.22L9.54,35.32L9.96,36.42L10.49,37.50L11.14,38.58L11.90,39.63L12.76,40.67L13.72,41.69L14.78,42.69L15.93,43.66L17.17,44.60L18.48,45.52L19.86,46.40L21.31,47.25L22.81,48.07L24.37,48.84L25.96,49.58L27.58,50.28L29.23,50.93L30.89,51.54L32.56,52.10L34.22,52.62L35.87,53.09L37.50,53.51L39.11,53.87L40.67,54.19L42.19,54.46L43.66,54.67L45.07,54.83L46.40,54.94L47.66,54.99L48.84,54.99L49.93,54.94L50.93,54.83L51.83,54.67L52.62,54.46L53.30,54.19L53.87,53.87L54.33,53.51L54.67,53.09L54.89,52.62L54.99,52.10L54.97,51.54L54.83,50.93L54.57,50.28L54.19,49.58L53.70,48.84L53.09,48.07L52.37,47.25L51.54,46.40L50.61,45.52L49.58,44.60L48.46,43.66L47.25,42.69L45.96,41.69L44.60,40.67L43.18,39.63L41.69,38.58L40.16,37.50L38.58,36.42L36.96,35.32L35.32,34.22L33.67,33.11L32.00,32.00L30.33,30.89L28.68,29.78L27.04,28.68L25.42,27.58L23.84,26.50L22.31,25.42L20.82,24.37L19.40,23.33L18.04,22.31L16.75,21.31L15.54,20.34L14.42,19.40L13.39,18.48L12.46,17.60L11.63,16.75L10.91,15.93L10.30,15.16L9.81,14.42L9.43,13.72L9.17,13.07L9.03,12.46L9.01,11.90L9.11,11.38L9.33,10.91L9.67,10.49L10.13,10.13L10.70,9.81L11.38,9.54L12.17,9.33L13.07,9.17L14.07,9.06L15.16,9.01L16.34,9.01L17.60,9.06L18.93,9.17L20.34,9.33L21.81,9.54L23.33,9.81L24.89,10.13L26.50,10.49L28.13,10.91L29.78,11.38L31.44,11.90L33.11,12.46L34.77,13.07L36.42,13.72L38.04,14.42L39.63,15.16L41.19,15.93L42.69,16.75L44.14,17.60L45.52,18.48L46.83,19.40L48.07,20.34L49.22,21.31L50.28,22.31L51.24,23.33L52.10,24.37L52.86,25.42L53.51,26.50L54.04,27.58L54.46,28.68L54.76,29.78L54.94,30.89L55.00,32.00Z';

// Site-wide loading indicator: a dashed ring that both spins and chases its own tail. The
// animation/keyframes live once in index.css (under the `.lis*` classes) rather than in a
// per-instance <style> tag, so mounting this in many places at once never duplicates the
// stylesheet or risks a global `svg { ... }` rule bleeding into unrelated icons on the page.
// `tone="light"` is for use on a dark background (e.g. inside the hero); default is for the
// light/paper backgrounds used almost everywhere else.
export function Spinner({ className, size = 40, tone = 'dark' }: { className?: string; size?: number; tone?: 'dark' | 'light' }) {
  return (
    <div className={clsx('flex items-center justify-center py-20', className)}>
      <svg
        className="lis"
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        role="img"
        aria-label="Loading"
        style={{ color: tone === 'light' ? '#f5f5f7' : '#131316' }}
      >
        <g className="lis-rig">
          <path className="lis-track" d={SPINNER_PATH} />
          <path className="lis-tail" d={SPINNER_PATH} pathLength={100} />
          <path className="lis-mid" d={SPINNER_PATH} pathLength={100} />
          <path className="lis-head" d={SPINNER_PATH} pathLength={100} />
        </g>
      </svg>
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
// so a card grid, a table row, or a text line can all use the same shimmer treatment. Uses a
// moving gradient (`.skeleton-shimmer`, defined in index.css) rather than a flat opacity pulse;
// see components/ui/Skeleton.tsx for the shaped building blocks (text lines, cards, rows) built
// on top of this.
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={clsx('skeleton-shimmer rounded-card', className)} style={style} />;
}
