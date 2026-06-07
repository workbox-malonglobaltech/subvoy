import { Pool } from 'pg'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../../../.env') })

// Managed Postgres (Supabase/Neon/etc.) requires TLS. Enable SSL in production
// or when DB_SSL=true; disable for local Postgres. rejectUnauthorized=false
// accepts the providers' managed cert chains (set DB_SSL_CA for strict verify).
const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: process.env.DB_SSL_STRICT === 'true' } : undefined,
  // Per-instance connection ceiling — keep below the provider's limit / instances.
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000),
  connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS ?? 10_000),
  // Cap runaway queries so one slow statement can't pin a connection forever.
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15_000),
})

// Surface idle-client errors instead of crashing the process silently.
pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message)
})
