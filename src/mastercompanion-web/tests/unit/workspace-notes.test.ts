import '@angular/compiler';
import { describe, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { HttpErrorResponse } from '@angular/common/http';
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
    document: document('Original content'),
  };
}

function workspaceDescription(materials: MaterialDto[]): WorkspaceDto {
  return {
    campaignId: 'campaign',
    title: 'Campaign',
    moduleId: 'test-module',
    moduleVersion: '1',
    startMaterialId: materials[0]?.id ?? null,
    maps: [],
    folders: [
      { id: 'root', title: 'Root', parentId: null },
      { id: 'child', title: 'Child', parentId: 'root' },
    ],
    materials: materials.map(({ id, title, group, folderId }) => ({ id, title, group, folderId })),
  };
}

async function fixture(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const transport = new ControlledHttp((value) => value);
  const oldMaterial = material('existing-note', 'Existing note', 'child', 9);
  const description = workspaceDescription([oldMaterial]);
  const workspace = new WorkspaceMaterials(transport.client);
  t.after(() => workspace.destroy());
  const initializing = workspace.initialize(description);
  transport.requests[0].response.next([oldMaterial]);
  await initializing;
  return { workspace, oldMaterial, description, requests: transport.requests };
}

function confirmedWorkspace(workspace: WorkspaceMaterials): WorkspaceDto {
  const value = workspace.workspace();
  assert.ok(value);
  return value;
}

