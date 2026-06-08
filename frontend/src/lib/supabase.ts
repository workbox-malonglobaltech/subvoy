import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Surfaced early in dev if the env isn't configured.
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — auth will not work.');
}

/** Browser Supabase client — the single identity provider for the web app.
 *  Falls back to placeholders so createClient never throws when env is absent
 *  (tests / misconfig); real values are used whenever the env is set. */
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'anon-placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handles the OAuth (Google) redirect callback
  },
});
