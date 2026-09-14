ALTER TABLE arena_matches
  ADD COLUMN map_id text NOT NULL DEFAULT 'frostline'
  CHECK (map_id IN ('frostline', 'island'));
