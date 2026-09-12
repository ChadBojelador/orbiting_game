import { describe, expect, it } from 'vitest';
import { renderPixelRatio } from './render-performance.js';

describe('renderPixelRatio', () => {
  it('preserves ordinary 1x displays', () => {
    expect(renderPixelRatio(1_920, 1_080, 1)).toBe(1);
  });

  it('caps high-DPI rendering and respects the full-screen pixel budget', () => {
    expect(renderPixelRatio(1_440, 900, 2)).toBe(1.5);
    expect(renderPixelRatio(3_840, 2_160, 2)).toBeCloseTo(Math.sqrt(3_000_000 / (3_840 * 2_160)));
  });
});