describe('Campaign material memory and sessions', () => {
  test('Initialization preloads documents without creating editing sessions', async (t) => {
    const transport = new ControlledHttp((value) => value);
    const workspace = new WorkspaceMaterials(transport.client);
    t.after(() => workspace.destroy());
    const snapshot = [material('one', 'One'), material('two', 'Two')];

    const initializing = workspace.initialize(workspaceDescription(snapshot));

    assert.equal(workspace.loadState(), 'loading');
    assert.equal(workspace.workspace(), null);
    assert.deepEqual(workspace.sessions(), []);
    assert.equal(transport.requests[0].url, '/api/campaigns/campaign/materials');

    transport.requests[0].response.next(snapshot);
    await initializing;

    assert.equal(workspace.loadState(), 'ready');
    assert.deepEqual(
      confirmedWorkspace(workspace).materials.map((item) => item.id),
      ['one', 'two'],
    );
    assert.deepEqual(workspace.sessions(), []);
  });

  test('Opening, closing and reopening a cached material requires no further reads', async (t) => {
    const { workspace, oldMaterial, requests } = await fixture(t);

    const first = await workspace.open(oldMaterial.id);
    workspace.removeConfirmedSession(first.material.id);
    const reopened = await workspace.open(oldMaterial.id);

    assert.notEqual(reopened, first);
    assert.equal(reopened.document, oldMaterial.document);
    assert.equal(reopened.editing(), false);
    assert.equal(reopened.confirmedRevision(), 9);
    assert.equal(requests.length, 1);
    assert.deepEqual(workspace.sessions(), [reopened]);
  });

  test('A startup batch failure publishes no workspace and retry completes initialization', async (t) => {
    const transport = new ControlledHttp((value) => value);
    const workspace = new WorkspaceMaterials(transport.client);
    t.after(() => workspace.destroy());
    const note = material('note', 'Note');
    const description = workspaceDescription([note]);
    const initializing = workspace.initialize(description);
    const rejected = assert.rejects(initializing, /Read failed/);

    transport.requests[0].response.error(new Error('Read failed'));
    await rejected;

    assert.equal(workspace.loadState(), 'error');
    assert.equal(workspace.workspace(), null);
    assert.deepEqual(workspace.sessions(), []);

    const retry = workspace.initialize(description);
    transport.requests[1].response.next([note]);
    await retry;

    assert.equal(workspace.loadState(), 'ready');
    assert.equal(confirmedWorkspace(workspace).campaignId, description.campaignId);
    assert.equal((await workspace.open(note.id)).material, note);
    assert.equal(transport.requests.length, 2);
  });

  test('Confirmed save content and revision survive immediate close and reopen', async (t) => {
    const { workspace, oldMaterial, requests } = await fixture(t);
    const session = await workspace.open(oldMaterial.id);
    const savedDocument = document('Confirmed edited content');
    session.change(savedDocument);

    const closing = session.prepareToClose();
    assert.equal(requests[1].method, 'PUT');
    assert.deepEqual(requests[1].body, { document: savedDocument, expectedRevision: 9 });
    requests[1].response.next({ revision: 10 });
    assert.equal(await closing, true);
    workspace.removeConfirmedSession(oldMaterial.id);
    const reopened = await workspace.open(oldMaterial.id);

    assert.equal(reopened.document, savedDocument);
    assert.equal(reopened.confirmedRevision(), 10);
    assert.equal(reopened.material.revision, 10);
    assert.equal(reopened.dirty(), false);
    assert.equal(requests.length, 2);
  });

  for (const state of ['waiting', 'conflict'] as const) {
    test(`Refresh preserves an existing ${state} draft while closed materials adopt remote revisions`, async (t) => {
      const { workspace, oldMaterial, description, requests } = await fixture(t);
      const session = await workspace.open(oldMaterial.id);
      const draft = document('Unconfirmed local draft');
      session.change(draft);
      session.editing.set(true);
      if (state === 'conflict') {
        const saving = session.flush();
        requests[1].response.error(new HttpErrorResponse({ status: 409 }));
        assert.equal(await saving, false);
      }
      const closed = material('closed-note', 'Closed note', 'child', 4);
      const refreshed = { ...oldMaterial, revision: 11, document: document('Remote content') };

      const initializing = workspace.initialize(description);
      requests[requests.length - 1].response.next([refreshed, closed]);
      await initializing;
      const existing = await workspace.open(oldMaterial.id);
      const opened = await workspace.open(closed.id);

      assert.equal(existing, session);
      assert.equal(existing.document, draft);
      assert.equal(existing.dirty(), true);
      assert.equal(existing.editing(), true);
      assert.equal(existing.status(), state);
      assert.equal(existing.confirmedRevision(), 9);
      assert.equal(opened.confirmedRevision(), 4);
      assert.equal(opened.document, closed.document);
      assert.equal(confirmedWorkspace(workspace).materials.length, 2);
    });
  }

  test('Refreshing a closed material makes the next opening use its remote revision', async (t) => {
    const { workspace, oldMaterial, description, requests } = await fixture(t);
    const first = await workspace.open(oldMaterial.id);
    workspace.removeConfirmedSession(first.material.id);
    const current = { ...oldMaterial, revision: 10, document: document('Remote update') };

    const initializing = workspace.initialize(description);
    requests[1].response.next([current]);
    await initializing;
    const reopened = await workspace.open(oldMaterial.id);

    assert.equal(reopened.document, current.document);
    assert.equal(reopened.confirmedRevision(), 10);
    assert.equal(requests.length, 2);
  });

  test('A failed refresh keeps the workspace and sessions available and can retry', async (t) => {
    const { workspace, oldMaterial, description, requests } = await fixture(t);
    const session = await workspace.open(oldMaterial.id);
    const previous = confirmedWorkspace(workspace);
    const initializing = workspace.initialize(description);
    const rejected = assert.rejects(initializing, /Read failed/);

    requests[1].response.error(new Error('Read failed'));
    await rejected;

    assert.equal(workspace.loadState(), 'error');
    assert.equal(confirmedWorkspace(workspace), previous);
    assert.equal(await workspace.open(oldMaterial.id), session);
    assert.equal(requests.length, 2);

    const retry = workspace.initialize(description);
    requests[2].response.next([oldMaterial]);
    await retry;

    assert.equal(workspace.loadState(), 'ready');
    assert.equal(await workspace.open(oldMaterial.id), session);
  });

  test('Concurrent opens of a new search result share a batch and add its canonical summary', async (t) => {
    const { workspace, oldMaterial, requests } = await fixture(t);
    const existing = await workspace.open(oldMaterial.id);
    existing.change(document('Local draft'));
    const remote = material('remote-note', 'Created in another window', 'child', 3);

    const first = workspace.open(remote.id);
    const second = workspace.open(remote.id);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].url, '/api/campaigns/campaign/materials');
    requests[1].response.next([oldMaterial, remote]);
    const [firstSession, secondSession] = await Promise.all([first, second]);

    assert.equal(firstSession, secondSession);
    assert.equal(firstSession.material, remote);
    assert.equal(firstSession.editing(), false);
    assert.equal(workspace.sessions()[0], existing);
    assert.deepEqual(existing.document, document('Local draft'));
    assert.equal(existing.dirty(), true);
    assert.deepEqual(
      confirmedWorkspace(workspace).materials.map((item) => item.id),
      [oldMaterial.id, remote.id],
    );
    assert.equal(requests.length, 2);
  });

  test('A material absent from a fresh snapshot produces a 404 without creating a session', async (t) => {
    const { workspace, oldMaterial, requests } = await fixture(t);
    const opening = workspace.open('missing-note');
    const rejected = assert.rejects(opening, { status: 404 });

    requests[1].response.next([oldMaterial]);
    await rejected;

    assert.deepEqual(workspace.sessions(), []);
    assert.equal(requests.length, 2);
  });

  test('Destruction cancels startup loading and forbids subsequent session opens', async () => {
    const transport = new ControlledHttp((value) => value);
    const workspace = new WorkspaceMaterials(transport.client);
    const note = material('note', 'Note');
    const initializing = workspace.initialize(workspaceDescription([note]));
    const rejected = assert.rejects(initializing, { name: 'EmptyError' });

    workspace.destroy();
    transport.requests[0].response.next([note]);
    await rejected;

    assert.equal(transport.requests[0].response.observed, false);
    assert.equal(workspace.workspace(), null);
    assert.deepEqual(workspace.sessions(), []);
    await assert.rejects(workspace.open(note.id), /unavailable/);
    assert.equal(transport.requests.length, 1);
  });

  test('Removing a session with an unconfirmed draft is rejected', async (t) => {
    const { workspace, oldMaterial } = await fixture(t);
    const session = await workspace.open(oldMaterial.id);
    session.change(document('Recoverable draft'));

    assert.throws(() => workspace.removeConfirmedSession(oldMaterial.id), /unconfirmed changes/);

    assert.deepEqual(workspace.sessions(), [session]);
    assert.equal(session.dirty(), true);
    assert.deepEqual(session.document, document('Recoverable draft'));
  });

  test('An initialized owner rejects switching campaigns without mixing documents', async (t) => {
    const { workspace, description, oldMaterial, requests } = await fixture(t);

    await assert.rejects(
      workspace.initialize({ ...description, campaignId: 'other-campaign' }),
      /switch campaigns/,
    );

    assert.equal(confirmedWorkspace(workspace).campaignId, 'campaign');
    assert.equal((await workspace.open(oldMaterial.id)).material, oldMaterial);
    assert.equal(requests.length, 1);
  });
});

