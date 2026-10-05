import '@angular/compiler';
import { describe, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { HttpErrorResponse } from '@angular/common/http';
import { Window } from 'happy-dom';
import type { CampaignFolder, FolderSnapshot, WorkspaceDto } from '@mastercompanion/contracts';
import { ControlledHttp } from '../support/controlled-http';
import { FolderManagement } from '../../projects/engine/src/lib/features/folders/folder-management';
import {
  canMoveFolder,
  isFolderSnapshot,
} from '../../projects/engine/src/lib/features/folders/folder-rules';
import { MaterialCreation } from '../../projects/engine/src/lib/features/materials/material-creation';
import { WorkspaceMaterials } from '../../projects/engine/src/lib/features/workspace/workspace-materials';
import { FolderDrag } from '../../projects/engine/src/lib/features/folders/folder-drag';

const folders: CampaignFolder[] = [
  { id: 'root', title: 'Root', parentId: null },
  { id: 'child', title: 'Child', parentId: 'root' },
  { id: 'leaf', title: 'Leaf', parentId: 'child' },
  { id: 'other', title: 'Other', parentId: null },
];
const key = 'mastercompanion.folders.pending.campaign';

function storage() {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (name: string) => entries.get(name) ?? null,
    setItem: (name: string, value: string) => {
      entries.set(name, value);
    },
    removeItem: (name: string) => {
      entries.delete(name);
    },
  };
}

function fixture(t: TestContext, store: ReturnType<typeof storage> | null = storage()) {
  const transport = new ControlledHttp((body) => body);
  const confirmations: FolderSnapshot[] = [];
  const management = new FolderManagement('campaign', transport.client, store, (snapshot) =>
    confirmations.push(snapshot),
  );
  management.accept({ revision: 0, folders, materialOrder: [] });
  t.after(() => management.destroy());
  return { management, transport, store, confirmations };
}

function renamed(revision: number, title = 'Renamed'): FolderSnapshot {
  return {
    revision,
    materialOrder: [],
    folders: folders.map((folder) => (folder.id === 'root' ? { ...folder, title } : folder)),
  };
}

describe('Folder hierarchy rules', () => {
  test('Dropping a folder onto its own lower edge produces no move operation', (t) => {
    const browser = new Window();
    for (const [name, value] of [
      ['HTMLElement', browser.HTMLElement],
      ['MouseEvent', browser.MouseEvent],
      ['DataTransfer', browser.DataTransfer],
    ] as const) {
      const original = Object.getOwnPropertyDescriptor(globalThis, name);
      Object.defineProperty(globalThis, name, { configurable: true, value });
      t.after(() => {
        if (original) {
          Object.defineProperty(globalThis, name, original);
        } else {
          Reflect.deleteProperty(globalThis, name);
        }
      });
    }
    const summary = browser.document.createElement('summary');
    const transfer = new DataTransfer();
    const starting = Object.assign(new MouseEvent('dragstart'), { dataTransfer: transfer });
    const hovering = Object.assign(new MouseEvent('dragover', { clientY: 99 }), {
      dataTransfer: transfer,
    });
    Object.defineProperty(hovering, 'currentTarget', { value: summary });
    const drag = new FolderDrag();

    drag.start(starting, 'child', false);
    drag.over(hovering, folders, folders[1]);

    assert.equal(drag.target(), null);
    assert.equal(drag.drop(hovering), null);
    assert.equal(drag.dragging(), null);
  });

  for (const parentId of ['root', 'child', 'leaf']) {
    test(`Moving root into ${parentId} is rejected without introducing a cycle`, () => {
      assert.equal(canMoveFolder(folders, 'root', parentId), false);
    });
  }

  test('Reparenting and sibling positions use stable IDs', () => {
    assert.equal(canMoveFolder(folders, 'child', null, 'other'), true);
    assert.equal(canMoveFolder(folders, 'child', 'other'), true);
    assert.equal(canMoveFolder(folders, 'child', null, 'leaf'), false);
    assert.equal(canMoveFolder(folders, 'child', null, 'child'), false);
  });

  for (const snapshot of [
    { revision: 1, folders: [{ id: 'a', title: 'A', parentId: 'missing' }] },
    {
      revision: 1,
      folders: [
        { id: 'a', title: 'A', parentId: 'b' },
        { id: 'b', title: 'B', parentId: 'a' },
      ],
    },
    {
      revision: 1,
      folders: [
        { id: 'a', title: 'A', parentId: null },
        { id: 'a', title: 'Again', parentId: null },
      ],
    },
  ]) {
    test(`Malformed hierarchy ${JSON.stringify(snapshot.folders)} is rejected`, () => {
      assert.equal(isFolderSnapshot({ ...snapshot, materialOrder: [] }), false);
    });
  }
});

