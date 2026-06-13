import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/cn';

interface Option { value: string; label: string }

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  /** Prefix shown before the current label, e.g. "Sort:". */
  label?: string;
  align?: 'left' | 'right';
}

/** Lightweight styled dropdown (consistent across OSes, unlike a native select). */
export function SelectMenu({ value, onChange, options, label, align = 'right' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  const current = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-muted"
      >
        {label && <span className="text-fg-subtle">{label}</span>}
        {current?.label ?? 'Select'}
        <svg className="h-3.5 w-3.5 text-fg-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute z-40 mt-1 min-w-[11rem] rounded-xl border border-line bg-surface p-1 shadow-pop animate-in fade-in-0 zoom-in-95 duration-150',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {options.map(o => (
            <button
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                o.value === value ? 'bg-primary-50 font-medium text-primary-700' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
              )}
            >
              {o.label}
              {o.value === value && (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
