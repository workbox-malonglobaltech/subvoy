import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export interface NotificationPrefs {
  emailEnabled: boolean;
  daysBefore: number;
  budgetAlertEnabled: boolean;
  budgetLimit: number | null;
}

/**
 * Fetches the user's notification / budget preferences.
 * Returns null while loading or on error — callers treat null as "prefs unknown".
 */
export function useNotificationPrefs(): NotificationPrefs | null {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    api.get<NotificationPrefs>('/notifications/preferences')
      .then(setPrefs)
      .catch(() => { /* fail silently — budget bar simply won't render */ });
  }, []);

  return prefs;
}
