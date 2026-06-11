import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badge = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-eyebrow normal-case tracking-normal font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-fg-muted',
        primary: 'bg-primary-50 text-primary-700',
        success: 'bg-success-50 text-success-700',
        warning: 'bg-warning-50 text-warning-700',
        error:   'bg-error-50 text-error-700',
        info:    'bg-info-50 text-info-700',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

/** Status pill — tint background + accessible 700 text (WCAG AA). */
export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
