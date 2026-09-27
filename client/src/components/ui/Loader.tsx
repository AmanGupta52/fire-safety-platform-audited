import clsx from 'clsx';

type LoaderSize = 'sm' | 'md' | 'lg';
type LoaderTone = 'dark' | 'light';

// Responsive via clamp() rather than fixed per-breakpoint pixel values, per size — each step
// still scales down smoothly on small screens instead of jumping between fixed sizes.
const SIZE_VALUES: Record<LoaderSize, string> = {
  sm: 'clamp(26px, 6vw, 34px)',
  md: 'clamp(40px, 8vw, 56px)',
  lg: 'clamp(52px, 10vw, 72px)'
};

/**
 * The site's main 6-block loader — the primary indicator for page/API loading everywhere a
 * shaped skeleton isn't available. Structure and animation match the required design exactly
 * (grid of 6 blocks, staggered blink); only color, size and spacing are theme-aware.
 *
 * Communicates loading via `role="status"` + `aria-label` (and a visually-hidden text node)
 * so it doesn't rely on the animation alone, and automatically slows to a static block under
 * `prefers-reduced-motion` (handled globally in index.css).
 */
export function Loader({
  size = 'md',
  tone = 'dark',
  label = 'Loading',
  className
}: {
  size?: LoaderSize;
  tone?: LoaderTone;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={clsx('block-loader', className)}
      style={{
        ['--bl-size' as string]: SIZE_VALUES[size],
        ['--bl-color' as string]: tone === 'light' ? '#F5F6F5' : undefined
      }}
      role="status"
      aria-label={label}
    >
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Drop-in replacement for a bare full-section loading state — centers the main Loader with
 * generous, consistent padding so it can sit inside any page or panel that's waiting on data.
 * Deliberately not a fixed full-screen overlay: the surrounding header/footer/layout chrome
 * stays visible and interactive, per "avoid unnecessary full-screen loaders".
 */
export function PageLoader({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center py-20', className)}>
      <Loader size="lg" label={label} />
    </div>
  );
}
