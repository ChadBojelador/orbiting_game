import { describe, expect, it } from 'vitest';
import { ARENA } from '@ice-water/shared';
import { createArenaDecorationLayout } from './arena-decoration-layout.js';

describe('arena decoration layout', () => {
  it('uses all four tree silhouettes and crystal landmarks', () => {
    const layout = createArenaDecorationLayout(ARENA.blocks);
    const treeVariants = layout
      .filter((placement) => placement.kind === 'tree')
      .map((placement) => placement.variant);

    expect(new Set(treeVariants)).toEqual(new Set([0, 1, 2, 3]));
    expect(layout.filter((placement) => placement.kind === 'crystal-cluster')).toHaveLength(2);
  });

  it('anchors every decoration within an existing collision island', () => {
    const layout = createArenaDecorationLayout(ARENA.blocks);

    for (const placement of layout) {
      const block = ARENA.blocks[placement.blockIndex];
      expect(block).toBeDefined();
      expect(Math.abs(placement.x - block!.x)).toBeLessThanOrEqual(block!.width / 2);
      expect(Math.abs(placement.z - block!.z)).toBeLessThanOrEqual(block!.depth / 2);
    }
  });

  it('is deterministic so landmarks do not jump between sessions', () => {
    expect(createArenaDecorationLayout(ARENA.blocks)).toEqual(
      createArenaDecorationLayout(ARENA.blocks),
    );
  });
});
