import '@angular/compiler';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import { signal } from '@angular/core';
const directory = resolve('.local/tests/workspace-notes');
mkdirSync(directory, { recursive: true });
function compile(name, source) {
  const path = resolve(directory, `${name}.mjs`);
  writeFileSync(
    path,
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  );
  return path;
}
const sessionPath = compile(
  'material-session',
  readFileSync('projects/engine/src/lib/features/materials/material-session.ts', 'utf8'),
);
const navigationPath = compile(
  'navigation',
  readFileSync('projects/engine/src/lib/features/workspace/navigation.ts', 'utf8'),
);
// Compile the actual integration method without loading the Angular component template or its unrelated panels.
const workspaceSource = ts.createSourceFile(
  'workspace.ts',
  readFileSync('projects/engine/src/lib/features/workspace/workspace.ts', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const workspaceClass = workspaceSource.statements.find(
  (node) => ts.isClassDeclaration(node) && node.name?.text === 'Workspace',
);
assert.ok(workspaceClass);
const acceptance = workspaceClass.members.find(
  (node) =>
    ts.isMethodDeclaration(node) && node.name.getText(workspaceSource) === 'acceptCreatedMaterial',
);
assert.ok(acceptance);
const workspacePath = compile(
  'workspace-notes',
  `import { MaterialSession } from '${pathToFileURL(sessionPath).href}';\nexport class WorkspaceNotes { ${acceptance.getText(workspaceSource)} }`,
);
const { WorkspaceNotes } = await import(pathToFileURL(workspacePath));
const { MaterialSession } = await import(pathToFileURL(sessionPath));
const { buildNavigation, folderPath } = await import(pathToFileURL(navigationPath));
const document = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});
function material(id, title, folderId = null, revision = 1) {
  return {
    id,
    title,
    folderId,
    group: '',
    revision,
    documentSchemaVersion: 1,
    document: document(''),
  };
}
function fixture() {
  const requests = [];
  const http = {
    put(...args) {
      requests.push(args);
      throw new Error('Acceptance must not write existing drafts.');
    },
  };
  const oldMaterial = material('existing-note', 'Existing note', 'child', 9);
  const oldSession = new MaterialSession(oldMaterial, http);
  oldSession.document = document('Unsaved campaign draft');
  oldSession.editing.set(true);
  oldSession.dirty.set(true);
  oldSession.status.set('conflict');
  const workspace = new WorkspaceNotes();
  workspace.http = http;
  workspace.workspace = signal({
    campaignId: 'campaign',
    title: 'Campaign',
    moduleId: 'test-module',
    moduleVersion: '1',
    startMaterialId: oldMaterial.id,
    maps: [],
    folders: [
      { id: 'root', title: 'Root', parentId: null },
      { id: 'child', title: 'Child', parentId: 'root' },
    ],
    materials: [
      { id: oldMaterial.id, title: oldMaterial.title, group: '', folderId: oldMaterial.folderId },
    ],
  });
  workspace.sessions = signal([oldSession]);
  workspace.activations = [];
  workspace.activate = (id) => workspace.activations.push(id);
  return { workspace, oldSession, requests };
}
describe('Confirmed notes and workspace navigation', () => {
  test('Confirmed creation adds one summary and a read-mode session without replacing or saving current drafts', () => {
    // Arrange
    const { workspace, oldSession, requests } = fixture();
    const originalDraft = oldSession.document;
    const created = material('note-01234567-89ab-cdef-0123-456789abcdef', 'New note');

    // Act
    workspace.acceptCreatedMaterial(created);

    // Assert
    assert.equal(workspace.sessions()[0], oldSession);
    assert.equal(oldSession.document, originalDraft);
    assert.equal(oldSession.editing(), true);
    assert.equal(oldSession.dirty(), true);
    assert.equal(oldSession.status(), 'conflict');
    assert.equal(workspace.sessions()[1].material, created);
    assert.equal(workspace.sessions()[1].editing(), false);
    assert.equal(workspace.sessions()[1].dirty(), false);
    assert.equal(requests.length, 0);
    assert.deepEqual(workspace.activations, [created.id]);

    // Act
    const tree = buildNavigation(
      workspace.workspace().folders,
      workspace.workspace().materials,
      '',
      'Unfiled',
    );

    // Assert
    assert.equal(tree.find((folder) => folder.id === '@unfiled').materials[0].id, created.id);
  });
  test('Duplicate confirmations preserve an existing new-note editor and append neither duplicate tab nor summary', () => {
    // Arrange
    const { workspace } = fixture();
    const created = material('note-01234567-89ab-cdef-0123-456789abcdef', 'New note', 'child');

    // Act
    workspace.acceptCreatedMaterial(created);
    // Arrange
    const session = workspace.sessions()[1];

    // Act
    session.document = document('New note draft');
    session.editing.set(true);
    session.dirty.set(true);
    workspace.acceptCreatedMaterial({
      ...created,
      revision: 5,
      document: document('Remote revision'),
    });

    // Assert
    assert.equal(workspace.sessions().length, 2);
    assert.equal(workspace.workspace().materials.length, 2);
    assert.equal(workspace.sessions()[1], session);
    assert.deepEqual(session.document, document('New note draft'));
    assert.equal(session.editing(), true);
    assert.equal(session.dirty(), true);

    // Act
    const tree = buildNavigation(
      workspace.workspace().folders,
      workspace.workspace().materials,
      created.title,
      'Unfiled',
    );

    // Assert
    assert.equal(tree[0].children[0].materials[0].id, created.id);

    // Act
    const actual1 = folderPath(workspace.workspace().folders, created.folderId);

    // Assert
    assert.deepEqual(actual1, ['root', 'child']);
  });
  test('Recovery uses the confirmed current document and revision in the ordinary material session', () => {
    // Arrange
    const { workspace } = fixture();
    const current = {
      ...material('note-01234567-89ab-cdef-0123-456789abcdef', 'Recovered note', null, 6),
      document: document('Confirmed remote content'),
    };

    // Act
    workspace.acceptCreatedMaterial(current);
    // Arrange
    const session = workspace.sessions()[1];

    // Assert
    assert.deepEqual(session.document, document('Confirmed remote content'));
    assert.equal(session.material.revision, 6);
    assert.equal(session.status(), 'saved');
    assert.equal(session.editing(), false);
  });
});
