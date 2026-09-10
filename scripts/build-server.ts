import { cpSync } from 'node:fs';

cpSync('apps/server/src/persistence/migrations', 'apps/server/dist/persistence/migrations', {
  recursive: true,
});