describe('Folder operation recovery and confirmation', () => {
  test('Rename persists its request before sending and publishes only confirmed folders', async (t) => {
    const { management, transport, store } = fixture(t);

    const saving = management.execute({ kind: 'rename', folderId: 'root', title: 'Renamed' });

    assert.deepEqual(JSON.parse(store?.getItem(key) ?? 'null'), transport.requests[0].body);
    assert.equal(management.snapshot().folders[0].title, 'Root');
    assert.equal(
      await management.execute({ kind: 'rename', folderId: 'root', title: 'Other' }),
      false,
    );
    transport.requests[0].response.next(renamed(1));
    assert.equal(await saving, true);
    assert.equal(management.snapshot().revision, 1);
    assert.equal(management.snapshot().folders[0].title, 'Renamed');
    assert.equal(store?.getItem(key), null);
  });

  test('Lost response recovery replays the identical request and refreshes the current hierarchy', async (t) => {
    const { management, transport, store } = fixture(t);
    assert.ok(store);
    const saving = management.execute({ kind: 'rename', folderId: 'root', title: 'Renamed' });
    transport.requests[0].response.error(new HttpErrorResponse({ status: 0 }));
    assert.equal(await saving, false);
    assert.equal(management.error(), 'uncertain');

    const restored = new FolderManagement('campaign', transport.client, store, () => {});
    restored.accept(renamed(3, 'Newer'));
    t.after(() => restored.destroy());
    const retrying = restored.retry();
    assert.deepEqual(transport.requests[1].body, transport.requests[0].body);
    transport.requests[1].response.next(renamed(1));
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(transport.requests[2].method, 'GET');
    transport.requests[2].response.next(renamed(3, 'Newer'));

    assert.equal(await retrying, true);
    assert.equal(restored.snapshot().revision, 3);
    assert.equal(restored.snapshot().folders[0].title, 'Newer');
    assert.equal(restored.locked(), false);
  });

  test('Revision conflict preserves confirmed folders until an explicit successful refresh', async (t) => {
    const { management, transport, store } = fixture(t);
    const saving = management.execute({ kind: 'rename', folderId: 'root', title: 'Renamed' });
    transport.requests[0].response.error(
      new HttpErrorResponse({ status: 409, error: { code: 'folder_revision_conflict' } }),
    );
    assert.equal(await saving, false);
    assert.equal(management.error(), 'conflict');
    assert.equal(management.snapshot().revision, 0);
    assert.equal(store?.getItem(key), null);

    const refreshing = management.refresh();
    transport.requests[1].response.next(renamed(1, 'Remote'));
    await refreshing;

    assert.equal(management.error(), null);
    assert.equal(management.snapshot().folders[0].title, 'Remote');
  });

  test('Earlier snapshots and divergent same-revision snapshots cannot replace confirmed folders', (t) => {
    const { management } = fixture(t);
    assert.equal(management.accept(renamed(2)), true);

    assert.equal(management.accept(renamed(1, 'Stale')), false);
    assert.equal(management.accept(renamed(2, 'Divergent')), false);

    assert.equal(management.snapshot().folders[0].title, 'Renamed');
    assert.equal(management.snapshot().revision, 2);
  });

  test('Unavailable recovery storage prevents sending an operation', async (t) => {
    const { management, transport } = fixture(t, null);

    assert.equal(
      await management.execute({ kind: 'rename', folderId: 'root', title: 'Renamed' }),
      false,
    );

    assert.equal(management.error(), 'storageUnavailable');
    assert.equal(transport.requests.length, 0);
  });

  for (const [name, response] of [
    ['unexpected revision jump', renamed(2)],
    ['mismatched operation', renamed(1, 'Wrong title')],
  ] as const) {
    test(`${name} retains the exact recovery request and reports uncertainty`, async (t) => {
      const { management, transport, store } = fixture(t);
      const saving = management.execute({ kind: 'rename', folderId: 'root', title: 'Renamed' });

      transport.requests[0].response.next(response);

      assert.equal(await saving, false);
      assert.equal(management.error(), 'uncertain');
      assert.equal(management.snapshot().revision, 0);
      assert.deepEqual(JSON.parse(store?.getItem(key) ?? 'null'), transport.requests[0].body);
    });
  }

  test('Divergent same-revision successful response cannot clear a pending recovery identity', async (t) => {
    const { management, transport, store } = fixture(t);
    const saving = management.execute({ kind: 'rename', folderId: 'root', title: 'Renamed' });
    management.accept(renamed(1, 'Other confirmation'));

    transport.requests[0].response.next(renamed(1));

    assert.equal(await saving, false);
    assert.equal(management.snapshot().folders[0].title, 'Other confirmation');
    assert.equal(management.error(), 'uncertain');
    assert.notEqual(store?.getItem(key), null);
  });

  test('Divergent refresh retains its visible error and the earlier confirmed hierarchy', async (t) => {
    const { management, transport } = fixture(t);
    management.accept(renamed(1));
    const refreshing = management.refresh();

    transport.requests[0].response.next(renamed(1, 'Divergent'));
    await refreshing;

    assert.equal(management.error(), 'loadFailed');
    assert.equal(management.snapshot().folders[0].title, 'Renamed');
  });

  test('An unrecognized rejection keeps recovery rather than assuming the operation was rejected', async (t) => {
    const { management, transport, store } = fixture(t);
    const saving = management.execute({ kind: 'rename', folderId: 'root', title: 'Renamed' });

    transport.requests[0].response.error(
      new HttpErrorResponse({ status: 409, error: { code: 'unknown_failure' } }),
    );

    assert.equal(await saving, false);
    assert.equal(management.error(), 'uncertain');
    assert.notEqual(store?.getItem(key), null);
  });

  test('Cyclic move is rejected before sending and leaves hierarchy intact', async (t) => {
    const { management, transport } = fixture(t);

    assert.equal(
      await management.execute({
        kind: 'move',
        folderId: 'root',
        parentId: 'leaf',
        beforeId: null,
      }),
      false,
    );

    assert.equal(management.error(), 'invalid');
    assert.deepEqual(management.snapshot().folders, folders);
    assert.equal(transport.requests.length, 0);
  });

  test('Unreadable recovery blocks new operations until explicitly removed', async (t) => {
    const store = storage();
    store.setItem(key, '{broken');
    const { management, transport } = fixture(t, store);

    assert.equal(
      await management.execute({ kind: 'rename', folderId: 'root', title: 'Renamed' }),
      false,
    );
    assert.equal(management.invalidRecovery(), true);
    assert.equal(transport.requests.length, 0);
    management.discardUnreadable();

    assert.equal(management.locked(), false);
    assert.equal(store.getItem(key), null);
  });
});

