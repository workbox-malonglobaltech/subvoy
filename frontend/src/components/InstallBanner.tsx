import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'subvoy_install_dismissed';

/**
 * Shows a bottom banner prompting the user to install Subvoy as a PWA.
 *
 * - Appears only when the browser fires `beforeinstallprompt` (Chrome/Edge on Android + desktop)
 * - Hidden on iOS (Safari shows its own "Add to Home Screen" via the share menu)
 * - Dismissed state persisted in localStorage
 */
export function InstallBanner() {
  const [prompt, setPrompt]       = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1'
  );
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Hide once installed
  useEffect(() => {
    const handler = () => setPrompt(null);
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  if (!prompt || dismissed) return null;

  async function handleInstall() {
    if (!prompt) return;
    setInstalling(true);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'dismissed') setInstalling(false);
    setPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:pb-6"
      role="banner"
      aria-label="Install app"
    >
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 flex items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shrink-0">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="white" fillOpacity="0.2"/>
            <rect x="8" y="7" width="16" height="10" rx="2.5" fill="white" fillOpacity="0.35" transform="rotate(-6 16 12)"/>
            <rect x="7" y="12" width="16" height="10" rx="2.5" fill="white"/>
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">Add Subvoy to home screen</p>
          <p className="text-xs text-gray-500 mt-0.5">Works offline · No app store needed</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            className="text-fg-subtle hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Dismiss install prompt"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {installing ? 'Installing…' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  );
}
