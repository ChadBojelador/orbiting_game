import { expect, it } from 'vitest';
import pg from 'pg';
import { runMigrations } from './migration-runner.js';

it.skipIf(!process.env.TEST_DATABASE_URL)(
  'applies PostgreSQL migrations idempotently and stores their checksums',
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      await runMigrations(pool);
      expect(await runMigrations(pool)).toEqual([]);
      const result = await pool.query<{ name: string; checksum: string }>(
        'SELECT name, checksum FROM schema_migrations',
      );
      expect(result.rows).toContainEqual({
        name: '001-foundation.sql',
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      const columns = await pool.query<{ data_type: string }>(
        "SELECT data_type FROM information_schema.columns WHERE table_name = 'service_metadata' AND column_name = 'created_at'",
      );
      expect(columns.rows[0]?.data_type).toBe('timestamp with time zone');
    } finally {
      await pool.end();
    }
  },
);
