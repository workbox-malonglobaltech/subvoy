import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NotificationBell } from './NotificationBell';
import { LogoMark } from './LogoMark';

interface NavBarProps {
  /** Page-specific action elements (e.g. "+ Add", "+ Fund") shown in the toolbar */
  actions?: React.ReactNode;
}

// ── Nav items (ordered by task frequency + cognitive flow) ────────────────────
//   1. Dashboard   — primary hub, always first
//   2. Analytics   — insight layer, used after Dashboard
//   3. Reports     — historical record, follows Analytics
//   4. Wallet      — financial actions, mid-list
//   5. Import      — occasional utility, near end
//   6. Settings    — admin/configuration, always last

const NAV_ITEMS = [
  { to: '/',         label: 'Dashboard' },
  { to: '/analytics',label: 'Analytics' },
  { to: '/reports',  label: 'Reports'   },
  { to: '/wallet',   label: 'Wallet'    },
  { to: '/import',   label: 'Import'    },
  { to: '/settings', label: 'Settings'  },
] as const;

// ── Icons (24×24 Heroicons outline) ──────────────────────────────────────────
const NAV_ICONS: Record<string, React.ReactNode> = {
  '/': (
    // Home / Dashboard
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  ),
  '/analytics': (
    // Bar chart — trending data
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  ),
  '/reports': (
    // Clipboard-check — payment records
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  ),
  '/wallet': (
    // Credit card — financial balance
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  ),
  '/import': (
    // Document-arrow-down — import/ingest data
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  ),
  '/settings': (
    // Cog — configuration
    <>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </>
  ),
};

// ── Component ─────────────────────────────────────────────────────────────────

export function NavBar({ actions }: NavBarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  /** Returns true if the nav item should be highlighted */
  function isActive(to: string): boolean {
    if (to === '/') return pathname === '/';
    if (to === '/import') return pathname.startsWith('/import') || pathname.startsWith('/email-import');
    return pathname.startsWith(to);
  }

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-200">
      {/* ── Main toolbar ───────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">

        {/* Branded logo mark */}
        <LogoMark className="mr-2" />

        {/* Desktop nav pills — icon + label */}
        <nav className="hidden sm:flex items-center gap-0.5" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <svg
                  className={`w-4 h-4 shrink-0 ${active ? 'text-indigo-600' : 'text-gray-400'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  {NAV_ICONS[to]}
                </svg>
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Page-specific actions (+ Add, + Fund, Export CSV…) */}
          {actions}

          <NotificationBell />

          {/* User name — desktop only */}
          <Link
            to="/settings"
            className="text-sm text-gray-500 hover:text-gray-700 hidden md:block transition-colors truncate max-w-[120px]"
          >
            {user?.name ?? user?.email}
          </Link>

          {/* Sign out — desktop only */}
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors hidden sm:block"
          >
            Sign out
          </button>

          {/* Hamburger — mobile only */}
          <button
            className="sm:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown ─────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="sm:hidden bg-white border-t border-gray-100 px-4 py-2 space-y-0.5" role="menu">
          {NAV_ITEMS.map(({ to, label }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setMenuOpen(false)}
                role="menuitem"
              >
                <svg
                  className={`w-4 h-4 shrink-0 ${active ? 'text-indigo-600' : 'text-gray-400'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  {NAV_ICONS[to]}
                </svg>
                {label}
              </Link>
            );
          })}

          <div className="border-t border-gray-100 pt-1 mt-1 space-y-0.5">
            {/* User identity */}
            <Link
              to="/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50"
              onClick={() => setMenuOpen(false)}
              role="menuitem"
            >
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {user?.name ?? user?.email}
            </Link>

            {/* Sign out */}
            <button
              onClick={() => { setMenuOpen(false); logout(); }}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              role="menuitem"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
