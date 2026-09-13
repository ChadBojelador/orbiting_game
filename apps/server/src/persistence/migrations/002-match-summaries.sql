-- Completed match summaries only. Live room state remains in memory.
CREATE TABLE matches (
  match_id uuid PRIMARY KEY,
  winner text NOT NULL CHECK (winner IN ('ice', 'water')),
  result_reason text NOT NULL CHECK (result_reason IN ('all-frozen', 'rounds-complete')),
  final_round smallint NOT NULL CHECK (final_round BETWEEN 1 AND 5),
  max_rounds smallint NOT NULL CHECK (max_rounds = 5),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  persisted_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at >= started_at)
);

CREATE TABLE match_players (
  match_id uuid NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  player_id text NOT NULL,
  team text NOT NULL CHECK (team IN ('ice', 'water')),
  final_status text NOT NULL CHECK (final_status IN ('active', 'frozen', 'eliminated', 'spectator')),
  tags integer NOT NULL CHECK (tags >= 0),
  rescues integer NOT NULL CHECK (rescues >= 0),
  PRIMARY KEY (match_id, player_id)
);

CREATE INDEX match_players_player_id_idx ON match_players(player_id);
