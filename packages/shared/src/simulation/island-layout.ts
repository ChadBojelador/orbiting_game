export interface IslandLayoutBlock {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

export interface IslandSurface extends IslandLayoutBlock {
  surface: 'snow' | 'ice' | 'dock';
  region: 'central' | 'north' | 'west' | 'east' | 'south' | 'southwest' | 'southeast' | 'route';
}

export interface IslandCover extends IslandLayoutBlock {
  kind: 'core' | 'facility' | 'container' | 'barrier' | 'ridge' | 'machinery' | 'dock';
}

export const ISLAND_HALF_EXTENT = 80;
export const ISLAND_FORT_SCALE = 0.52;
export const ISLAND_FORT_Y = 0.25;

const surface = (
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  kind: IslandSurface['surface'],
  region: IslandSurface['region'],
): IslandSurface => ({ id, x, y: 0, z, width, depth, height: 0.25, surface: kind, region });

/** Separate, low-detail land masses and their fast traversal routes. */
export const ISLAND_SURFACES: readonly IslandSurface[] = [
  surface('central-yard', 0, 0, 46, 40, 'snow', 'central'),
  surface('central-north-apron', -3, -23, 28, 8, 'snow', 'central'),
  surface('central-west-apron', -25, 3, 8, 24, 'snow', 'central'),
  surface('central-east-apron', 25, -4, 8, 22, 'snow', 'central'),

  surface('north-island', 0, -68, 32, 18, 'snow', 'north'),
  surface('north-shelf', -11, -57, 10, 5, 'snow', 'north'),
  surface('west-island', -68, 0, 18, 34, 'dock', 'west'),
  surface('west-shelf', -57, 10, 5, 12, 'snow', 'west'),
  surface('east-island', 68, 0, 18, 34, 'snow', 'east'),
  surface('east-shelf', 57, -10, 5, 12, 'snow', 'east'),
  surface('south-island', 0, 68, 34, 18, 'dock', 'south'),
  surface('south-shelf', 11, 57, 10, 5, 'snow', 'south'),
  surface('southwest-island', -47, 47, 12, 12, 'snow', 'southwest'),
  surface('southeast-island', 47, 47, 12, 12, 'snow', 'southeast'),

  surface('north-bridge-west', -8, -43, 3.2, 32, 'dock', 'route'),
  surface('north-bridge-east', 8, -43, 3.2, 32, 'dock', 'route'),
  surface('north-ice-route', 0, -43, 2.2, 32, 'ice', 'route'),
  surface('west-bridge-north', -44, -9, 30, 3.2, 'dock', 'route'),
  surface('west-bridge-south', -44, 9, 30, 3.2, 'dock', 'route'),
  surface('west-ice-route', -44, 0, 30, 2.2, 'ice', 'route'),
  surface('east-bridge-north', 44, -9, 30, 3.2, 'dock', 'route'),
  surface('east-bridge-south', 44, 9, 30, 3.2, 'dock', 'route'),
  surface('east-ice-route', 44, 0, 30, 2.2, 'ice', 'route'),
  surface('south-bridge-west', -8, 43, 3.2, 32, 'dock', 'route'),
  surface('south-bridge-east', 8, 43, 3.2, 32, 'dock', 'route'),
  surface('south-ice-route', 0, 43, 2.2, 32, 'ice', 'route'),

  surface('southwest-central-leg', -25, 32, 3, 34, 'ice', 'route'),
  surface('southwest-island-leg', -36, 47, 22, 3, 'dock', 'route'),
  surface('southeast-central-leg', 25, 32, 3, 34, 'ice', 'route'),
  surface('southeast-island-leg', 36, 47, 22, 3, 'dock', 'route'),
  surface('southwest-harbor-leg', -32, 60, 30, 3, 'dock', 'route'),
  surface('southwest-harbor-turn', -47, 56.5, 3, 10, 'ice', 'route'),
  surface('southeast-harbor-leg', 32, 60, 30, 3, 'dock', 'route'),
  surface('southeast-harbor-turn', 47, 56.5, 3, 10, 'ice', 'route'),
];

const cover = (
  id: string,
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  kind: IslandCover['kind'],
): IslandCover => ({ id, x, y, z, width, depth, height, kind });

/** Authored cover gives every island a role and breaks cross-map sightlines. */
export const ISLAND_COVER: readonly IslandCover[] = [
  cover('cryo-core', 0, 0.25, 0, 6, 6, 5, 'core'),
  cover('central-ruin-west', -13, 0.25, -4, 7, 11, 3.2, 'facility'),
  cover('central-ruin-east', 13, 0.25, 5, 7, 11, 3.2, 'facility'),
  cover('central-broken-wall-north', -3, 0.25, -15, 13, 2, 2.2, 'barrier'),
  cover('central-broken-wall-south', 5, 0.25, 15, 12, 2, 1.5, 'barrier'),
  cover('central-container-northwest', -18, 0.25, -18, 4, 2.6, 2.4, 'container'),
  cover('central-container-southeast', 18, 0.25, 15, 4, 2.6, 2.4, 'container'),
  cover('central-machinery', -7, 0.25, 10, 4, 4, 1.5, 'machinery'),

  cover('north-overlook', 0, 0.25, -68, 10, 6, 1.2, 'facility'),
  cover('north-ridge-west', -11, 0.25, -64, 4, 9, 2.4, 'ridge'),
  cover('north-ridge-east', 11, 0.25, -72, 4, 8, 2.1, 'ridge'),
  cover('north-step-south-1', 0, 0.25, -63.6, 5, 1, 0.3, 'facility'),
  cover('north-step-south-2', 0, 0.25, -64.6, 5, 1, 0.6, 'facility'),
  cover('north-step-south-3', 0, 0.25, -65.6, 5, 1, 0.9, 'facility'),
  cover('north-step-north-1', 0, 0.25, -72.4, 5, 1, 0.3, 'facility'),
  cover('north-step-north-2', 0, 0.25, -71.4, 5, 1, 0.6, 'facility'),
  cover('north-step-north-3', 0, 0.25, -70.4, 5, 1, 0.9, 'facility'),

  cover('west-warehouse', -69, 0.25, 0, 8, 12, 4.2, 'facility'),
  cover('west-container-north', -63, 0.25, -11, 5, 3, 2.5, 'container'),
  cover('west-container-south', -73, 0.25, 11, 5, 3, 2.5, 'container'),
  cover('west-pipeline', -62, 0.25, 5, 10, 2, 1.3, 'machinery'),
  cover('west-loader', -73, 0.25, -7, 3, 3, 2, 'machinery'),

  cover('east-lab-north', 68, 0.25, -8, 9, 8, 3.6, 'facility'),
  cover('east-lab-south', 69, 0.25, 9, 8, 7, 3.2, 'facility'),
  cover('east-glass-link', 62, 0.25, 1, 4, 10, 2.4, 'facility'),
  cover('east-generator', 74, 0.25, -1, 3, 4, 1.8, 'machinery'),

  cover('south-trapped-vessel', -2, 0.25, 69, 12, 5, 3, 'dock'),
  cover('south-container-west', -12, 0.25, 64, 4, 3, 2.4, 'container'),
  cover('south-container-east', 12, 0.25, 72, 4, 3, 2.4, 'container'),
  cover('south-crane-base', 11, 0.25, 63, 3, 3, 4.5, 'machinery'),
  cover('south-broken-dock', -11, 0.25, 74, 5, 2, 1.2, 'barrier'),

  cover('southwest-flank-cover', -47, 0.25, 47, 3, 5, 1.8, 'ridge'),
  cover('southeast-flank-cover', 47, 0.25, 47, 3, 5, 1.8, 'ridge'),
];

export function isInsideIslandBlock(
  position: { x: number; z: number },
  block: IslandLayoutBlock,
  margin = 0,
): boolean {
  return (
    Math.abs(position.x - block.x) <= block.width / 2 + margin &&
    Math.abs(position.z - block.z) <= block.depth / 2 + margin
  );
}

export function islandSurfaceAt(position: { x: number; z: number }): IslandSurface | undefined {
  return ISLAND_SURFACES.find((candidate) => isInsideIslandBlock(position, candidate));
}
