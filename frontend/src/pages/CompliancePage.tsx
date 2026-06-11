import { useState, useEffect } from 'react';
import { NavBar } from '../components/NavBar';
import { ComplianceModal } from '../components/ComplianceModal';
import { useCompliance } from '../hooks/useCompliance';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import { formatNative } from '../utils/currency';
import { supabase } from '../lib/supabase';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Button } from '../components/ui/Button';

async function openDocument(path: string) {
  const { data } = await supabase.storage.from('compliance-docs').createSignedUrl(path, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
}
import {
  ComplianceItem,
  CreateComplianceItemInput,
  ComplianceStatus,
  WorkspaceMemberDetail,
} from '../../../src/shared/types';

const STATUS_PILL: Record<ComplianceStatus, string> = {
  open: 'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86_400_000);
}

function dueLabel(item: ComplianceItem): { text: string; cls: string } {
  if (item.status === 'completed') return { text: 'Completed', cls: 'text-green-600' };
  if (item.overdue) return { text: `${Math.abs(daysUntil(item.dueDate))}d overdue`, cls: 'text-red-600' };
  const d = daysUntil(item.dueDate);
  if (d === 0) return { text: 'Due today', cls: 'text-red-600' };
  if (d <= 7) return { text: `Due in ${d}d`, cls: 'text-amber-600' };
  return { text: `Due in ${d}d`, cls: 'text-fg-subtle' };
}

export function CompliancePage() {
  const { active } = useWorkspace();
  const isBusiness = active?.type === 'business';
  const { items, loading, error, add, update, remove, setStatus, refetch } = useCompliance(isBusiness);
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ComplianceItem | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isBusiness || !active?.id) return;
    api.get<WorkspaceMemberDetail[]>(`/workspaces/${active.id}/members`)
      .then(ms => setMemberNames(Object.fromEntries(ms.map(m => [m.userId, m.name ?? m.email]))))
      .catch(() => {});
  }, [isBusiness, active?.id]);

  async function handleSave(data: CreateComplianceItemInput) {
    if (editing) {
      await update(editing.id, data);
      toast.success('Obligation updated');
    } else {
      await add(data);
      toast.success('Obligation added');
    }
  }

  async function changeStatus(item: ComplianceItem, status: ComplianceStatus) {
    try {
      await setStatus(item.id, status);
      toast.success(`Marked ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function handleDelete(item: ComplianceItem) {
    try {
      await remove(item.id);
      toast.success('Obligation removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  // Sort: overdue & open first, then by due date.
  const sorted = [...items].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        actions={isBusiness ? (
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            + Add
          </button>
        ) : undefined}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Compliance</h1>
          <p className="text-sm text-gray-500">Track filings, renewals, and regulatory deadlines.</p>
        </div>

        {!isBusiness ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-700 font-medium">Compliance lives in Business workspaces</p>
            <p className="text-sm text-gray-500 mt-1">
              Switch to (or create) a Business workspace from the switcher above to track compliance obligations.
            </p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16" role="status" aria-label="Loading compliance items">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface">
            <EmptyState
              icon={(
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              title="No obligations yet"
              description="Add your first filing or renewal deadline to start tracking compliance."
              action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ Add obligation</Button>}
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map(item => {
              const due = dueLabel(item);
              return (
                <li
                  key={item.id}
                  className={`bg-white rounded-2xl border shadow-sm p-4 ${
                    item.overdue ? 'border-l-4 border-l-red-500 border-gray-200' : 'border-gray-200'
                  } ${item.status === 'completed' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_PILL[item.status]}`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                        {item.authority && <span className="font-medium text-gray-600">{item.authority}</span>}
                        {item.referenceNumber && <span>· {item.referenceNumber}</span>}
                        <span>· {item.cadence.replace('_', '-')}</span>
                        <span className={`font-medium ${due.cls}`}>· {due.text}</span>
                        {item.assigneeUserId && memberNames[item.assigneeUserId] && (
                          <span>· 👤 {memberNames[item.assigneeUserId]}</span>
                        )}
                      </div>
                      {(item.penaltyAmount != null || item.penaltyNote) && (
                        <p className="text-xs text-red-500 mt-1">
                          Late penalty:{' '}
                          {item.penaltyAmount != null && formatNative(item.penaltyAmount, item.penaltyCurrency ?? 'USD')}
                          {item.penaltyAmount != null && item.penaltyNote ? ' — ' : ''}
                          {item.penaltyNote ?? ''}
                        </p>
                      )}
                      {item.documentPath && (
                        <button
                          onClick={() => openDocument(item.documentPath!)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1 inline-flex items-center gap-1"
                        >
                          📎 {item.documentName ?? 'View document'}
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-fg-subtle shrink-0">
                      {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                    {item.status !== 'completed' && (
                      <button onClick={() => changeStatus(item, 'completed')}
                        className="text-xs font-semibold text-green-600 hover:text-green-800 transition-colors">Mark completed</button>
                    )}
                    {item.status === 'open' && (
                      <button onClick={() => changeStatus(item, 'submitted')}
                        className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors">Mark submitted</button>
                    )}
                    {item.status !== 'open' && (
                      <button onClick={() => changeStatus(item, 'open')}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">Reopen</button>
                    )}
                    <button onClick={() => { setEditing(item); setModalOpen(true); }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Edit</button>
                    <button onClick={() => handleDelete(item)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors ml-auto">Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <ComplianceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editing}
      />
    </div>
  );
}
