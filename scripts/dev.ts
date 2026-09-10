import { spawn } from 'node:child_process';

const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this script through npm run dev');
const children = ['@ice-water/server', '@ice-water/client'].map((workspace) =>
  spawn(process.execPath, [npm, 'run', 'dev', '-w', workspace], {
    stdio: 'inherit',
    windowsHide: true,
  }),
);
let isStopping = false;
function stop(code = 0) {
  if (isStopping) return;
  isStopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) child.on('exit', (code) => stop(code ?? 1));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
