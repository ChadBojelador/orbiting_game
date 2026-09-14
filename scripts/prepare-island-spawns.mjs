import fs from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { findIslandSpawns } from '../packages/shared/dist/simulation/island-collision.js';
const spawns = findIslandSpawns();
fs.writeFileSync(
  'packages/shared/src/simulation/island-spawns.ts',
  await format(
    `// Derived from the Island collision mesh. Regenerate with npm run assets:island.\nimport type { Position } from '../protocol/gameplay.js';\nexport const ISLAND_SPAWNS: readonly Position[] = ${JSON.stringify(spawns)};\n`,
    {
      ...(await resolveConfig('packages/shared/src/simulation/island-spawns.ts')),
      parser: 'typescript',
    },
  ),
);
console.log(`Generated ${spawns.length} safe Island spawns`);
