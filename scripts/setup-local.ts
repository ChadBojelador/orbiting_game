import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.env')) {
  console.log('Existing .env preserved');
} else {
  const password = randomBytes(24).toString('hex');
  const secret = randomBytes(48).toString('hex');
  writeFileSync(
    '.env',
    `NODE_ENV=development\nGAME_SERVER_HOST=127.0.0.1\nGAME_SERVER_PORT=2567\nCLIENT_ORIGIN=http://localhost:5173\nVITE_GAME_SERVER_URL=ws://localhost:2567\nGUEST_SESSION_SIGNING_SECRET=${secret}\nPOSTGRES_PASSWORD=${password}\nDATABASE_URL=postgresql://icewater:${password}@localhost:5432/icewater\n`,
  );
  console.log('Created ignored .env with random local credentials');
}