describe('Confirmed hierarchy and document memory', () => {
  const description: WorkspaceDto = {
    campaignId: 'campaign',
    title: 'Campaign',
    moduleId: 'test',
    moduleVersion: '1',
    startMaterialId: 'initial',
    foldersRevision: 0,
    folders,
    materials: [],
    maps: [],
  };

  test('Late workspace refresh cannot revert an already confirmed folder update', async (t) => {
    const transport = new ControlledHttp((body) => body);
    const materials = new WorkspaceMaterials(transport.client);
    t.after(() => materials.destroy());
    const initializing = materials.initialize(description);
    transport.requests[0].response.next([]);
    await initializing;
    const refreshing = materials.initialize(description);
    materials.acceptFolders(renamed(1));

    transport.requests[1].response.next([]);
    await refreshing;

    assert.equal(materials.workspace()?.foldersRevision, 1);
    assert.equal(materials.workspace()?.folders[0].title, 'Renamed');
  });

  test('Invalid workspace hierarchy is rejected before document reads or publication', async (t) => {
    const transport = new ControlledHttp((body) => body);
    const materials = new WorkspaceMaterials(transport.client);
    t.after(() => materials.destroy());

    await assert.rejects(
      materials.initialize({
        ...description,
        foldersRevision: 2,
        folders: [{ id: 'broken', title: 'Broken', parentId: 'missing' }],
      }),
      /folder hierarchy is invalid/,
    );

    assert.equal(materials.workspace(), null);
    assert.equal(transport.requests.length, 0);
  });
});

describe('Context note destination', () => {
  test('Explicit folder selection changes an unsent draft destination while retaining its title', (t) => {
    const transport = new ControlledHttp((body) => body);
    const creation = new MaterialCreation('campaign', transport.client, storage());
    t.after(() => creation.destroy());
    creation.setTitle('Unsent draft');
    creation.setFolder('root');

    creation.setFolder('child');

    assert.equal(creation.title(), 'Unsent draft');
    assert.equal(creation.folderId(), 'child');
  });

  test('Explicit folder selection cannot change uncertain creation recovery', async (t) => {
    const transport = new ControlledHttp((body) => body);
    const creation = new MaterialCreation('campaign', transport.client, storage());
    t.after(() => creation.destroy());
    creation.setTitle('Pending draft');
    creation.setFolder('root');
    const creating = creation.create(['root', 'child']);
    transport.requests[0].response.error(new HttpErrorResponse({ status: 0 }));
    await creating;

    creation.setFolder('child');

    assert.equal(creation.folderId(), 'root');
    assert.equal(creation.request()?.folderId, 'root');
  });
});
