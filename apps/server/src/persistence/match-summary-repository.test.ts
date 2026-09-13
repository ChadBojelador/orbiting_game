import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { runMigrations } from './migration-runner.js';
import { saveMatchSummary, type MatchSummary } from './match-summary-repository.js';

function summary(matchId = randomUUID()): MatchSummary {
  return {
    matchId,
    winner: 'water',
    resultReason: 'rounds-complete',
    finalRound: 5,
    maxRounds: 5,
    startedAt: new Date('2026-09-13T00:00:00.000Z'),
    completedAt: new Date('2026-09-13T00:05:25.000Z'),
    players: [
      {
        playerId: randomUUID(),
        team: 'ice',
        finalStatus: 'active',
        tags: 4,
        rescues: 0,
      },
      {
        playerId: randomUUID(),
        team: 'water',
        finalStatus: 'active',
        tags: 0,
        rescues: 3,
      },
    ],
  };
}

describe.skipIf(!process.env.TEST_DATABASE_URL)('match summary repository', () => {
  it('writes a summary and its players transactionally and ignores duplicates', async () => {
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const value = summary();
    try {
      await runMigrations(pool);
      expect(await saveMatchSummary(pool, value)).toBe(true);
      expect(await saveMatchSummary(pool, value)).toBe(false);

      const matches = await pool.query('SELECT * FROM matches WHERE match_id = $1', [value.matchId]);
      const players = await pool.query(
        'SELECT player_id, team, final_status, tags, rescues FROM match_players WHERE match_id = $1 ORDER BY player_id',
        [value.matchId],
      );
      expect(matches.rowCount).toBe(1);
      expect(matches.rows[0]).toMatchObject({
        winner: value.winner,
        result_reason: value.resultReason,
        final_round: value.finalRound,
        max_rounds: value.maxRounds,
      });
      expect(players.rows).toHaveLength(value.players.length);
      expect(players.rows).toEqual(
        expect.arrayContaining(
          value.players.map((player) => ({
            player_id: player.playerId,
            team: player.team,
            final_status: player.finalStatus,
            tags: player.tags,
            rescues: player.rescues,
          })),
        ),
      );
    } finally {
      await pool.query('DELETE FROM matches WHERE match_id = $1', [value.matchId]);
      await pool.end();
    }
  });

  it('rolls back the match row when a player row is invalid', async () => {
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const original = summary();
    const value: MatchSummary = {
      ...original,
      players: [{ ...original.players[0]!, tags: -1 }, ...original.players.slice(1)],
    };
    try {
      await runMigrations(pool);
      await expect(saveMatchSummary(pool, value)).rejects.toThrow();
      const matches = await pool.query('SELECT 1 FROM matches WHERE match_id = $1', [value.matchId]);
      expect(matches.rowCount).toBe(0);
    } finally {
      await pool.end();
    }
  });
});
