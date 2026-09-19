import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

// Three core variants per the design system (primary / secondary / ghost), plus two
// existing variants (danger, dark) kept so pages that already rely on them keep working.
const variants = {
  primary: 'bg-safety text-white hover:bg-safety-dark active:bg-safety-dark',
  secondary: 'bg-white text-ink border border-ink hover:bg-slate-50',
  ghost: 'bg-transparent text-ink hover:bg-slate-50',
  dark: 'bg-ink text-white hover:bg-ink-soft',
  danger: 'bg-white text-safety border border-safety/30 hover:bg-safety-light'
};

const sizes = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2.5 gap-2',
  lg: 'text-base px-6 py-3 gap-2'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-btn font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-safety',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], fullWidth && 'w-full', className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="sr-only">Loading</span>
        </>
      ) : (
        children
      )}
    </button>
  )
);
Button.displayName = 'Button';
