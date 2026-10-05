import '@angular/compiler';
import { describe, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { HttpErrorResponse } from '@angular/common/http';
import type { FolderSnapshot, MaterialDto, WorkspaceDto } from '@mastercompanion/contracts';
import { ControlledHttp } from '../support/controlled-http';
import { FolderManagement } from '../../projects/engine/src/lib/features/folders/folder-management';
import {
  canReorderMaterial,
  isFolderSnapshot,
} from '../../projects/engine/src/lib/features/folders/folder-rules';
import { WorkspaceMaterials } from '../../projects/engine/src/lib/features/workspace/workspace-materials';

const folders = [{ id: 'folder', title: 'Folder', parentId: null }];
const initial: FolderSnapshot = {
  revision: 0,
  folders,
  materialOrder: [
    { id: 'first', folderId: 'folder' },
    { id: 'second', folderId: 'folder' },
    { id: 'unfiled', folderId: null },
  ],
};
const reordered: FolderSnapshot = {
  revision: 1,
  folders,
  materialOrder: [initial.materialOrder[1], initial.materialOrder[0], initial.materialOrder[2]],
};
const operation = {
  kind: 'reorderMaterial',
  materialId: 'second',
  folderId: 'folder',
  beforeId: 'first',
} as const;
function fixture(t: TestContext) {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
  const transport = new ControlledHttp((body) => body);
  const management = new FolderManagement('campaign', transport.client, storage, () => {});
  management.accept(initial);
  t.after(() => management.destroy());
  return { storage, transport, management };
}

describe('Campaign material ordering', () => {
  for (const [name, folderId, beforeId] of [
    ['cross-folder source', null, null],
    ['cross-folder destination', 'folder', 'unfiled'],
    ['self target', 'folder', 'second'],
    ['missing target', 'folder', 'missing'],
  ] as const) {
    test(`${name} is rejected before sending`, async (t) => {
      const { transport, management } = fixture(t);
      assert.equal(await management.execute({ ...operation, folderId, beforeId }), false);
      assert.equal(transport.requests.length, 0);
      assert.deepEqual(management.snapshot(), initial);
    });
  }
  test('Confirmed insertion publishes once and retains the original request until confirmed', async (t) => {
    const { transport, management, storage } = fixture(t);
    const saving = management.execute(operation);
    assert.deepEqual(management.snapshot(), initial);
    assert.equal(
      storage.getItem('mastercompanion.folders.pending.campaign'),
      JSON.stringify(transport.requests[0].body),
    );
    transport.requests[0].response.next(reordered);
    assert.equal(await saving, true);
    assert.deepEqual(management.snapshot(), reordered);
    assert.equal(management.locked(), false);
  });
  test('Incorrect insertion response retains a recoverable request', async (t) => {
    const { transport, management } = fixture(t);
    const saving = management.execute(operation);
    transport.requests[0].response.next({ ...initial, revision: 1 });
    assert.equal(await saving, false);
    assert.equal(management.error(), 'uncertain');
    assert.equal(management.locked(), true);
    assert.deepEqual(management.snapshot(), initial);
  });
  test('Lost response replay returns the original receipt without rolling back a newer order', async (t) => {
    const { transport, management, storage } = fixture(t);
    const saving = management.execute(operation);
    transport.requests[0].response.error(new HttpErrorResponse({ status: 0 }));
    assert.equal(await saving, false);
    const restored = new FolderManagement('campaign', transport.client, storage, () => {});
    t.after(() => restored.destroy());
    const latest = { ...initial, revision: 2 };
    restored.accept(latest);
    const retry = restored.retry();
    assert.deepEqual(transport.requests[1].body, transport.requests[0].body);
    transport.requests[1].response.next(reordered);
    await Promise.resolve();
    await Promise.resolve();
    transport.requests[2].response.next(latest);
    assert.equal(await retry, true);
    assert.deepEqual(restored.snapshot(), latest);
  });
  test('Same revision with divergent material ordering is rejected', (t) => {
    const { management } = fixture(t);
    management.accept(reordered);
    assert.equal(management.accept({ ...initial, revision: 1 }), false);
    assert.deepEqual(management.snapshot(), reordered);
  });
  test('Organization snapshot rejects duplicate materials and unknown folder membership', () => {
    assert.equal(
      isFolderSnapshot({
        ...initial,
        materialOrder: [initial.materialOrder[0], initial.materialOrder[0]],
      }),
      false,
    );
    assert.equal(
      isFolderSnapshot({ ...initial, materialOrder: [{ id: 'first', folderId: 'missing' }] }),
      false,
    );
    assert.equal(canReorderMaterial(initial, 'first', 'folder', null), true);
  });
  test('A delayed workspace and bulk read cannot restore previous ordering or replace a mounted draft', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const transport = new ControlledHttp((body) => body);
    const owner = new WorkspaceMaterials(transport.client);
    t.after(() => owner.destroy());
    const documents: MaterialDto[] = initial.materialOrder.map(({ id, folderId }) => ({
      id,
      folderId,
      title: id,
      group: '',
      revision: 5,
      documentSchemaVersion: 1,
      document: { type: 'doc', content: [{ type: 'paragraph' }] },
    }));
    const workspace: WorkspaceDto = {
      campaignId: 'campaign',
      title: 'Campaign',
      moduleId: 'test',
      moduleVersion: '1',
      startMaterialId: 'first',
      foldersRevision: 0,
      folders,
      materials: documents,
      maps: [],
    };
    const initialize = owner.initialize(workspace);
    transport.requests[0].response.next(documents);
    await initialize;
    const session = await owner.open('first');
    session.editing.set(true);
    session.change({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Unconfirmed draft' }] }],
    });
    const refresh = owner.initialize(workspace);
    owner.acceptFolders(reordered);
    transport.requests[1].response.next(documents);
    await refresh;
    assert.deepEqual(
      owner.workspace()?.materials.map((material) => material.id),
      ['second', 'first', 'unfiled'],
    );
    assert.equal(owner.sessions()[0], session);
    assert.equal(session.dirty(), true);
    assert.equal(session.confirmedRevision(), 5);
  });
});
