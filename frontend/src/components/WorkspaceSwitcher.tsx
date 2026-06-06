import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * Dropdown in the nav for switching the active workspace and creating a new
 * Business workspace. Hidden until workspaces have loaded.
 */
export function WorkspaceSwitcher() {
  const { workspaces, active, switchWorkspace, createBusiness } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!active) return null;

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createBusiness(trimmed); // reloads on success
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors max-w-[180px]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className={`shrink-0 w-2 h-2 rounded-full ${active.type === 'business' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
          aria-hidden="true"
        />
        <span className="truncate">{active.name}</span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 z-40" role="menu">
          <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Workspaces</p>
          {workspaces.map(w => (
            <button
              key={w.id}
              onClick={() => { if (w.id !== active.id) switchWorkspace(w.id); else setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
              role="menuitem"
            >
              <span
                className={`shrink-0 w-2 h-2 rounded-full ${w.type === 'business' ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                aria-hidden="true"
              />
              <span className="flex-1 truncate text-gray-800">{w.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">{w.type}</span>
              {w.id === active.id && (
                <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}

          <div className="border-t border-gray-100 mt-1 pt-1">
            {creating ? (
              <div className="px-3 py-2 space-y-2">
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                  placeholder="Business name"
                  maxLength={120}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={busy || !name.trim()}
                    className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {busy ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    onClick={() => { setCreating(false); setName(''); }}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
                role="menuitem"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New business workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
