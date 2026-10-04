import { spawnSync } from 'node:child_process';
import { checkQuality } from './check-quality.mjs';
import './check-boundaries.mjs';
import './check-code-policy.mjs';

export function ng(args) {
  const result = spawnSync(process.execPath, ['node_modules/@angular/cli/bin/ng.js', ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
export function buildLibraries() {
  for (const name of ['contracts', 'ui', 'engine', 'ythryn']) ng(['build', name]);
}
if (import.meta.main) {
  checkQuality();
  buildLibraries();
  ng(['build', 'web']);
}
