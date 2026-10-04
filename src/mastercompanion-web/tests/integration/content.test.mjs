import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateHTML, generateJSON } from '@tiptap/html';
import { documentExtensions } from '../../projects/engine/src/lib/editor-schema.mjs';
import { compileModule } from '../../tools/module-sources.mjs';
const seed = compileModule(resolve('../MasterCompanion.Modules.Ythryn/Data/Source'));
const sourceFixture = JSON.parse(
  readFileSync(new URL('../../tools/fixtures/ythryn-source.json', import.meta.url), 'utf8'),
);
const messages = JSON.parse(readFileSync('projects/engine/src/lib/i18n/en.json', 'utf8'));
const extensions = documentExtensions();
import {
  buildNavigation,
  folderPath,
} from '../../projects/engine/src/lib/features/workspace/navigation';
describe('Module content and document round trips', () => {
  test('Organized source chapter has 106 readable materials, 10 folders, and 29 working markers', () => {
    // Assert
    assert.equal(seed.materials.length, 106);
    assert.equal(seed.folders.length, 10);
    assert.equal(seed.maps[0].markers.length, 29);
    for (const marker of seed.maps[0].markers)
      assert.ok(seed.materials.some((item) => item.id === marker.materialId));
  });
  test('Every migrated document survives the schema round trip with tables, details, anchors and links intact', () => {
    // Arrange
    for (const material of seed.materials) {
      // Act
      const html = generateHTML(material.document, extensions);

      // Assert
      assert.deepEqual(
        JSON.parse(JSON.stringify(generateJSON(html, extensions))),
        material.document,
        material.title,
      );
      assert.doesNotMatch(html, /href="(?:https?:|obsidian:)/, material.title);
    }
    const y4 = seed.materials.find((item) => item.id === 's615b3d87a8ef');

    // Act
    const html = generateHTML(y4.document, extensions);

    // Assert
    assert.match(html, /<table/);
    assert.match(html, /<details/);
    assert.match(html, /id="s2736d584adc7"/);
  });
  test('Internal links reach an existing material and preserve their section anchors', () => {
    // Arrange
    const anchors = new Map();
    const links = [];
    function visit(node, ids) {
      if (node.attrs?.sourceId) ids.add(node.attrs.sourceId);
      for (const mark of node.marks ?? []) if (mark.type === 'link') links.push(mark.attrs.href);
      for (const child of node.content ?? []) visit(child, ids);
    }
    for (const material of seed.materials) {
      // Arrange
      const ids = new Set([material.id]);

      // Act
      visit(material.document, ids);
      anchors.set(material.id, ids);
    }
    for (const href of links) {
      // Arrange
      const [, id, anchor] = href.match(/^#material\/([^/]+)(?:\/(.+))?$/) ?? [];

      // Assert
      assert.ok(anchors.has(id), href);
      // Arrange
      if (anchor) assert.ok(anchors.get(id).has(anchor), href);
    }
  });
  test('Module document assignments and nested player folders match the maintained fixture', () => {
    // Assert
    assert.equal(seed.materials.length, Object.keys(sourceFixture.materialFolders).length);
    for (const [materialId, folderId] of Object.entries(sourceFixture.materialFolders))
      assert.equal(
        seed.materials.find((material) => material.id === materialId)?.folderId,
        folderId,
        materialId,
      );

    // Act
    const tree = buildNavigation(seed.folders, seed.materials, messages.workspace.unfiledMaterials);
    // Arrange
    const players = tree.find((folder) => folder.title === sourceFixture.playerTitle);

    // Assert
    assert.ok(players);
    // Arrange
    const fenes = players.children.find((folder) => folder.title === sourceFixture.characterTitle);

    // Assert
    assert.equal(fenes.children.length, 0);
    assert.equal(fenes.materials.length, 5);
    assert.ok(
      fenes.materials.some((material) => material.title === sourceFixture.characterGuideTitle),
    );
    assert.ok(
      tree.some(
        (folder) => folder.title === sourceFixture.metadataTitle && folder.children.length === 2,
      ),
    );
    // Arrange
    const visited = new Set();
    function visit(folder) {
      for (const material of folder.materials) {
        assert.ok(!visited.has(material.id));
        visited.add(material.id);
      }
      for (const child of folder.children) visit(child);
    }

    // Act
    tree.forEach(visit);

    // Assert
    assert.equal(visited.size, seed.materials.length);
  });
  test('All numbered locations share one folder in adventure order without navigation-only materials', () => {
    // Act
    const tree = buildNavigation(seed.folders, seed.materials, messages.workspace.unfiledMaterials);
    // Arrange
    const locations = tree.find((folder) => folder.title === sourceFixture.locationTitle);

    // Assert
    assert.ok(locations);
    assert.equal(locations.children.length, 0);
    // Arrange
    const expectedCodes = [
      ...Array.from({ length: 19 }, (_, index) => String(index + 1)),
      ...Array.from({ length: 17 }, (_, index) => `19${String.fromCharCode(97 + index)}`),
      ...Array.from({ length: 10 }, (_, index) => String(index + 20)),
    ];

    // Assert
    assert.deepEqual(
      locations.materials.map((material) => material.title.match(/^Y(\d+[a-z]?)\./)?.[1]),
      expectedCodes,
    );
    for (const id of sourceFixture.removedNavigationIds)
      assert.ok(!seed.materials.some((material) => material.id === id), id);
    for (const marker of seed.maps[0].markers)
      assert.ok(
        locations.materials.some((material) => material.id === marker.materialId),
        marker.code,
      );
  });
  test('Consolidated documents preserve section order, original content, rich tables, and stable anchors', () => {
    // Arrange
    for (const expected of sourceFixture.consolidatedDocuments) {
      // Arrange
      const material = seed.materials.find((item) => item.id === expected.id);

      // Assert
      assert.ok(material, expected.id);
      // Arrange
      const nodes = material.document.content;
      const sectionIds = new Set(expected.sections.map((section) => section.id));
      const headings = nodes.filter(
        (node) => node.type === 'heading' && sectionIds.has(node.attrs.sourceId),
      );

      // Assert
      assert.deepEqual(
        headings.map((node) => node.attrs.sourceId),
        expected.sections.map((section) => section.id),
      );
      for (const [index, section] of expected.sections.entries()) {
        // Assert
        assert.ok(!seed.materials.some((item) => item.id === section.id), section.id);
        assert.equal(headings[index].attrs.level, 2);
        assert.equal(
          headings[index].content.map((node) => node.text ?? '').join(''),
          section.title,
        );
        // Arrange
        const start = nodes.indexOf(headings[index]) + 1;
        const end = index + 1 < headings.length ? nodes.indexOf(headings[index + 1]) : nodes.length;
        const hash = createHash('sha256')
          .update(JSON.stringify(nodes.slice(start, end)))
          .digest('hex');

        // Assert
        assert.equal(hash, section.sha256, section.id);
      }
    }
  });
  test('Opening a nested material can expand every folder in its ancestor path', () => {
    // Arrange
    const target = seed.materials.find((material) => material.title === sourceFixture.deviceTitle);

    // Act
    const path = folderPath(seed.folders, target.folderId);

    // Assert
    assert.equal(path.length, 2);
    assert.equal(
      seed.folders.find((folder) => folder.id === path[0]).title,
      sourceFixture.playerTitle,
    );
    assert.equal(
      seed.folders.find((folder) => folder.id === path[1]).title,
      sourceFixture.characterTitle,
    );

    // Act
    const tree = buildNavigation(seed.folders, seed.materials, messages.workspace.unfiledMaterials);
    // Arrange
    let branch = tree.find((folder) => folder.id === path[0]);
    for (const id of path.slice(1)) branch = branch.children.find((folder) => folder.id === id);

    // Assert
    assert.ok(branch.materials.some((material) => material.id === target.id));
  });
});
