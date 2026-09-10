import { INVITE_ALPHABET, INVITE_LENGTH } from '../protocol/lobby.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 100) return null;
  const name = value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} _'-]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  const length = [...name].length;
  return length >= 2 && length <= 20 ? name : null;
}

export function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 32) return null;
  const code = value.trim().toUpperCase();
  return code.length === INVITE_LENGTH &&
    [...code].every((character) => INVITE_ALPHABET.includes(character))
    ? code
    : null;
}

export function isEmptyPayload(value: unknown): value is Record<string, never> {
  return isRecord(value) && Object.keys(value).length === 0;
}
