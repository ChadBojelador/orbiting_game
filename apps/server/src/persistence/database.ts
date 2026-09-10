import pg from 'pg';

export interface Database {
  isReady(): Promise<boolean>;
  close(): Promise<void>;
}

export function createDatabase(connectionString?: string): Database {
  const pool = connectionString
    ? new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 2000, query_timeout: 2000 })
    : undefined;
  pool?.on('error', () => {
    console.error(JSON.stringify({ event: 'database/connection-error' }));
  });
  return {
    async isReady() {
      if (!pool) return false;
      try {
        await pool.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
    async close() {
      await pool?.end();
    },
  };
}
