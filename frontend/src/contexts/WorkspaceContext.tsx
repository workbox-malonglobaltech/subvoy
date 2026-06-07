import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api, ACTIVE_WORKSPACE_KEY } from '../lib/api';
import { Workspace } from '../../../src/shared/types';
import { useAuth } from './AuthContext';

interface WorkspaceContextValue {
  workspaces: Workspace[];
  active: Workspace | null;
  loading: boolean;
  /** Switch the active workspace and reload so all scoped data refetches. */
  switchWorkspace: (id: string) => void;
  /** Create a Business workspace and switch into it. */
  createBusiness: (name: string, country?: string) => Promise<Workspace>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readActiveId(): string | null {
  try { return localStorage.getItem(ACTIVE_WORKSPACE_KEY); } catch { return null; }
}
function writeActiveId(id: string): void {
  try { localStorage.setItem(ACTIVE_WORKSPACE_KEY, id); } catch { /* ignore */ }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(readActiveId());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const list = await api.get<Workspace[]>('/workspaces');
    setWorkspaces(list);
    // Keep the stored active id if it's still valid; otherwise default to the
    // Personal workspace (or the first available).
    setActiveId(prev => {
      const valid = prev && list.some(w => w.id === prev)
        ? prev
        : (list.find(w => w.type === 'personal') ?? list[0])?.id ?? null;
      if (valid) writeActiveId(valid);
      return valid;
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    load().catch(() => { /* leave empty; api errors surface elsewhere */ }).finally(() => setLoading(false));
  }, [user, load]);

  const switchWorkspace = useCallback((id: string) => {
    writeActiveId(id);
    // Full reload is the simplest correct refresh — every workspace-scoped hook
    // refetches with the new X-Workspace-Id header. (Can be optimised later.)
    window.location.reload();
  }, []);

  const createBusiness = useCallback(async (name: string, country?: string) => {
    const ws = await api.post<Workspace>('/workspaces', country ? { name, country } : { name });
    writeActiveId(ws.id);
    window.location.reload();
    return ws;
  }, []);

  const active = workspaces.find(w => w.id === activeId) ?? null;

  return (
    <WorkspaceContext.Provider value={{ workspaces, active, loading, switchWorkspace, createBusiness }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
