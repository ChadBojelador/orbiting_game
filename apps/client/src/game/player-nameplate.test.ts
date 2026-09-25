import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerNameplate, disposePlayerNameplate } from './player-nameplate.js';

describe('player nameplate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws compact outlined text without a background container', () => {
    const context = {
      fillRect: vi.fn(),
      roundRect: vi.fn(),
      strokeRect: vi.fn(),
      measureText: vi.fn(() => ({ width: 120 })),
      strokeText: vi.fn(),
      fillText: vi.fn(),
      textAlign: '',
      textBaseline: '',
      font: '',
      lineJoin: '',
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    };
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });

    const nameplate = createPlayerNameplate('Frost Runner');

    expect(context.font).toContain('300 16px');
    expect(context.lineWidth).toBe(2);
    expect(context.fillRect).not.toHaveBeenCalled();
    expect(context.roundRect).not.toHaveBeenCalled();
    expect(context.strokeRect).not.toHaveBeenCalled();
    expect(context.strokeText).toHaveBeenCalledWith('Frost Runner', 128, 32);
    expect(context.fillText).toHaveBeenCalledWith('Frost Runner', 128, 32);
    expect(nameplate.material.opacity).toBe(0.72);

    disposePlayerNameplate(nameplate);
  });
});
