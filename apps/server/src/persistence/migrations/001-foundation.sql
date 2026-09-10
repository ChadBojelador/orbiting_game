-- Durable metadata only. Live rooms and guest tokens remain in memory.
CREATE TABLE IF NOT EXISTS service_metadata (
  id uuid PRIMARY KEY,
  service_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
