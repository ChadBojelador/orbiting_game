-- Additive FPS storage preserves historical freeze-tag summaries.
CREATE TABLE arena_matches (
  match_id uuid PRIMARY KEY,
  game_mode text NOT NULL CHECK (game_mode IN ('ffa', 'tdm', 'duel')),
  winner text NOT NULL,
  result_reason text NOT NULL CHECK (result_reason IN ('score-limit', 'time-limit')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  persisted_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at >= started_at)
);
CREATE TABLE arena_match_players (
  match_id uuid NOT NULL REFERENCES arena_matches(match_id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  team text NOT NULL CHECK (team IN ('none', 'ice', 'water', 'unassigned')),
  final_status text NOT NULL CHECK (final_status IN ('alive', 'dead', 'spectator')),
  kills integer NOT NULL CHECK (kills >= 0),
  deaths integer NOT NULL CHECK (deaths >= 0),
  PRIMARY KEY (match_id, player_id)
);
CREATE INDEX arena_match_players_player_id_idx ON arena_match_players(player_id);
