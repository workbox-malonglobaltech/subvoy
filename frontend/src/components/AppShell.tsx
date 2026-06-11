import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { LogoMark } from './LogoMark';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { BASE_NAV_ITEMS, COMPLIANCE_ITEM, NAV_ICONS, NavItem } from './NavBar';
import { cn } from '../lib/cn';

const SIDEBAR_KEY = 'subvoy_sidebar_collapsed';

/**
 * App shell — desktop sidebar (lg+) + mobile top bar with a slide-in drawer.
 * Wraps authenticated pages; preserves all page content (pages keep their own
 * <main> + action buttons inside a page header).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const [drawer, setDrawer] = useState(false);
  const { logout } = useAuth();
  const { active } = useWorkspace();
  const { pathname } = useLocation();

  const toggle = () => setCollapsed(c => {
    const n = !c;
    try { localStorage.setItem(SIDEBAR_KEY, n ? '1' : '0'); } catch { /* ignore */ }
    return n;
  });

  const items: NavItem[] = active?.type === 'business'
    ? [...BASE_NAV_ITEMS.slice(0, 3), COMPLIANCE_ITEM, ...BASE_NAV_ITEMS.slice(3)]
    : BASE_NAV_ITEMS;

  const isActive = (to: string) =>
    to === '/' ? pathname === '/'
    : to === '/import' ? (pathname.startsWith('/import') || pathname.startsWith('/email-import'))
    : pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-surface-subtle">
      <Sidebar collapsed={collapsed} onToggle={toggle} />

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-4 backdrop-blur">
        <button onClick={() => setDrawer(true)} aria-label="Open navigation menu"
          className="-ml-2 rounded-lg p-2 text-fg-muted hover:bg-surface-muted hover:text-fg transition-colors">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <LogoMark />
        <div className="ml-auto"><NotificationBell /></div>
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-40" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-gray-900/40 animate-in fade-in-0" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface p-3 shadow-modal animate-in slide-in-from-left duration-200">
            <div className="mb-2 flex items-center justify-between">
              <LogoMark />
              <button onClick={() => setDrawer(false)} aria-label="Close menu"
                className="rounded-lg p-1.5 text-fg-subtle hover:bg-surface-muted hover:text-fg transition-colors">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-2 border-b border-line pb-2"><WorkspaceSwitcher /></div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
              {items.map(({ to, label }) => {
                const a = isActive(to);
                return (
                  <Link key={to} to={to} aria-current={a ? 'page' : undefined} onClick={() => setDrawer(false)}
                    className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      a ? 'bg-primary-50 text-primary-700' : 'text-fg-muted hover:bg-surface-muted hover:text-fg')}>
                    <svg className={cn('h-5 w-5 shrink-0', a ? 'text-primary-600' : 'text-fg-subtle')} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      {NAV_ICONS[to]}
                    </svg>
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-line pt-2">
              <button onClick={() => { setDrawer(false); logout(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-error-700 hover:bg-error-50 transition-colors">
                <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content (offset for the desktop sidebar) */}
      <div className={cn('min-h-screen', collapsed ? 'lg:pl-16' : 'lg:pl-60')}>
        {children}
      </div>
    </div>
  );
}
