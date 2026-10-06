import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useState } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

interface FieldWrapProps { label?: string; error?: string; hint?: string; required?: boolean }

function FieldChrome({ label, error, hint, required, children }: FieldWrapProps & { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slateink">{label} {required && <span className="text-safety">*</span>}</label>}
      {children}
      {hint && !error && <span className="text-xs text-slateink">{hint}</span>}
      {error && <span className="text-xs text-safety">{error}</span>}
    </div>
  );
}

const baseInputStyles =
  'w-full rounded border border-line bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-slateink/60 focus:border-ink focus:outline-none transition-colors';

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapProps {}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <input ref={ref} className={clsx(baseInputStyles, error && 'border-safety', className)} {...props} />
    </FieldChrome>
  )
);
Input.displayName = 'Input';

// Password field with a show/hide toggle, so people can check what they've typed before
// submitting instead of finding out only after a failed login. Same look and props as Input —
// just swap the import where a password is being collected (login, register, reset password).
interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>, FieldWrapProps {}
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, hint, required, className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <FieldChrome label={label} error={error} hint={hint} required={required}>
        <div className="relative">
          <input
            ref={ref}
            type={visible ? 'text' : 'password'}
            className={clsx(baseInputStyles, 'pr-10', error && 'border-safety', className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slateink transition-colors hover:text-ink"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </FieldChrome>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldWrapProps {}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <FieldChrome label={label} error={error} hint={hint} required={required}>
      <textarea ref={ref} className={clsx(baseInputStyles, 'min-h-[96px] resize-y', error && 'border-safety', className)} {...props} />
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
      <select ref={ref} className={clsx(baseInputStyles, 'bg-card', error && 'border-safety', className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </FieldChrome>
  )
);
Select.displayName = 'Select';
