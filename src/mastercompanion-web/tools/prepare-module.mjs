import { mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { compileModule } from './module-sources.mjs';

const [source, destination] = process.argv.slice(2);
if (!source || !destination || process.argv.length !== 4)
  throw new Error('Usage: node tools/prepare-module.mjs <source-directory> <output-json>');
const seed = compileModule(resolve(source));
const output = resolve(destination);
mkdirSync(dirname(output), { recursive: true });
const temporary = `${output}.${process.pid}.tmp`;
try {
  writeFileSync(temporary, JSON.stringify(seed, null, 2) + '\n');
  renameSync(temporary, output);
} finally {
  rmSync(temporary, { force: true });
}
console.log(
  `Module package prepared: ${seed.materials.length} materials, ${seed.folders.length} folders, ${seed.maps.length} maps.`,
);
