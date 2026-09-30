import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileModule, sourcePath } from './module-sources.mjs';
import { markdownToDocument, readMaterialSource, writeMaterialSource } from './module-markdown.mjs';
import { convertYthrynReference } from './ythryn-reference.mjs';
import { writeModuleSources } from './write-module-sources.mjs';

test('Markdown source export preserves all rich documents, hierarchy, and map', context => {
  mkdirSync('.local/tests', { recursive: true });
  const root = mkdtempSync(resolve('.local/tests/reference-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const source = resolve('../MasterCompanion.Modules.Ythryn/Data/Source');
  const seed = compileModule(source);
  const image = readFileSync(join(source, 'assets/ythryn-map.webp'));
  const destination = join(root, 'imported');
  writeModuleSources(destination, seed, { id: 'ythryn', name: 'Ythryn', version: '0.1.0', contentSchemaVersion: 1, startMaterialId: 's210a67f4cc8e' }, image);
  const compiled = compileModule(destination);
  const reference = JSON.parse(JSON.stringify(seed));
  assert.deepEqual(compiled, reference);
  assert.deepEqual(readFileSync(join(destination, 'assets/ythryn-map.webp')), image);
});

test('POC import uses an explicit external HTML file without a repository legacy directory', context => {
  mkdirSync('.local/tests', { recursive: true });
  const root = mkdtempSync(resolve('.local/tests/poc-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const config = JSON.parse(readFileSync(new URL('./fixtures/ythryn-import.json', import.meta.url), 'utf8'));
  const input = join(root, 'reference.html');
  const image = Buffer.from('fixture image');
  const data = {
    docs: [{ id: 'chapter', title: 'Chapter', chapter: 7, path: `${config.rootDirectory}/01.md`, name: '01.md' }],
    pages: [{ id: 'intro', title: 'Arrival', chapter: 7, doc: 'chapter', html: '<h3 id="arrival">Arrival</h3><p><a href="#intro~arrival">Open section</a></p>' }],
    maps: { 7: { title: 'Map', width: 100, height: 100, image: `data:image/webp;base64,${image.toString('base64')}`,
      points: [{ code: 'A', title: 'Arrival', page: 'intro', x: 50, y: 50 }] } },
  };
  writeFileSync(input, `const DATA = ${JSON.stringify(data)};`);
  assert.throws(() => convertYthrynReference(), /external POC HTML path/);
  const converted = convertYthrynReference(input);
  assert.equal(converted.seed.materials.length, 1);
  assert.equal(converted.seed.materials[0].document.content[1].content[0].marks[0].attrs.href, '#material/intro/arrival');
  const destination = join(root, 'imported');
  writeModuleSources(destination, converted.seed,
    { id: 'ythryn', name: 'Ythryn', version: '0.1.0', contentSchemaVersion: 1, startMaterialId: 'intro' }, converted.image);
  assert.deepEqual(compileModule(destination), JSON.parse(JSON.stringify(converted.seed)));
  assert.deepEqual(readFileSync(join(destination, 'assets/ythryn-map.webp')), image);
});

test('Markdown headings retain section IDs and readable formatting', () => {
  const material = readMaterialSource(writeMaterialSource({ id: 'intro', title: 'Introduction', folderId: 'chapter', sortOrder: 0 },
    '## Arrival {#arrival}\n\nRead **carefully** and *slowly*.\n\n- First\n- Second\n\n[Open](#material/intro/arrival)'));
  assert.equal(material.document.content[0].attrs.sourceId, 'arrival');
  assert.equal(material.document.content[2].type, 'bulletList');
  assert.equal(material.document.content[3].content[0].marks[0].attrs.href, '#material/intro/arrival');
});

test('Unsupported executable HTML, event handlers, remote assets, and external links fail validation', () => {
  for (const source of ['<script>alert(1)</script>', '<p onclick="alert(1)">Text</p>',
    '<a href="javascript:alert(1)">Open</a>', '<img src="https://example.com/image.png">', '[Open](https://example.com)'])
    assert.throws(() => markdownToDocument(source));
});

test('Missing, duplicate, unknown, and invalid material metadata are rejected', () => {
  for (const source of ['Text', '---\nid: one\nid: two\n---\nText', '---\n[]\n---\nText',
    '---\nid: one\ntitle: One\nfolderId: chapter\nsortOrder: -1\n---\nText',
    '---\nid: one\ntitle: One\nfolderId: chapter\nsortOrder: 0\nextra: value\n---\nText'])
    assert.throws(() => readMaterialSource(source));
});

function fixture(context) {
  mkdirSync('.local/tests', { recursive: true });
  const root = mkdtempSync(resolve('.local/tests/module-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'documents'));
  mkdirSync(join(root, 'assets'));
  const json = (name, value) => writeFileSync(join(root, name), JSON.stringify(value));
  const manifest = { id: 'example', name: 'Example', version: '0.1.0', sourceSchemaVersion: 1, contentSchemaVersion: 1,
    startMaterialId: 'intro', navigation: 'navigation.json', documents: 'documents', maps: ['map.json'],
    assets: [{ id: 'map-image', file: 'assets/map.webp', contentType: 'image/webp' }] };
  const folder = { id: 'chapter', title: 'Chapter', parentId: null, sortOrder: 0 };
  const map = { id: 'map', title: 'Map', assetId: 'map-image', width: 100, height: 100,
    markers: [{ code: 'A', title: 'Arrival', materialId: 'intro', x: 50, y: 50 }] };
  const material = body => writeMaterialSource({ id: 'intro', title: 'Introduction', folderId: 'chapter', sortOrder: 0 }, body);
  json('module.json', manifest);
  json('navigation.json', [folder]);
  json('map.json', map);
  writeFileSync(join(root, 'assets/map.webp'), 'fixture');
  writeFileSync(join(root, 'documents/intro.md'), material('## Arrival {#arrival}\n\n[Open](#material/intro/arrival)'));
  return { root, json, manifest, folder, map, material };
}

test('Compilation rejects duplicate IDs, folder cycles, broken section links, and marker targets', context => {
  const { root, json, folder, map, material } = fixture(context);
  assert.equal(compileModule(root).materials.length, 1);
  json('navigation.json', [{ ...folder, parentId: 'chapter' }]);
  assert.throws(() => compileModule(root), /folder cycle/);
  json('navigation.json', [folder]);
  writeFileSync(join(root, 'documents/intro.md'), material('[Open](#material/intro/missing)'));
  assert.throws(() => compileModule(root), /Unresolved material link/);
  writeFileSync(join(root, 'documents/intro.md'), material('Text'));
  writeFileSync(join(root, 'documents/duplicate.md'), material('Text'));
  assert.throws(() => compileModule(root), /duplicate material/);
  rmSync(join(root, 'documents/duplicate.md'));
  json('map.json', { ...map, markers: [{ ...map.markers[0], materialId: 'missing' }] });
  assert.throws(() => compileModule(root), /Invalid map marker/);
});

test('Source paths cannot escape their module and imports cannot overwrite edited sources', context => {
  const { root } = fixture(context);
  const outside = `${root}-outside.md`;
  context.after(() => rmSync(outside, { force: true }));
  writeFileSync(outside, 'Outside module');
  assert.throws(() => sourcePath(root, '../' + outside.split(/[\\/]/).at(-1)), /escapes its directory/);
  assert.throws(() => sourcePath(root, resolve('tools/module-sources.test.mjs')), /Invalid module source path/);
  assert.throws(() => writeModuleSources(root, {}, {}, Buffer.alloc(0)), /will not be overwritten/);
});

test('Building is deterministic and a rejected source leaves the last valid package intact', context => {
  const { root, json, map } = fixture(context);
  const output = join(root, 'package.json');
  const build = () => spawnSync(process.execPath, ['tools/prepare-module.mjs', root, output], { encoding: 'utf8' });
  assert.equal(build().status, 0);
  const first = readFileSync(output, 'utf8');
  assert.equal(build().status, 0);
  assert.equal(readFileSync(output, 'utf8'), first);
  json('map.json', { ...map, width: -1 });
  assert.notEqual(build().status, 0);
  assert.equal(readFileSync(output, 'utf8'), first);
});
