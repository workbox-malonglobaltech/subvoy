import { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export interface DetectedSub {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
  nextBillingDate: string | null;
  category: string | null;
  confidence: number;
  occurrences: number;
}

interface ImapModalProps {
  onClose: () => void;
  onScanComplete: (detected: DetectedSub[], emailCount: number, message?: string) => void;
}

/** "Connect Email" (IMAP) scan dialog. Self-contained — owns its credentials state. */
export function ImapModal({ onClose, onScanComplete }: ImapModalProps) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [scanning, setScanning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setScanning(true);
    try {
      const data = await api.post<{ detected: DetectedSub[]; emailCount: number; message?: string }>(
        '/email-import/imap/scan',
        { email, password }
      );
      onScanComplete(data.detected, data.emailCount, data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect to email server');
    } finally {
      setScanning(false);
    }
  }

  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const needsAppPassword = ['gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com'].includes(domain);

  return (
    <Modal open onClose={onClose} title="Connect Email" className="max-w-md">
      <p className="text-sm text-fg-muted mb-5 -mt-3">
        Enter your email credentials. We'll scan your inbox for subscription receipts and won't store your password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-fg mb-1.5">Email address</label>
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-fg mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
              placeholder={needsAppPassword ? 'App password (16 characters)' : 'Your email password'}
              className="w-full rounded-lg border border-line-strong px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button type="button" onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-fg-subtle hover:text-fg">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {needsAppPassword && (
          <div className="bg-warning-50 border border-warning-600/20 rounded-xl p-3 text-xs text-warning-700">
            <p className="font-semibold mb-0.5">Gmail / Yahoo requires an App Password</p>
            <p>
              {domain.includes('gmail')
                ? <>Go to <strong>Google Account → Security → 2-Step Verification → App passwords</strong>, create one for "Mail", and paste the 16-character code here.</>
                : <>Go to <strong>Yahoo Account Security → Generate app password</strong> and use that code instead of your regular password.</>}
            </p>
          </div>
        )}
        <Button type="submit" loading={scanning} className="w-full">
          {scanning ? 'Scanning inbox…' : 'Scan my inbox'}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-fg-subtle">
        Your password is used only for this scan and is never stored.
      </p>
    </Modal>
  );
}
