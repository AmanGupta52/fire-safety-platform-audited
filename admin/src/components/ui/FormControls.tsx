import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from 'react';
import clsx from 'clsx';


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
          {label} {required && <span className="text-brand" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span id={`${controlId}-hint`} className="text-xs text-slateink">{hint}</span>}
      {error && <span id={`${controlId}-error`} role="alert" className="text-xs text-brand">{error}</span>}
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
  'w-full rounded border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-slateink/60 focus:border-ink focus:outline-none transition-colors';

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapProps {}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    return (
      <FieldChrome label={label} error={error} hint={hint} required={required} controlId={id}>
        <input ref={ref} className={clsx(baseInputStyles, error && 'border-brand', className)} {...controlProps(id, error, hint)} {...props} />
      </FieldChrome>
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldWrapProps {}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, required, className, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    return (
      <FieldChrome label={label} error={error} hint={hint} required={required} controlId={id}>
        <textarea ref={ref} className={clsx(baseInputStyles, 'min-h-[96px] resize-y', error && 'border-brand', className)} {...controlProps(id, error, hint)} {...props} />
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
        <select ref={ref} className={clsx(baseInputStyles, 'bg-card', error && 'border-brand', className)} {...controlProps(id, error, hint)} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </FieldChrome>
    );
  }
);
Select.displayName = 'Select';
