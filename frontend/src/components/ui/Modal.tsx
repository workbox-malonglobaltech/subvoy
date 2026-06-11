import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '../../lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name. Shown as the header in standard mode; visually-hidden when `bare`. */
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Override panel width/chrome (default max-w-lg). */
  className?: string;
  /** Bare mode: no header/padding chrome — the child owns the layout. Still focus-trapped + labelled. */
  bare?: boolean;
}

/**
 * Accessible modal built on Radix Dialog — focus trap, Escape-to-close, return-
 * focus, body scroll lock, aria-modal + labelled title (audit §5d). Standard mode
 * renders a title + close header; `bare` mode lets a custom child define chrome.
 */
export function Modal({ open, onClose, title, description, children, className, bare }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-gray-900/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-modal w-[calc(100%-2rem)] max-h-[calc(100vh-3rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto focus:outline-none',
            bare ? '' : 'max-w-lg rounded-2xl bg-surface p-6 shadow-modal',
            className
          )}
        >
          {bare ? (
            <>
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}
              {children}
            </>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="text-h4 text-fg">{title}</Dialog.Title>
                  {description && (
                    <Dialog.Description className="mt-1 text-body text-fg-muted">{description}</Dialog.Description>
                  )}
                </div>
                <Dialog.Close
                  className="-mr-1 rounded-lg p-1.5 text-fg-subtle hover:bg-surface-muted hover:text-fg transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Dialog.Close>
              </div>
              {children}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
