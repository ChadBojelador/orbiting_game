import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const result = spawnSync(process.execPath, [vite, 'build'], {
  cwd: fileURLToPath(new URL('../apps/client/', import.meta.url)),
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
