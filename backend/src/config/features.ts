/**
 * Feature flags.
 *
 * WALLET_ENABLED gates the entire money-movement layer — wallet balances/funding,
 * Paystack, autopay, and the daily charge job — which requires custody/payment
 * licensing. Defaults OFF; set FEATURE_WALLET=true per environment to enable.
 * The code stays intact so it can be re-enabled by flipping the env var.
 */
export const WALLET_ENABLED = process.env.FEATURE_WALLET === 'true';
