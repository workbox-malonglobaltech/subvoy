import { forwardRef, useId } from 'react';
import { cn } from '../../lib/cn';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const inputBase =
  'h-10 w-full rounded-lg border bg-surface px-3 text-body-lg text-fg placeholder:text-fg-subtle ' +
  'transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 motion-reduce:transition-none';

/** Bare input (no label) — for inline/custom layouts. */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputBase, invalid ? 'border-error-600 focus:ring-error/30' : 'border-line-strong focus:border-primary', className)}
      {...props}
    />
  )
);
Input.displayName = 'Input';

/** Labelled field with hint + accessible error (aria-invalid + aria-describedby). */
export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, error, id, className, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-body font-medium text-fg">
            {label}
          </label>
        )}
        <Input id={inputId} ref={ref} invalid={!!error} aria-describedby={describedBy} className={className} {...props} />
        {error ? (
          <p id={`${inputId}-err`} className="text-caption text-error-700" role="alert">{error}</p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-caption text-fg-subtle">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Field.displayName = 'Field';
