import { spawn, spawnSync } from 'node:child_process';

const commands = [
  [
    'node_modules/typescript/bin/tsc',
    '-p',
    'packages/shared/tsconfig.json',
    '--watch',
    '--preserveWatchOutput',
  ],
  ['--import', 'tsx', '--watch', 'apps/server/src/main.ts'],
  ['node_modules/vite/bin/vite.js', 'apps/client', '--host', '127.0.0.1'],
];
const children = commands.map((args) =>
  spawn(process.execPath, args, {
    stdio: 'inherit',
    windowsHide: true,
  }),
);
let isStopping = false;
function stop(code = 0) {
  if (isStopping) return;
  isStopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    // Windows does not deliver SIGTERM to grandchildren of watcher processes.
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    else child.kill('SIGTERM');
  }
  process.exitCode = code;
}
for (const child of children) child.on('exit', (code) => stop(code ?? 1));
for (const child of children) child.on('error', () => stop(1));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
