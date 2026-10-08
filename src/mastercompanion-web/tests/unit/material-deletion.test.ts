import '@angular/compiler';
import { describe, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { HttpErrorResponse } from '@angular/common/http';
import type {
  MaterialDeletionPreview,
  MaterialDto,
  RichDocument,
} from '@mastercompanion/contracts';
import { ControlledHttp } from '../support/controlled-http';
import { MaterialSession } from '../../projects/engine/src/lib/features/materials/material-session';
import { MaterialDeletion } from '../../projects/engine/src/lib/features/materials/material-deletion';
import { CampaignMaterialCache } from '../../projects/engine/src/lib/features/workspace/campaign-material-cache';
import { WorkspaceMaterials } from '../../projects/engine/src/lib/features/workspace/workspace-materials';

const document = (text: string): RichDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const material: MaterialDto = {
  id: 'note',
  title: 'Note',
  group: '',
  folderId: null,
  revision: 1,
  documentSchemaVersion: 1,
  document: document('Original'),
};
const preview: MaterialDeletionPreview = {
  id: 'note',
  title: 'Note',
  revision: 1,
  referencesToken: 'A'.repeat(64),
  documentLinks: [],
  mapMarkers: [],
  pinnedSessions: [],
  owningCharacters: [],
  owningSessions: [],
};
const turn = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const transport = new ControlledHttp((value) => value);
  const session = new MaterialSession(material, transport.client);
  const deletion = new MaterialDeletion('campaign', transport.client);
  t.after(() => {
    session.destroy();
    deletion.destroy();
  });
  return { transport, session, deletion };
}
async function inspect(
  deletion: MaterialDeletion,
  session: MaterialSession,
  transport: ControlledHttp<unknown>,
) {
  const pending = deletion.inspect('note', session);
  await turn();
  transport.requests.at(-1)?.response.next(preview);
  await pending;
}