describe('Confirmed notes and workspace navigation', () => {
  test('Confirmed creation adds a read-mode session and keeps existing drafts and navigation', async (t) => {
    const { workspace, oldMaterial, requests } = await fixture(t);
    const oldSession = await workspace.open(oldMaterial.id);
    oldSession.change(document('Unsaved campaign draft'));
    oldSession.editing.set(true);
    const originalDraft = oldSession.document;
    const created = material('note-01234567-89ab-cdef-0123-456789abcdef', 'New note');

    const createdSession = workspace.acceptCreatedMaterial(created);

    assert.equal(workspace.sessions()[0], oldSession);
    assert.equal(oldSession.document, originalDraft);
    assert.equal(oldSession.editing(), true);
    assert.equal(oldSession.dirty(), true);
    assert.equal(createdSession.material, created);
    assert.equal(createdSession.editing(), false);
    assert.equal(createdSession.dirty(), false);
    assert.equal(requests.length, 1);
    const tree = buildNavigation(
      confirmedWorkspace(workspace).folders,
      confirmedWorkspace(workspace).materials,
      'Unfiled',
    );
    const unfiled = tree.find((folder) => folder.id === '@unfiled');
    assert.ok(unfiled);
    assert.equal(unfiled.materials[0].id, created.id);

    workspace.removeConfirmedSession(created.id);
    const reopened = await workspace.open(created.id);

    assert.equal(reopened.material, created);
    assert.equal(requests.length, 1);
  });

  test('Duplicate confirmations preserve a new-note draft and add no duplicate summary or session', async (t) => {
    const { workspace } = await fixture(t);
    const created = material('note-01234567-89ab-cdef-0123-456789abcdef', 'New note', 'child');
    const session = workspace.acceptCreatedMaterial(created);
    session.change(document('New note draft'));
    session.editing.set(true);

    const replay = workspace.acceptCreatedMaterial({
      ...created,
      revision: 5,
      document: document('Remote revision'),
    });

    assert.equal(replay, session);
    assert.equal(workspace.sessions().length, 1);
    assert.equal(confirmedWorkspace(workspace).materials.length, 2);
    assert.deepEqual(session.document, document('New note draft'));
    assert.equal(session.editing(), true);
    assert.equal(session.dirty(), true);
    const tree = buildNavigation(
      confirmedWorkspace(workspace).folders,
      confirmedWorkspace(workspace).materials,
      'Unfiled',
    );
    assert.deepEqual(
      tree[0].children[0].materials.map((item) => item.id),
      ['existing-note', created.id],
    );
    assert.deepEqual(folderPath(confirmedWorkspace(workspace).folders, created.folderId), [
      'root',
      'child',
    ]);
  });

  test('Recovery opens the confirmed current document and revision in the ordinary session', async (t) => {
    const { workspace } = await fixture(t);
    const current = {
      ...material('recovered-note', 'Recovered note', null, 6),
      document: document('Confirmed remote content'),
    };

    const session = workspace.acceptCreatedMaterial(current);

    assert.equal(session.document, current.document);
    assert.equal(session.confirmedRevision(), 6);
    assert.equal(session.status(), 'saved');
    assert.equal(session.editing(), false);
  });
});
