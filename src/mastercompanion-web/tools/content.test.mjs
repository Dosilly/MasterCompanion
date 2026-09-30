import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { generateHTML, generateJSON } from '@tiptap/html';
import { documentExtensions } from '../projects/engine/src/lib/editor-schema.mjs';
import { compileModule } from './module-sources.mjs';

const seed = compileModule(resolve('../MasterCompanion.Modules.Ythryn/Data/Source'));
const sourceFixture = JSON.parse(readFileSync(new URL('./fixtures/ythryn-source.json', import.meta.url), 'utf8'));
const messages = JSON.parse(readFileSync('projects/engine/src/lib/i18n/en.json', 'utf8'));
const extensions = documentExtensions();
mkdirSync('.local/tests', { recursive: true });
const navigationModule = resolve('.local/tests/navigation.mjs');
writeFileSync(navigationModule, ts.transpileModule(readFileSync('projects/engine/src/lib/features/workspace/navigation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
const { buildNavigation, folderPath } = await import(pathToFileURL(navigationModule));
test('Organized source chapter has 106 readable materials, 10 folders, and 29 working markers', () => {
  assert.equal(seed.materials.length, 106);
  assert.equal(seed.folders.length, 10);
  assert.equal(seed.maps[0].markers.length, 29);
  for (const marker of seed.maps[0].markers) assert.ok(seed.materials.some(item => item.id === marker.materialId));
});
test('Every migrated document survives the schema round trip with tables, details, anchors and links intact', () => {
  for (const material of seed.materials) {
    const html = generateHTML(material.document, extensions);
    assert.deepEqual(JSON.parse(JSON.stringify(generateJSON(html, extensions))), material.document, material.title);
    assert.doesNotMatch(html, /href="(?:https?:|obsidian:)/, material.title);
  }
  const y4 = seed.materials.find(item => item.id === 's615b3d87a8ef');
  const html = generateHTML(y4.document, extensions);
  assert.match(html, /<table/);
  assert.match(html, /<details/);
  assert.match(html, /id="s2736d584adc7"/);
});

test('Internal links reach an existing material and preserve their section anchors', () => {
  const anchors = new Map();
  const links = [];
  function visit(node, ids) {
    if (node.attrs?.sourceId) ids.add(node.attrs.sourceId);
    for (const mark of node.marks ?? []) if (mark.type === 'link') links.push(mark.attrs.href);
    for (const child of node.content ?? []) visit(child, ids);
  }
  for (const material of seed.materials) {
    const ids = new Set([material.id]);
    visit(material.document, ids);
    anchors.set(material.id, ids);
  }
  for (const href of links) {
    const [, id, anchor] = href.match(/^#material\/([^/]+)(?:\/(.+))?$/) ?? [];
    assert.ok(anchors.has(id), href);
    if (anchor) assert.ok(anchors.get(id).has(anchor), href);
  }
});

test('Module document assignments and nested player folders match the maintained fixture', () => {
  assert.equal(seed.materials.length, Object.keys(sourceFixture.materialFolders).length);
  for (const [materialId, folderId] of Object.entries(sourceFixture.materialFolders))
    assert.equal(seed.materials.find(material => material.id === materialId)?.folderId, folderId, materialId);
  const tree = buildNavigation(seed.folders, seed.materials, '', messages.workspace.unfiledMaterials);
  const players = tree.find(folder => folder.title === sourceFixture.playerTitle);
  assert.ok(players);
  const fenes = players.children.find(folder => folder.title === sourceFixture.characterTitle);
  assert.equal(fenes.children.length, 0);
  assert.equal(fenes.materials.length, 5);
  assert.ok(fenes.materials.some(material => material.title === sourceFixture.characterGuideTitle));
  assert.ok(tree.some(folder => folder.title === sourceFixture.metadataTitle && folder.children.length === 2));
  const visited = new Set();
  function visit(folder) {
    for (const material of folder.materials) { assert.ok(!visited.has(material.id)); visited.add(material.id); }
    for (const child of folder.children) visit(child);
  }
  tree.forEach(visit);
  assert.equal(visited.size, seed.materials.length);
});

test('All numbered locations share one folder in adventure order without navigation-only materials', () => {
  const tree = buildNavigation(seed.folders, seed.materials, '', messages.workspace.unfiledMaterials);
  const locations = tree.find(folder => folder.title === sourceFixture.locationTitle);
  assert.ok(locations);
  assert.equal(locations.children.length, 0);
  const expectedCodes = [
    ...Array.from({ length: 19 }, (_, index) => String(index + 1)),
    ...Array.from({ length: 17 }, (_, index) => `19${String.fromCharCode(97 + index)}`),
    ...Array.from({ length: 10 }, (_, index) => String(index + 20)),
  ];
  assert.deepEqual(locations.materials.map(material => material.title.match(/^Y(\d+[a-z]?)\./)?.[1]), expectedCodes);
  for (const id of sourceFixture.removedNavigationIds)
    assert.ok(!seed.materials.some(material => material.id === id), id);
  for (const marker of seed.maps[0].markers)
    assert.ok(locations.materials.some(material => material.id === marker.materialId), marker.code);
});

test('Consolidated documents preserve section order, original content, rich tables, and stable anchors', () => {
  for (const expected of sourceFixture.consolidatedDocuments) {
    const material = seed.materials.find(item => item.id === expected.id);
    assert.ok(material, expected.id);
    const nodes = material.document.content;
    const sectionIds = new Set(expected.sections.map(section => section.id));
    const headings = nodes.filter(node => node.type === 'heading' && sectionIds.has(node.attrs.sourceId));
    assert.deepEqual(headings.map(node => node.attrs.sourceId), expected.sections.map(section => section.id));
    for (const [index, section] of expected.sections.entries()) {
      assert.ok(!seed.materials.some(item => item.id === section.id), section.id);
      assert.equal(headings[index].attrs.level, 2);
      assert.equal(headings[index].content.map(node => node.text ?? '').join(''), section.title);
      const start = nodes.indexOf(headings[index]) + 1;
      const end = index + 1 < headings.length ? nodes.indexOf(headings[index + 1]) : nodes.length;
      const hash = createHash('sha256').update(JSON.stringify(nodes.slice(start, end))).digest('hex');
      assert.equal(hash, section.sha256, section.id);
    }
  }
});

test('Search preserves the full ancestor path and opening a nested material can expand every folder', () => {
  const target = seed.materials.find(material => material.title === sourceFixture.deviceTitle);
  const path = folderPath(seed.folders, target.folderId);
  assert.equal(path.length, 2);
  assert.equal(seed.folders.find(folder => folder.id === path[0]).title, sourceFixture.playerTitle);
  assert.equal(seed.folders.find(folder => folder.id === path[1]).title, sourceFixture.characterTitle);
  const tree = buildNavigation(seed.folders, seed.materials, target.title, messages.workspace.unfiledMaterials);
  let branch = tree.find(folder => folder.id === path[0]);
  for (const id of path.slice(1)) branch = branch.children.find(folder => folder.id === id);
  assert.ok(branch.materials.some(material => material.id === target.id));
  assert.deepEqual(buildNavigation(seed.folders, seed.materials, 'no-such-material', messages.workspace.unfiledMaterials), []);
});
