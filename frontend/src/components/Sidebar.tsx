import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { LogoMark } from './LogoMark';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { BASE_NAV_ITEMS, COMPLIANCE_ITEM, NAV_ICONS, NavItem } from './NavBar';
import { WALLET_ENABLED } from '../lib/features';
import { cn } from '../lib/cn';

function isActive(to: string, pathname: string): boolean {
  if (to === '/') return pathname === '/';
  if (to === '/import') return pathname.startsWith('/import') || pathname.startsWith('/email-import');
  return pathname.startsWith(to);
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Desktop sidebar (lg+). Collapsible to an icon rail; active state per item. */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const { active } = useWorkspace();
  const { pathname } = useLocation();

  const items: NavItem[] = (active?.type === 'business'
    ? [...BASE_NAV_ITEMS.slice(0, 3), COMPLIANCE_ITEM, ...BASE_NAV_ITEMS.slice(3)]
    : BASE_NAV_ITEMS
  ).filter(i => WALLET_ENABLED || i.to !== '/wallet');

  return (
    <aside
      className={cn(
        'hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-line bg-surface transition-[width] duration-200 motion-reduce:transition-none',
        collapsed ? 'w-16' : 'w-60'
      )}
      aria-label="Sidebar"
    >
      {/* Brand + collapse toggle */}
      <div className="flex h-14 items-center gap-2 border-b border-line px-3">
        {!collapsed && <LogoMark />}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn('rounded-lg p-1.5 text-fg-subtle hover:bg-surface-muted hover:text-fg transition-colors', collapsed ? 'mx-auto' : 'ml-auto')}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7M19 19l-7-7 7-7'} />
          </svg>
        </button>
      </div>

      {/* Workspace switcher (full mode only) */}
      {!collapsed && (
        <div className="border-b border-line px-2 py-2">
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        {items.map(({ to, label }) => {
          const activeItem = isActive(to, pathname);
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              aria-current={activeItem ? 'page' : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeItem ? 'bg-primary-50 text-primary-700' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                collapsed && 'justify-center px-0'
              )}
            >
              <svg className={cn('h-5 w-5 shrink-0', activeItem ? 'text-primary-600' : 'text-fg-subtle')}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {NAV_ICONS[to]}
              </svg>
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="border-t border-line p-2">
        <Link
          to="/settings"
          title={collapsed ? (user?.name ?? user?.email ?? 'Account') : undefined}
          className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg-muted hover:bg-surface-muted hover:text-fg transition-colors', collapsed && 'justify-center px-0')}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
            {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
          </span>
          {!collapsed && <span className="truncate">{user?.name ?? user?.email}</span>}
        </Link>
        <button
          onClick={logout}
          title={collapsed ? 'Sign out' : undefined}
          className={cn('mt-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-fg-subtle hover:bg-surface-muted hover:text-fg transition-colors', collapsed && 'justify-center px-0')}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
