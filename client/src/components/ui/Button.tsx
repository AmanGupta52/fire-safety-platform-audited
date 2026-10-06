import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'outlineLight';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

// Three core variants per the design system (primary / secondary / ghost), plus existing
// variants (danger, dark) kept so pages that already rely on them keep working, and
// `outlineLight` for a secondary-style button placed on a dark section (hero, AMC banner) —
// a dedicated variant instead of overriding `secondary`'s classes via className, which
// produced unreliable/near-invisible buttons depending on utility-class order.
const variants = {
  primary: 'bg-safety text-white hover:bg-safety-dark active:bg-safety-dark',
  secondary: 'bg-card text-ink border border-ink hover:bg-slate-50',
  ghost: 'bg-transparent text-ink hover:bg-slate-50',
  dark: 'bg-ink text-on-ink hover:bg-ink-soft',
  danger: 'bg-card text-safety border border-safety/30 hover:bg-safety-light',
  outlineLight: 'bg-transparent text-white border border-white/40 hover:bg-white/10'
};

const sizes = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2.5 gap-2',
  lg: 'text-base px-6 py-3 gap-2'
};

// motion.button gives every button in the app the same subtle press/hover feedback for free —
// a small scale-down on tap (real, physical-feeling feedback on click) and a barely-there
// lift on hover — without every call site having to opt in individually. Disabled/loading
// buttons skip both so they don't appear interactive when they aren't.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props }, ref) => {
    const isInactive = disabled || loading;
    return (
      <motion.button
        ref={ref}
        disabled={isInactive}
        whileHover={isInactive ? undefined : { y: -1 }}
        whileTap={isInactive ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={clsx(
          'inline-flex items-center justify-center rounded-btn font-medium transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-safety',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant], sizes[size], fullWidth && 'w-full', className
        )}
        {...(props as any)}
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="sr-only">Loading</span>
          </>
        ) : (
          children
        )}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
