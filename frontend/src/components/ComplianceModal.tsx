import { useState, useEffect, FormEvent } from 'react';
import {
  ComplianceItem,
  CreateComplianceItemInput,
  ComplianceCadence,
  WorkspaceMemberDetail,
} from '../../../src/shared/types';
import { api } from '../lib/api';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { supabase } from '../lib/supabase';

const DOCS_BUCKET = 'compliance-docs';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateComplianceItemInput) => Promise<void>;
  initial?: ComplianceItem | null;
}

const CADENCES: { value: ComplianceCadence; label: string }[] = [
  { value: 'one_off', label: 'One-off' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

function parseOffsets(input: string): number[] {
  return input
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n >= 0 && n <= 365);
}

export function ComplianceModal({ open, onClose, onSave, initial }: Props) {
  const { active } = useWorkspace();
  const [members, setMembers] = useState<WorkspaceMemberDetail[]>([]);
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [title, setTitle] = useState('');
  const [authority, setAuthority] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [cadence, setCadence] = useState<ComplianceCadence>('yearly');
  const [dueDate, setDueDate] = useState('');
  const [reminderOffsets, setReminderOffsets] = useState('30, 7, 1');
  const [penaltyNote, setPenaltyNote] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyCurrency, setPenaltyCurrency] = useState('USD');
  const [file, setFile] = useState<File | null>(null);
  const [existingDocName, setExistingDocName] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setAuthority(initial.authority ?? '');
      setReferenceNumber(initial.referenceNumber ?? '');
      setCadence(initial.cadence);
      setDueDate(initial.dueDate);
      setReminderOffsets(initial.reminderOffsets.join(', '));
      setPenaltyNote(initial.penaltyNote ?? '');
      setPenaltyAmount(initial.penaltyAmount != null ? String(initial.penaltyAmount) : '');
      setPenaltyCurrency(initial.penaltyCurrency ?? 'USD');
      setExistingDocName(initial.documentName ?? null);
      setDescription(initial.description ?? '');
      setAssigneeUserId(initial.assigneeUserId ?? '');
    } else {
      setTitle(''); setAuthority(''); setReferenceNumber('');
      setCadence('yearly'); setDueDate(''); setReminderOffsets('30, 7, 1');
      setPenaltyNote(''); setPenaltyAmount(''); setPenaltyCurrency('USD'); setExistingDocName(null); setDescription(''); setAssigneeUserId('');
    }
    setFile(null);
    setError('');
  }, [initial, open]);

  // Load workspace members for the assignee picker when the modal opens.
  useEffect(() => {
    if (!open || !active?.id) return;
    api.get<WorkspaceMemberDetail[]>(`/workspaces/${active.id}/members`)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [open, active?.id]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (!dueDate) { setError('Due date is required'); return; }
    setSaving(true);
    try {
      // Upload a newly-selected document to Supabase Storage (private bucket).
      let documentPath = initial?.documentPath ?? undefined;
      let documentName = initial?.documentName ?? undefined;
      if (file) {
        const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
        const path = `${active?.id ?? 'ws'}/${crypto.randomUUID()}${ext}`;
        const { error: upErr } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, {
          upsert: false, contentType: file.type || undefined,
        });
        if (upErr) {
          throw new Error(/bucket not found/i.test(upErr.message)
            ? 'Document storage isn’t set up yet — ask an admin to create the compliance-docs bucket.'
            : `Upload failed: ${upErr.message}`);
        }
        documentPath = path;
        documentName = file.name;
      }

      await onSave({
        title: title.trim(),
        authority: authority.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        cadence,
        dueDate,
        reminderOffsets: parseOffsets(reminderOffsets),
        penaltyNote: penaltyNote.trim() || undefined,
        penaltyAmount: penaltyAmount.trim() ? parseFloat(penaltyAmount) : null,
        penaltyCurrency: penaltyAmount.trim() ? penaltyCurrency : undefined,
        documentPath,
        documentName,
        description: description.trim() || undefined,
        assigneeUserId: assigneeUserId || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compliance-modal-title"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 id="compliance-modal-title" className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Obligation' : 'Add Compliance Obligation'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close modal">&times;</button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="c-title" className="block text-sm font-medium text-gray-700 mb-1">Obligation</label>
            <input id="c-title" required value={title} onChange={e => setTitle(e.target.value)} maxLength={255}
              placeholder="e.g. Annual return filing"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="c-authority" className="block text-sm font-medium text-gray-700 mb-1">
                Authority <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input id="c-authority" value={authority} onChange={e => setAuthority(e.target.value)} maxLength={255}
                placeholder="e.g. CAC, FIRS, IRS"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="c-ref" className="block text-sm font-medium text-gray-700 mb-1">
                Reference # <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input id="c-ref" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} maxLength={120}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label htmlFor="c-cadence" className="block text-sm font-medium text-gray-700 mb-1">Cadence</label>
              <select id="c-cadence" value={cadence} onChange={e => setCadence(e.target.value as ComplianceCadence)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {CADENCES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="c-due" className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
              <input id="c-due" required type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label htmlFor="c-offsets" className="block text-sm font-medium text-gray-700 mb-1">
              Remind me (days before) <span className="text-gray-400 font-normal">comma-separated</span>
            </label>
            <input id="c-offsets" value={reminderOffsets} onChange={e => setReminderOffsets(e.target.value)}
              placeholder="30, 7, 1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {members.length > 0 && (
            <div>
              <label htmlFor="c-assignee" className="block text-sm font-medium text-gray-700 mb-1">
                Assign to <span className="text-gray-400 font-normal">(reminders go to them)</span>
              </label>
              <select
                id="c-assignee"
                value={assigneeUserId}
                onChange={e => setAssigneeUserId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unassigned (notify creator)</option>
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.name ?? m.email}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Penalty for late filing <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <select
                value={penaltyCurrency}
                onChange={e => setPenaltyCurrency(e.target.value)}
                aria-label="Penalty currency"
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SUPPORTED_CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
              </select>
              <input
                id="c-penalty-amount"
                type="number"
                min={0}
                step="any"
                value={penaltyAmount}
                onChange={e => setPenaltyAmount(e.target.value)}
                placeholder="Amount, e.g. 50000"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <input id="c-penalty" value={penaltyNote} onChange={e => setPenaltyNote(e.target.value)} maxLength={1000}
              placeholder="Note (optional) — e.g. + ₦5,000/month after the first month"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label htmlFor="c-doc" className="block text-sm font-medium text-gray-700 mb-1">
              Document <span className="text-gray-400 font-normal">(optional — PDF or image)</span>
            </label>
            <input
              id="c-doc"
              type="file"
              accept="application/pdf,image/*"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {file ? (
              <p className="text-xs text-gray-500 mt-1">Selected: {file.name}</p>
            ) : existingDocName ? (
              <p className="text-xs text-gray-500 mt-1">Current: {existingDocName} — choose a file to replace it</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="c-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea id="c-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={2000}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Add obligation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
