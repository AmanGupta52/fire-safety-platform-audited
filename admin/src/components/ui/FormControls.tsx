import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface FieldWrapProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

function FieldChrome({ label, error, hint, required, children }: FieldWrapProps & { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-slateink">
          {label} {required && <span className="text-brand">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="text-xs text-slateink">{hint}</span>}
      {error && <span className="text-xs text-brand">{error}</span>}
    </div>
  );
}

const baseInputStyles =
  'w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slateink/60 focus:border-ink focus:outline-none transition-colors';

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapProps {}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <input
        ref={ref}
        className={clsx(baseInputStyles, error && 'border-brand', className)}
        {...props}
      />
    </FieldChrome>
  )
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldWrapProps {}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        className={clsx(baseInputStyles, 'min-h-[96px] resize-y', error && 'border-brand', className)}
        {...props}
      />
    </FieldChrome>
  )
);
Textarea.displayName = 'Textarea';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldWrapProps {
  options: { label: string; value: string }[];
  placeholder?: string;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, required, options, placeholder, className, ...props }, ref) => (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <select ref={ref} className={clsx(baseInputStyles, 'bg-white', error && 'border-brand', className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FieldChrome>
  )
);
Select.displayName = 'Select';
