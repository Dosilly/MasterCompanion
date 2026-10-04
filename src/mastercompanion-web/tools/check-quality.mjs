import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../', import.meta.url));

export function checkQuality() {
  const checks = [
    [
      'node_modules/prettier/bin/prettier.cjs',
      '--check',
      'projects',
      'src',
      'tests',
      'tools',
      'e2e',
      '*.json',
      '*.ts',
      '*.mjs',
    ],
    ['node_modules/eslint/bin/eslint.js', 'projects', 'src', 'tests', 'e2e'],
    ['node_modules/typescript/bin/tsc', '--project', 'tests/tsconfig.json', '--noEmit'],
    ['node_modules/typescript/bin/tsc', '--project', 'e2e/tsconfig.json', '--noEmit'],
    ['tools/check-code-policy.mjs'],
    ['tools/check-boundaries.mjs'],
  ];
  for (const args of checks) {
    const result = spawnSync(process.execPath, args, { cwd: web, stdio: 'inherit' });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

if (import.meta.main) {
  checkQuality();
}
