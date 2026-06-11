import { cn } from '../../lib/cn';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  /** When provided, shows a "Try again" button. */
  onRetry?: () => void;
  className?: string;
}

/** Design-system error state with an optional retry action (audit: recovery). */
export function ErrorState({ title = 'Something went wrong', message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-error-50 text-error-600">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h3 className="text-h4 text-fg">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-body text-fg-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
