import type { ArenaBlock } from '@ice-water/shared';

type RockVariant = 0 | 1 | 2 | 3;
type TreeVariant = 0 | 1 | 2 | 3;

interface PlacementBase {
  readonly blockIndex: number;
  readonly x: number;
  readonly z: number;
  readonly rotation: number;
  readonly scale: number;
}

export type ArenaDecorationPlacement =
  | (PlacementBase & { readonly kind: 'tree'; readonly variant: TreeVariant })
  | (PlacementBase & { readonly kind: 'rock'; readonly variant: RockVariant })
  | (PlacementBase & { readonly kind: 'bush' })
  | (PlacementBase & {
      readonly kind: 'flower';
      readonly color: 'coral' | 'cream' | 'lavender';
    })
  | (PlacementBase & { readonly kind: 'mushroom' })
  | (PlacementBase & { readonly kind: 'crystal-cluster' });

/**
 * Keeps every new decoration on an existing collision island. The art therefore
 * enriches landmarks without creating hidden client-only obstacles or narrowing lanes.
 */
export function createArenaDecorationLayout(
  blocks: readonly ArenaBlock[],
): readonly ArenaDecorationPlacement[] {
  const placements: ArenaDecorationPlacement[] = [];
  let squareIndex = 0;

  blocks.forEach((block, blockIndex) => {
    const isWideIsland = block.width > block.depth * 2;
    if (isWideIsland) {
      placements.push(
        {
          kind: 'crystal-cluster',
          blockIndex,
          x: block.x,
          z: block.z,
          rotation: blockIndex % 2 === 0 ? -12 : 16,
          scale: 0.62,
        },
        {
          kind: 'rock',
          variant: (blockIndex % 4) as RockVariant,
          blockIndex,
          x: block.x - block.width * 0.31,
          z: block.z + block.depth * 0.12,
          rotation: blockIndex * 29,
          scale: 0.56,
        },
        {
          kind: 'flower',
          color: blockIndex % 2 === 0 ? 'cream' : 'lavender',
          blockIndex,
          x: block.x + block.width * 0.32,
          z: block.z - block.depth * 0.08,
          rotation: 0,
          scale: 1.05,
        },
      );
      return;
    }

    const xDirection = block.x < 0 ? -1 : 1;
    const zDirection = block.z < 0 ? -1 : 1;
    placements.push(
      {
        kind: 'tree',
        variant: (squareIndex % 4) as TreeVariant,
        blockIndex,
        x: block.x + xDirection * block.width * 0.16,
        z: block.z + zDirection * block.depth * 0.12,
        rotation: 22 + squareIndex * 67,
        scale: 0.66 + (squareIndex % 2) * 0.08,
      },
      {
        kind: 'rock',
        variant: ((squareIndex + 1) % 4) as RockVariant,
        blockIndex,
        x: block.x - xDirection * block.width * 0.28,
        z: block.z + zDirection * block.depth * 0.28,
        rotation: squareIndex * 41,
        scale: 0.55,
      },
      {
        kind: 'bush',
        blockIndex,
        x: block.x - xDirection * block.width * 0.27,
        z: block.z - zDirection * block.depth * 0.2,
        rotation: squareIndex * 53,
        scale: 0.72,
      },
      {
        kind: 'flower',
        color: (['coral', 'cream', 'lavender'] as const)[squareIndex % 3]!,
        blockIndex,
        x: block.x + xDirection * block.width * 0.31,
        z: block.z - zDirection * block.depth * 0.3,
        rotation: 0,
        scale: 1.08,
      },
      {
        kind: 'mushroom',
        blockIndex,
        x: block.x - xDirection * block.width * 0.06,
        z: block.z - zDirection * block.depth * 0.34,
        rotation: squareIndex * 31,
        scale: 0.92,
      },
    );
    squareIndex++;
  });

  return placements;
}
