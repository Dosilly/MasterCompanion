import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(web, '../..');
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'bin', 'obj', 'dist'].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
for (const [project, allowed] of [
  ['MasterCompanion.Contracts', []], ['MasterCompanion.Engine', ['MasterCompanion.Contracts']],
  ['MasterCompanion.Modules.Ythryn', ['MasterCompanion.Contracts']],
]) {
  const directory = resolve(root, 'src', project);
  const xml = readFileSync(resolve(directory, `${project}.csproj`), 'utf8');
  for (const reference of xml.matchAll(/ProjectReference Include="[^"]*\/([^/]+)\.csproj"/g))
    assert.ok(allowed.includes(reference[1]), `${project} cannot reference ${reference[1]}`);
  if (project === 'MasterCompanion.Engine')
    for (const path of files(directory).filter(path => path.endsWith('.cs')))
      assert.doesNotMatch(readFileSync(path, 'utf8'), /MasterCompanion\.Modules|\bYthryn\b/i, relative(root, path));
}
for (const library of ['contracts', 'engine', 'ythryn']) {
  const directory = resolve(web, 'projects', library);
  const allowed = library === 'contracts' ? [] : ['@mastercompanion/contracts'];
  const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }))
    if (dependency.startsWith('@mastercompanion/')) assert.ok(allowed.includes(dependency), `${library} dependency: ${dependency}`);
  for (const path of files(resolve(directory, 'src'))) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (specifier.startsWith('@mastercompanion/')) assert.ok(allowed.includes(specifier), `${library} import: ${specifier}`);
      if (specifier.startsWith('.')) {
        const target = relative(directory, resolve(dirname(path), specifier));
        assert.ok(!target.startsWith('..'), `${library} imports a private file outside its project: ${specifier}`);
      }
    }
    if (library === 'engine') assert.doesNotMatch(source, /\bYthryn\b/i, relative(web, path));
  }
}
console.log('Module boundaries OK: engine and modules depend only on contracts; host composes them.');
