/**
 * Feature flags (build-time, via Vite env).
 *
 * WALLET_ENABLED gates the wallet (balances/funding) + autopay UI. It must mirror
 * the backend FEATURE_WALLET flag. Defaults OFF; set VITE_FEATURE_WALLET=true per
 * environment to enable. Code is preserved so it can be re-enabled by flipping the
 * env var — no deletion.
 */
export const WALLET_ENABLED = import.meta.env.VITE_FEATURE_WALLET === 'true';
