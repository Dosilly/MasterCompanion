import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(web, '../..');
const skippedDirectories = new Set(['node_modules', 'bin', 'obj', 'dist', 'out-tsc', '.angular', '.local']);
const sourceExtensions = new Set(['.cs', '.ts', '.mjs', '.js', '.cjs', '.html', '.scss', '.css', '.json', '.csproj', '.props', '.targets', '.yml', '.yaml']);
const dataExtensions = new Set(['.json', '.html', '.yml', '.yaml']);
// This detects Polish characters, not the language of every ASCII word. Review is still required.
const polishCharacters = /[\u0104\u0105\u0106\u0107\u0118\u0119\u0141\u0142\u0143\u0144\u00d3\u00f3\u015a\u015b\u0179\u017a\u017b\u017c]/;

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (skippedDirectories.has(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const allFiles = files(resolve(root, 'src'));
const violations = [];
for (const path of allFiles.filter(path => sourceExtensions.has(extname(path)))) {
  const repositoryPath = relative(root, path).replaceAll('\\', '/');
  const resourceData = /\/(?:i18n|fixtures)\//.test(repositoryPath) || /\/MasterCompanion\.Modules\.[^/]+\/Data\//.test(repositoryPath);
  if (resourceData && dataExtensions.has(extname(path))) continue;
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (polishCharacters.test(line)) violations.push(`${relative(root, path)}:${index + 1}`);
  });
}
assert.equal(violations.length, 0, `Use English in source code. Move localized text and source-specific samples to resources or fixtures:\n${violations.join('\n')}`);

function catalogEntries(value, prefix = '') {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `Invalid localization object: ${prefix}`);
  return Object.entries(value).flatMap(([key, entry]) => {
    assert.match(key, /^[a-z][a-zA-Z0-9]*$/, `Localization keys must use English identifier conventions: ${prefix}${key}`);
    const path = prefix + key;
    if (typeof entry === 'string') {
      assert.ok(entry.trim(), `Empty localized message: ${path}`);
      return [[path, entry]];
    }
    return catalogEntries(entry, path + '.');
  });
}

const catalogs = allFiles.filter(path => /(?:^|[\\/])i18n[\\/][a-z]{2}(?:-[A-Z]{2})?\.json$/.test(path));
const catalogDirectories = new Set(catalogs.map(dirname));
for (const directory of catalogDirectories) {
  const english = new Map(catalogEntries(JSON.parse(readFileSync(resolve(directory, 'en.json'), 'utf8'))));
  const expectedKeys = [...english.keys()].sort();
  for (const path of catalogs.filter(path => dirname(path) === directory)) {
    const translated = new Map(catalogEntries(JSON.parse(readFileSync(path, 'utf8'))));
    assert.deepEqual([...translated.keys()].sort(), expectedKeys, `Localization keys differ: ${relative(root, path)}`);
    for (const [key, message] of translated) {
      const placeholders = text => [...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map(match => match[1]).sort();
      assert.deepEqual(placeholders(message), placeholders(english.get(key)), `Localization placeholders differ: ${relative(root, path)}:${key}`);
    }
  }
}

console.log(`Code policy OK: English source guard and ${catalogs.length} matching localization catalogs.`);
