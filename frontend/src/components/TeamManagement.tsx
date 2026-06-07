import { useState, useEffect, useCallback, FormEvent } from 'react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { WorkspaceMemberDetail, WorkspaceRole, WorkspaceInvite } from '../../../src/shared/types';

/**
 * Team management for the active Business workspace — list members, invite by
 * email, change roles, remove. Rendered only when the active workspace is a
 * Business workspace and the caller is an owner/admin.
 */
export function TeamManagement() {
  const { active } = useWorkspace();
  const toast = useToast();
  const [members, setMembers] = useState<WorkspaceMemberDetail[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<WorkspaceRole, 'owner'>>('member');
  const [adding, setAdding] = useState(false);

  const canManage = active?.role === 'owner' || active?.role === 'admin';
  const wsId = active?.id;

  const load = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    try {
      const [m, i] = await Promise.all([
        api.get<WorkspaceMemberDetail[]>(`/workspaces/${wsId}/members`),
        api.get<WorkspaceInvite[]>(`/workspaces/${wsId}/invites`).catch(() => [] as WorkspaceInvite[]),
      ]);
      setMembers(m);
      setInvites(i);
    } catch {
      /* surfaced elsewhere */
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !wsId) return;
    setAdding(true);
    try {
      await api.post(`/workspaces/${wsId}/members`, { email: trimmed, role });
      setEmail('');
      toast.success('Member added');
      await load();
    } catch (err) {
      // No account for that email → send an invitation instead.
      const msg = err instanceof Error ? err.message : '';
      if (/no subvoy account/i.test(msg)) {
        try {
          await api.post(`/workspaces/${wsId}/invites`, { email: trimmed, role });
          setEmail('');
          toast.success('Invitation sent');
          await load();
        } catch (e2) {
          toast.error(e2 instanceof Error ? e2.message : 'Failed to send invitation');
        }
      } else {
        toast.error(msg || 'Failed to add member');
      }
    } finally {
      setAdding(false);
    }
  }

  async function revokeInvite(id: string) {
    if (!wsId) return;
    try {
      await api.delete(`/workspaces/${wsId}/invites/${id}`);
      toast.success('Invitation revoked');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invitation');
    }
  }

  async function changeRole(m: WorkspaceMemberDetail, newRole: Exclude<WorkspaceRole, 'owner'>) {
    if (!wsId) return;
    try {
      await api.put(`/workspaces/${wsId}/members/${m.userId}`, { role: newRole });
      toast.success('Role updated');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    }
  }

  async function removeMember(m: WorkspaceMemberDetail) {
    if (!wsId) return;
    try {
      await api.delete(`/workspaces/${wsId}/members/${m.userId}`);
      toast.success('Member removed');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm" aria-labelledby="team-heading">
      <h2 id="team-heading" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Team</h2>
      <p className="text-xs text-gray-500 mb-4">
        Manage who can access <strong>{active?.name}</strong>. New to Subvoy? They'll get an email invitation.
      </p>

      {canManage && (
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-5">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="teammate@email.com"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Member email"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value as Exclude<WorkspaceRole, 'owner'>)}
            className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Member role"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={adding || !email.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {adding ? 'Adding…' : 'Add / invite'}
          </button>
        </form>
      )}

      {/* Pending invitations */}
      {canManage && invites.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Pending invitations</p>
          <ul className="divide-y divide-gray-100" role="list">
            {invites.map(inv => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{inv.email}</p>
                  <p className="text-xs text-gray-400">Invited as {inv.role} · pending</p>
                </div>
                <button
                  onClick={() => revokeInvite(inv.id)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors shrink-0"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <ul className="divide-y divide-gray-100" role="list">
          {members.map(m => (
            <li key={m.userId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.name ?? m.email}</p>
                {m.name && <p className="text-xs text-gray-400 truncate">{m.email}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {m.role === 'owner' || !canManage ? (
                  <span className="text-xs font-medium text-gray-500 capitalize px-2 py-1">{m.role}</span>
                ) : (
                  <>
                    <select
                      value={m.role}
                      onChange={e => changeRole(m, e.target.value as Exclude<WorkspaceRole, 'owner'>)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      aria-label={`Role for ${m.email}`}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => removeMember(m)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                      aria-label={`Remove ${m.email}`}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
