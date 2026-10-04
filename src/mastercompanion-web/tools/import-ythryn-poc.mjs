import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { convertYthrynReference } from './ythryn-reference.mjs';
import { writeModuleSources } from './write-module-sources.mjs';

const [source, destination] = process.argv.slice(2);
if (!source || !destination || process.argv.length !== 4)
  throw new Error(
    'Usage: node tools/import-ythryn-poc.mjs <external-poc-html> <new-output-directory>',
  );
const { seed, image, report } = convertYthrynReference(source);
writeModuleSources(
  destination,
  seed,
  {
    id: 'ythryn',
    name: 'Ythryn',
    version: '0.1.0',
    contentSchemaVersion: 1,
    startMaterialId: 's210a67f4cc8e',
  },
  image,
);
writeFileSync(
  resolve(destination, 'conversion-report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(`POC imported into new Markdown sources: ${seed.materials.length} materials.`);
