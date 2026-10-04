import '@angular/compiler';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MaterialDto, RichDocument, WorkspaceDto } from '@mastercompanion/contracts';
import { ControlledHttp } from '../support/controlled-http';
import { WorkspaceMaterials } from '../../projects/engine/src/lib/features/workspace/workspace-materials';
import {
  buildNavigation,
  folderPath,
} from '../../projects/engine/src/lib/features/workspace/navigation';
const document = (text: string): RichDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});
function material(
  id: string,
  title: string,
  folderId: string | null = null,
  revision = 1,
): MaterialDto {
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
  const transport = new ControlledHttp((value) => value);
  const requests = transport.requests;
  const oldMaterial = material('existing-note', 'Existing note', 'child', 9);
  const workspace = new WorkspaceMaterials(transport.client);
  const oldSession = workspace.acceptCreatedMaterial(oldMaterial);
  oldSession.document = document('Unsaved campaign draft');
  oldSession.editing.set(true);
  oldSession.dirty.set(true);
  oldSession.status.set('conflict');
  workspace.initialize({
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
  return { workspace, oldSession, requests };
}
function confirmedWorkspace(workspace: WorkspaceMaterials): WorkspaceDto {
  const value = workspace.workspace();
  assert.ok(value);
  return value;
}

describe('Confirmed notes and workspace navigation', () => {
  test('Concurrent opens share one read and retain the same session on later opens', async () => {
    // Arrange
    const transport = new ControlledHttp((value) => value);
    const workspace = new WorkspaceMaterials(transport.client);

    // Act
    const first = workspace.open('note');
    const second = workspace.open('note');

    // Assert
    assert.equal(transport.requests.length, 1);
    assert.equal(transport.requests[0].url, '/api/materials/note');

    // Act
    transport.requests[0].response.next(material('note', 'Note'));
    transport.requests[0].response.complete();
    const [firstSession, secondSession] = await Promise.all([first, second]);

    // Assert
    assert.equal(firstSession, secondSession);
    assert.equal(await workspace.open('note'), firstSession);
    assert.equal(transport.requests.length, 1);
    assert.equal(workspace.sessions().length, 1);
  });

  test('A failed read leaves no session and a subsequent open can retry', async () => {
    // Arrange
    const transport = new ControlledHttp((value) => value);
    const workspace = new WorkspaceMaterials(transport.client);

    // Act
    const opening = workspace.open('note');
    const rejected = assert.rejects(opening, /Read failed/);
    transport.requests[0].response.error(new Error('Read failed'));
    await rejected;

    // Assert
    assert.equal(workspace.sessions().length, 0);

    // Act
    const retry = workspace.open('note');
    transport.requests[1].response.next(material('note', 'Note'));
    transport.requests[1].response.complete();
    await retry;

    // Assert
    assert.equal(transport.requests.length, 2);
    assert.equal(workspace.sessions().length, 1);
  });

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

    // Act
    const tree = buildNavigation(
      confirmedWorkspace(workspace).folders,
      confirmedWorkspace(workspace).materials,
      '',
      'Unfiled',
    );

    // Assert
    const unfiled = tree.find((folder) => folder.id === '@unfiled');
    assert.ok(unfiled);
    assert.equal(unfiled.materials[0].id, created.id);
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
    assert.equal(confirmedWorkspace(workspace).materials.length, 2);
    assert.equal(workspace.sessions()[1], session);
    assert.deepEqual(session.document, document('New note draft'));
    assert.equal(session.editing(), true);
    assert.equal(session.dirty(), true);

    // Act
    const tree = buildNavigation(
      confirmedWorkspace(workspace).folders,
      confirmedWorkspace(workspace).materials,
      created.title,
      'Unfiled',
    );

    // Assert
    assert.equal(tree[0].children[0].materials[0].id, created.id);

    // Act
    const actual1 = folderPath(confirmedWorkspace(workspace).folders, created.folderId);

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
