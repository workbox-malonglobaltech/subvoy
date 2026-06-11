import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import { LogoMark } from '../components/LogoMark';
import type { InviteInfo } from '../../../src/shared/types';

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const { switchWorkspace } = useWorkspace();
  const toast = useToast();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    api.get<InviteInfo>(`/invites/${token}`)
      .then(setInvite)
      .catch(() => setError('This invitation could not be found.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function accept() {
    setAccepting(true);
    try {
      const { workspaceId } = await api.post<{ workspaceId: string }>(`/invites/${token}/accept`, {});
      toast.success('Invitation accepted');
      switchWorkspace(workspaceId); // persists active workspace + reloads into it
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invitation');
      setAccepting(false);
    }
  }

  const wrap = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="flex justify-center mb-5"><LogoMark linked={false} /></div>
        {children}
      </div>
    </div>
  );

  if (loading || authLoading) return wrap(<p className="text-sm text-fg-subtle">Loading invitation…</p>);
  if (error || !invite) return wrap(<p className="text-sm text-red-600">{error ?? 'Invitation not found.'}</p>);

  if (!invite.valid) {
    return wrap(
      <>
        <h1 className="text-lg font-bold text-gray-900">Invitation unavailable</h1>
        <p className="text-sm text-gray-500 mt-1">This invitation has expired or already been used.</p>
        <Link to="/" className="inline-block mt-5 text-sm font-semibold text-indigo-600 hover:text-indigo-800">Go to Subvoy →</Link>
      </>
    );
  }

  return wrap(
    <>
      <h1 className="text-lg font-bold text-gray-900">Join {invite.workspaceName}</h1>
      <p className="text-sm text-gray-500 mt-1">
        You've been invited to join <strong>{invite.workspaceName}</strong> as <strong>{invite.role}</strong>.
      </p>

      {user ? (
        user.email.toLowerCase() === invite.email.toLowerCase() ? (
          <button
            onClick={accept}
            disabled={accepting}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {accepting ? 'Joining…' : 'Accept invitation'}
          </button>
        ) : (
          <div className="mt-5 text-sm text-gray-600">
            <p>This invite is for <strong>{invite.email}</strong>, but you're signed in as {user.email}.</p>
            <p className="mt-2 text-gray-500">Sign in with {invite.email} to accept.</p>
          </div>
        )
      ) : (
        <div className="mt-6 space-y-2">
          <p className="text-sm text-gray-500">Sign in or create an account as <strong>{invite.email}</strong> to accept.</p>
          <div className="flex gap-2">
            <Link to={`/login?next=/invite/${token}`} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Log in</Link>
            <Link to={`/register?next=/invite/${token}`} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Create account</Link>
          </div>
        </div>
      )}
    </>
  );
}
