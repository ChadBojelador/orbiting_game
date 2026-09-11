import pg from 'pg';
import { loadEnvironment } from '../config/environment.js';
import { runMigrations } from './migration-runner.js';

loadEnvironment();
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running migrations');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
try {
  const applied = await runMigrations(pool);
  console.log(applied.length ? `Applied ${applied.join(', ')}` : 'Database is up to date');
} catch {
  console.error('Migration failed. Check database availability and migration integrity.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
