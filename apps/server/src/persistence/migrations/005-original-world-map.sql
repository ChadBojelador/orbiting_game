ALTER TABLE arena_matches DROP CONSTRAINT arena_matches_map_id_check;
ALTER TABLE arena_matches ADD CONSTRAINT arena_matches_map_id_check
  CHECK (map_id IN ('frostline', 'island', 'original'));
