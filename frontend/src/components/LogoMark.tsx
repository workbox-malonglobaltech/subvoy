/**
 * LogoMark — Subvoy branded logo mark (icon + wordmark).
 *
 * Used across all pages for consistent brand identity:
 *   - NavBar (authenticated pages)
 *   - LandingPage header
 *   - LoginPage / RegisterPage headers
 *
 * @param size  "sm" | "md" (default) | "lg"
 * @param asLink  Wrap in a <Link to="/"> (default true). Pass false for auth pages
 *                where you want the mark as a heading, not a nav link.
 */
import { Link } from 'react-router-dom';

type Size = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<Size, {
  box:  string;
  icon: string;
  text: string;
}> = {
  sm: { box: 'w-7 h-7 rounded-lg',  icon: 'w-4 h-4', text: 'text-base' },
  md: { box: 'w-8 h-8 rounded-xl',  icon: 'w-5 h-5', text: 'text-lg'   },
  lg: { box: 'w-11 h-11 rounded-2xl',icon: 'w-6 h-6', text: 'text-2xl'  },
};

function Mark({ size = 'md' }: { size?: Size }) {
  const s = SIZE_MAP[size];
  return (
    <div className="flex items-center gap-2">
      {/* Icon: circular renewal arrows — the subscription cycle */}
      <div className={`${s.box} bg-indigo-600 flex items-center justify-center shadow-sm shrink-0`}>
        <svg
          className={`${s.icon} text-white`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </div>

      {/* Wordmark: Sub (bold, dark) + voy (bold, indigo) */}
      <span className={`${s.text} font-bold tracking-tight leading-none`}>
        <span className="text-gray-900">Sub</span>
        <span className="text-indigo-600">voy</span>
      </span>
    </div>
  );
}

interface LogoMarkProps {
  size?: Size;
  /** If true (default), wraps the mark in a <Link to="/">. Set false for static use. */
  linked?: boolean;
  className?: string;
}

export function LogoMark({ size = 'md', linked = true, className = '' }: LogoMarkProps) {
  if (!linked) {
    return (
      <div className={`inline-flex ${className}`}>
        <Mark size={size} />
      </div>
    );
  }

  return (
    <Link
      to="/"
      className={`inline-flex shrink-0 ${className}`}
      aria-label="Subvoy home"
    >
      <Mark size={size} />
    </Link>
  );
}
