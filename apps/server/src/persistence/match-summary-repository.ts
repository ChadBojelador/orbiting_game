import type { Pool, PoolClient } from 'pg';
import type { MatchResult, PlayerStatus, Team, GameMode } from '@ice-water/shared';

export interface MatchPlayerSummary {
  playerId: string;
  team: Team;
  finalStatus: PlayerStatus;
  kills: number;
  deaths: number;
}

export interface MatchSummary {
  matchId: string;
  winner: MatchResult['winner'];
  resultReason: MatchResult['reason'];
  gameMode: GameMode;

  startedAt: Date;
  completedAt: Date;
  players: readonly MatchPlayerSummary[];
}

async function insertPlayers(client: PoolClient, summary: MatchSummary): Promise<void> {
  if (summary.players.length === 0) return;
  const values: unknown[] = [];
  const rows = summary.players.map((player, index) => {
    const offset = index * 6;
    values.push(
      summary.matchId,
      player.playerId,
      player.team,
      player.finalStatus,
      player.kills,
      player.deaths,
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
  });
  await client.query(
    `INSERT INTO arena_match_players
      (match_id, player_id, team, final_status, kills, deaths)
     VALUES ${rows.join(', ')}`,
    values,
  );
}

/** Writes the match and every player contribution atomically and idempotently. */
export async function saveMatchSummary(pool: Pool, summary: MatchSummary): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query<{ match_id: string }>(
      `INSERT INTO arena_matches
        (match_id, winner, result_reason, game_mode, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (match_id) DO NOTHING
       RETURNING match_id`,
      [
        summary.matchId,
        summary.winner,
        summary.resultReason,
        summary.gameMode,

        summary.startedAt,
        summary.completedAt,
      ],
    );
    if (inserted.rowCount === 0) {
      await client.query('COMMIT');
      return false;
    }
    await insertPlayers(client, summary);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
