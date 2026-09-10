import { describe, expect, it } from 'vitest';
import { normalizeInviteCode, sanitizeDisplayName } from './guest.js';

describe('guest input', () => {
  it('normalizes Unicode, removes markup, and collapses spaces', () => {
    expect(sanitizeDisplayName('  Ｃhad   Bojelador  ')).toBe('Chad Bojelador');
    expect(sanitizeDisplayName('<b>Snow</b>')).toBe('bSnowb');
    expect(sanitizeDisplayName('雪人')).toBe('雪人');
    expect(sanitizeDisplayName('Sam\u202E')).toBe('Sam');
  });
  it.each([null, {}, 7, '', ' ', 'a', '🎉', 'a'.repeat(21), 'a'.repeat(101)])(
    'rejects invalid names: %j',
    (name) => expect(sanitizeDisplayName(name)).toBeNull(),
  );
  it('validates normalized eight-character invite codes', () => {
    expect(normalizeInviteCode(' abcdefgh ')).toBe('ABCDEFGH');
    for (const code of ['ABCD', 'OOOOOOOO', '12345678', {}, null])
      expect(normalizeInviteCode(code)).toBeNull();
  });
});
