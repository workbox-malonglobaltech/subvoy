import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none motion-reduce:transition-none',
  {
    variants: {
      variant: {
        primary:     'bg-primary text-primary-fg hover:bg-primary-700',
        secondary:   'bg-surface border border-line-strong text-fg hover:bg-surface-muted',
        ghost:       'text-fg-muted hover:bg-surface-muted hover:text-fg',
        destructive: 'bg-error-600 text-white hover:bg-error-700',
        link:        'text-primary underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-body',
        md: 'h-10 px-4 text-body',
        lg: 'h-12 px-5 text-body-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

/** Design-system button. Handles loading (preserves width, sets aria-busy) + all states. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
