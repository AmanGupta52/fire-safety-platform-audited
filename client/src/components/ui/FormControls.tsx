import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId, useState } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

interface FieldWrapProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

/**
 * Label + control + hint/error. The label is tied to the control by `id` (so clicking it focuses the field and screen
 * readers announce it), and the error/hint text is tied by `aria-describedby`.
 */
function FieldChrome({
  label, error, hint, required, controlId, children
}: FieldWrapProps & { controlId: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={controlId} className="text-xs font-medium text-slateink">
          {label} {required && <span className="text-safety" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span id={`${controlId}-hint`} className="text-xs text-slateink">{hint}</span>}
      {error && <span id={`${controlId}-error`} role="alert" className="text-xs text-safety">{error}</span>}
    </div>
  );
}

/** The id/aria props every control gets: its own id, whether it is invalid, and which message describes it. */
function controlProps(id: string, error?: string, hint?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined
  } as const;
}

const baseInputStyles =
  'w-full rounded border border-line bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-slateink/60 focus:border-ink focus:outline-none transition-colors';

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapProps {}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    return (
      <FieldChrome label={label} error={error} hint={hint} required={required} controlId={id}>
        <input ref={ref} className={clsx(baseInputStyles, error && 'border-safety', className)} {...controlProps(id, error, hint)} {...props} />
      </FieldChrome>
    );
  }
);
Input.displayName = 'Input';

// Password field with a show/hide toggle, so people can check what they've typed before
// submitting instead of finding out only after a failed login. Same look and props as Input —
// just swap the import where a password is being collected (login, register, reset password).
interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>, FieldWrapProps {}
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, hint, required, className, id: idProp, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const id = idProp ?? generatedId;
    return (
      <FieldChrome label={label} error={error} hint={hint} required={required} controlId={id}>
        <div className="relative">
          <input
            ref={ref}
            type={visible ? 'text' : 'password'}
            className={clsx(baseInputStyles, 'pr-10', error && 'border-safety', className)}
            {...controlProps(id, error, hint)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
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
  ({ label, error, hint, required, className, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    return (
      <FieldChrome label={label} error={error} hint={hint} required={required} controlId={id}>
        <textarea ref={ref} className={clsx(baseInputStyles, 'min-h-[96px] resize-y', error && 'border-safety', className)} {...controlProps(id, error, hint)} {...props} />
      </FieldChrome>
    );
  }
);
Textarea.displayName = 'Textarea';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldWrapProps {
  options: { label: string; value: string }[];
  placeholder?: string;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, required, options, placeholder, className, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    return (
      <FieldChrome label={label} error={error} hint={hint} required={required} controlId={id}>
        <select ref={ref} className={clsx(baseInputStyles, 'bg-card', error && 'border-safety', className)} {...controlProps(id, error, hint)} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </FieldChrome>
    );
  }
);
Select.displayName = 'Select';