describe('Material deletion confirmation', () => {
  test('Opening and cancelling retains the draft and resumes its queued autosave', async (t) => {
    // Arrange
    const { transport, session, deletion } = fixture(t);
    session.change(document('Draft'));

    // Act
    await inspect(deletion, session, transport);
    t.mock.timers.tick(1000);

    // Assert
    assert.equal(transport.requests.length, 1);
    assert.equal(deletion.dirty(), true);
    assert.deepEqual(session.document, document('Draft'));

    // Act
    deletion.cancel();
    t.mock.timers.tick(650);

    // Assert
    assert.equal(transport.requests[1].method, 'PUT');
  });

  test('Opening waits for an in-flight save and uses its confirmed revision', async (t) => {
    // Arrange
    const { transport, session, deletion } = fixture(t);
    session.change(document('Saving'));
    const saving = session.flush();

    // Act
    const inspecting = deletion.inspect('note', session);
    await turn();

    // Assert
    assert.equal(transport.requests.length, 1);
    assert.equal(deletion.pending(), true);

    // Act
    transport.requests[0].response.next({ revision: 2 });
    await saving;
    await turn();
    transport.requests[1].response.next({ ...preview, revision: 2 });
    await inspecting;

    // Assert
    assert.equal(deletion.preview()?.revision, 2);
    assert.equal(deletion.dirty(), false);
  });

  test('Dirty deletion requires explicit acknowledgement and uncertain retry preserves the exact request', async (t) => {
    // Arrange
    const { transport, session, deletion } = fixture(t);
    session.change(document('Draft'));
    await inspect(deletion, session, transport);

    // Act
    assert.equal(await deletion.confirm(false), null);
    const first = deletion.confirm(true);
    transport.requests[1].response.error(new HttpErrorResponse({ status: 0 }));
    await first;

    // Assert
    assert.equal(deletion.retryAvailable(), true);
    assert.equal(session.dirty(), true);
    assert.deepEqual(session.document, document('Draft'));

    // Act
    const retry = deletion.confirm(true);
    transport.requests[2].response.next({ id: 'note' });

    // Assert
    assert.deepEqual(transport.requests[2].body, transport.requests[1].body);
    assert.equal(await retry, 'note');
  });

  test('Revision conflict keeps the draft and prevents rebasing deletion automatically', async (t) => {
    // Arrange
    const { transport, session, deletion } = fixture(t);
    session.change(document('Draft'));
    await inspect(deletion, session, transport);

    // Act
    const pending = deletion.confirm(true);
    transport.requests[1].response.error(
      new HttpErrorResponse({ status: 409, error: { code: 'material_revision_conflict' } }),
    );
    await pending;
    deletion.cancel();
    t.mock.timers.tick(1000);

    // Assert
    assert.equal(deletion.preview(), null);
    assert.equal(deletion.error(), 'conflict');
    assert.equal(session.status(), 'conflict');
    assert.equal(session.dirty(), true);
    assert.equal(transport.requests.length, 2);
  });

  test('Cancelling inspection while a save settles ignores its obsolete preview and resumes the draft', async (t) => {
    // Arrange
    const { transport, session, deletion } = fixture(t);
    session.change(document('Saving'));
    const saving = session.flush();
    session.change(document('Newer draft'));
    const inspecting = deletion.inspect('note', session);

    // Act
    deletion.cancel();
    transport.requests[0].response.next({ revision: 2 });
    await turn();
    transport.requests[1].response.next({ revision: 3 });
    await saving;
    await inspecting;

    // Assert
    assert.equal(deletion.pending(), false);
    assert.equal(deletion.preview(), null);
    assert.equal(transport.requests.length, 2);
    assert.equal(session.dirty(), false);
    assert.equal(session.confirmedRevision(), 3);
  });

  test('A protected session document cannot submit a deletion', async (t) => {
    // Arrange
    const { transport, session, deletion } = fixture(t);
    const pending = deletion.inspect('note', session);
    await turn();
    transport.requests[0].response.next({ ...preview, owningSessions: ['Session'] });
    await pending;

    // Act
    const deleted = await deletion.confirm(true);

    // Assert
    assert.equal(deleted, null);
    assert.equal(transport.requests.length, 1);
  });

  test('A delayed bulk read cannot resurrect a confirmed deleted material', async (t) => {
    // Arrange
    const transport = new ControlledHttp((value) => value);
    const cache = new CampaignMaterialCache('campaign', transport.client);
    t.after(() => cache.destroy());
    cache.confirm(material);
    const refresh = cache.refresh();

    // Act
    cache.remove('note');
    transport.requests[0].response.next([material]);
    await refresh;

    // Assert
    assert.equal(cache.get('note'), undefined);
  });

  test('Remote deletion removes navigation but keeps an open unsaved draft recoverable', async (t) => {
    // Arrange
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const transport = new ControlledHttp((value) => value);
    const owner = new WorkspaceMaterials(transport.client);
    t.after(() => owner.destroy());
    const workspace = {
      campaignId: 'campaign',
      title: 'Campaign',
      moduleId: 'module',
      moduleVersion: '1',
      foldersRevision: 1,
      folders: [],
      startMaterialId: 'note',
      maps: [],
      materials: [material],
    };
    const initializing = owner.initialize(workspace);
    transport.requests[0].response.next([material]);
    await initializing;
    const session = await owner.open('note');
    session.change(document('Draft'));

    // Act
    const refreshing = owner.initialize({ ...workspace, materials: [] });
    transport.requests[1].response.next([]);
    await refreshing;
    t.mock.timers.tick(1000);

    // Assert
    assert.deepEqual(owner.workspace()?.materials, []);
    assert.equal(owner.sessions().length, 1);
    assert.deepEqual(session.document, document('Draft'));
    assert.equal(session.error(), 'materialDeleted');
    assert.equal(transport.requests.length, 2);
  });
});
