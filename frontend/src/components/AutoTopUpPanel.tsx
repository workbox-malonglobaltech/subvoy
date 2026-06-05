import type { WalletSettings } from '../../../src/shared/types';

interface Props {
  settings: WalletSettings;
  saving: boolean;
  onChange: (data: Partial<WalletSettings>) => void;
}

export function AutoTopUpPanel({ settings, saving, onChange }: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Auto Top-Up</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Automatically fund your USD card when balance runs low
          </p>
        </div>
        {/* Toggle */}
        <button
          role="switch"
          aria-checked={settings.autoTopupEnabled}
          onClick={() => onChange({ autoTopupEnabled: !settings.autoTopupEnabled })}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
            settings.autoTopupEnabled ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
              settings.autoTopupEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {settings.autoTopupEnabled && (
        <div className="space-y-4 pt-1 border-t border-gray-100">
          {/* Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trigger when USD balance drops below
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="1"
                max="100000"
                value={settings.thresholdUsd}
                onChange={e => onChange({ thresholdUsd: Number(e.target.value) })}
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Top-up amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount to pull from bank (NGN)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">₦</span>
              <input
                type="number"
                min="1"
                max="10000000"
                value={settings.topupNgn}
                onChange={e => onChange({ topupNgn: Number(e.target.value) })}
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Scheduled day */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Also top up on day of month
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <select
              value={settings.scheduledDay ?? ''}
              onChange={e => onChange({ scheduledDay: e.target.value ? Number(e.target.value) : null })}
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">No scheduled top-up</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>
                  {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of each month
                </option>
              ))}
            </select>
          </div>

          {saving && (
            <p className="text-xs text-indigo-600 animate-pulse">Saving…</p>
          )}
        </div>
      )}

      {/* Autopay default for new subscriptions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Autopay new subscriptions</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Pre-enable “Pay automatically” when you add a subscription
          </p>
        </div>
        <button
          role="switch"
          aria-checked={settings.autopayDefault}
          aria-label="Autopay new subscriptions by default"
          onClick={() => onChange({ autopayDefault: !settings.autopayDefault })}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
            settings.autopayDefault ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
              settings.autopayDefault ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
