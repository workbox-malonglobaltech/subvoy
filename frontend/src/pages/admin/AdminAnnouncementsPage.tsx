import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAdminNotifications } from '../../hooks/useAdminNotifications';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../lib/api';
import type { Announcement } from '../../../../src/shared/types';

interface AnnouncementsResponse {
  announcements: Announcement[];
  total: number;
}

interface AnnouncementFormData {
  title: string;
  body: string;
  channel: Announcement['channel'];
  target: Announcement['target'];
}

const EMPTY_FORM: AnnouncementFormData = {
  title: '',
  body: '',
  channel: 'in-app',
  target: 'all',
};

interface NewAnnouncementModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function NewAnnouncementModal({ onClose, onSuccess }: NewAnnouncementModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<AnnouncementFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AnnouncementFormData, string>>>({});

  function validate(): boolean {
    const e: Partial<Record<keyof AnnouncementFormData, string>> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.body.trim()) e.body = 'Body is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/admin/announcements', form);
      toast.success('Announcement sent');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send announcement');
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
      aria-labelledby="new-announcement-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h3 id="new-announcement-title" className="font-semibold text-gray-900 mb-5 text-lg">
          New Announcement
        </h3>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="ann-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="ann-title"
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                errors.title ? 'border-red-400' : 'border-gray-300'
              }`}
              placeholder="e.g. Scheduled maintenance on Saturday"
              aria-describedby={errors.title ? 'ann-title-error' : undefined}
              aria-required="true"
            />
            {errors.title && (
              <p id="ann-title-error" className="mt-1 text-xs text-red-600" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          {/* Body */}
          <div>
            <label htmlFor="ann-body" className="block text-sm font-medium text-gray-700 mb-1">
              Body <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <textarea
              id="ann-body"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={4}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${
                errors.body ? 'border-red-400' : 'border-gray-300'
              }`}
              placeholder="Announcement message…"
              aria-describedby={errors.body ? 'ann-body-error' : undefined}
              aria-required="true"
            />
            {errors.body && (
              <p id="ann-body-error" className="mt-1 text-xs text-red-600" role="alert">
                {errors.body}
              </p>
            )}
          </div>

          {/* Channel */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">Channel</legend>
            <div className="flex gap-4">
              {(['in-app', 'email', 'both'] as Announcement['channel'][]).map(ch => (
                <label key={ch} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    value={ch}
                    checked={form.channel === ch}
                    onChange={() => setForm(f => ({ ...f, channel: ch }))}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700 capitalize">{ch}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Target */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">Target</legend>
            <div className="flex gap-4">
              {(['all', 'active'] as Announcement['target'][]).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="target"
                    value={t}
                    checked={form.target === t}
                    onChange={() => setForm(f => ({ ...f, target: t }))}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {t === 'all' ? 'All users' : 'Active users'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Sending…' : 'Send announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: Announcement['channel'] }) {
  const map: Record<Announcement['channel'], string> = {
    'in-app': 'bg-blue-100 text-blue-800',
    email: 'bg-purple-100 text-purple-800',
    both: 'bg-indigo-100 text-indigo-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[channel]}`}>
      {channel}
    </span>
  );
}

export function AdminAnnouncementsPage() {
  const { unreadCount } = useAdminNotifications();
  const [modalOpen, setModalOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<AnnouncementsResponse>('/admin/announcements');
      setAnnouncements(data.announcements);
    } catch {
      // silently fail — page shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  return (
    <AdminLayout unreadCount={unreadCount}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
            <p className="text-sm text-gray-500 mt-1">Broadcast messages to users</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            + New Announcement
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Target</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Recipients</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(5)].map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="animate-pulse bg-gray-200 rounded h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : announcements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-fg-subtle text-sm">
                      No announcements yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  announcements.map(ann => (
                    <tr key={ann.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">{ann.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <ChannelBadge channel={ann.channel} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{ann.target}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {ann.recipientCount !== null ? ann.recipientCount.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                        {ann.sentAt
                          ? new Date(ann.sentAt).toLocaleDateString('en-GB', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <NewAnnouncementModal
          onClose={() => setModalOpen(false)}
          onSuccess={fetchAnnouncements}
        />
      )}
    </AdminLayout>
  );
}
