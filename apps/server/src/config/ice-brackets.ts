import { MAX_PLAYERS, MIN_PLAYERS, isRecord } from '@ice-water/shared';

export interface IceBracket {
  maxPlayers: number;
  icePlayers: number;
}

// Approved initial playtest values, not a claim of competitive balance.
export const DEFAULT_ICE_BRACKETS: readonly IceBracket[] = [
  { maxPlayers: 10, icePlayers: 1 },
  { maxPlayers: 20, icePlayers: 2 },
  { maxPlayers: 35, icePlayers: 3 },
  { maxPlayers: 50, icePlayers: 5 },
  { maxPlayers: 75, icePlayers: 7 },
  { maxPlayers: 100, icePlayers: 10 },
  { maxPlayers: 125, icePlayers: 12 },
  { maxPlayers: 150, icePlayers: 15 },
];

export function parseIceBrackets(value: unknown): readonly IceBracket[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Invalid Ice-count brackets');
  let previousMax = MIN_PLAYERS - 1;
  let previousIce = 0;
  const brackets: IceBracket[] = [];
  for (const row of value as unknown[]) {
    if (!isRecord(row) || !Number.isInteger(row.maxPlayers) || !Number.isInteger(row.icePlayers))
      throw new Error('Invalid Ice-count brackets');
    const maxPlayers = row.maxPlayers as number;
    const icePlayers = row.icePlayers as number;
    if (
      maxPlayers <= previousMax ||
      maxPlayers > MAX_PLAYERS ||
      icePlayers < 1 ||
      icePlayers >= previousMax + 1 ||
      icePlayers < previousIce
    )
      throw new Error('Invalid Ice-count brackets');
    brackets.push({ maxPlayers, icePlayers });
    previousMax = maxPlayers;
    previousIce = icePlayers;
  }
  if (previousMax !== MAX_PLAYERS) throw new Error('Ice-count brackets must cover 6–150 players');
  return brackets;
}

export function iceCountFor(players: number, brackets: readonly IceBracket[]): number {
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS)
    throw new Error('Invalid player count');
  const bracket = brackets.find((row) => players <= row.maxPlayers);
  if (!bracket) throw new Error('Missing Ice-count bracket');
  return bracket.icePlayers;
}
