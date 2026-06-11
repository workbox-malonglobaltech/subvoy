import { cn } from '../../lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 'raised' = border + soft shadow (primary content); 'flat' = border only (secondary). */
  variant?: 'raised' | 'flat';
  /** Adds hover elevation + pointer affordance for clickable cards. */
  interactive?: boolean;
}

/** Standard surface container. Default padding p-6 (override via className). */
export function Card({ variant = 'raised', interactive, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface p-6',
        variant === 'raised' && 'shadow-card',
        interactive && 'transition-shadow hover:shadow-pop hover:border-line-strong cursor-pointer motion-reduce:transition-none',
        className
      )}
      {...props}
    />
  );
}
