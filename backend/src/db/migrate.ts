import fs from 'fs';
import path from 'path';
import { pool } from './index';

async function migrate(): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const { rows } = await client.query('SELECT id FROM migrations WHERE filename = $1', [file]);
      if (rows.length > 0) {
        console.log(`Skipping ${file} (already run)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Ran migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('All migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
