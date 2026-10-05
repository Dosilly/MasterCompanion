import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FolderSnapshot } from '@mastercompanion/contracts';
import {
  canMoveMaterial,
  confirmsFolderOperation,
  isFolderOperation,
} from '../../projects/engine/src/lib/features/folders/folder-rules';

const snapshot: FolderSnapshot = {
  revision: 1,
  folders: [{ id: 'destination', title: 'Destination', parentId: null }],
  materialOrder: [
    { id: 'source', folderId: null },
    { id: 'target', folderId: 'destination' },
  ],
};

describe('Material placement validation', () => {
  for (const [name, id, folderId, beforeId, expected] of [
    ['another folder', 'source', 'destination', 'target', true],
    ['unfiled destination', 'target', null, null, true],
    ['foreign folder', 'source', 'foreign', null, false],
    ['foreign material', 'foreign', 'destination', null, false],
    ['wrong sibling folder', 'target', 'destination', 'source', false],
    ['self insertion', 'source', null, 'source', false],
  ] as const) {
    test(name, () => {
      assert.equal(canMoveMaterial(snapshot, id, folderId, beforeId), expected);
    });
  }
  test('Receipt confirmation requires both folder and insertion position', () => {
    const operation = {
      kind: 'moveMaterial',
      materialId: 'source',
      folderId: 'destination',
      beforeId: 'target',
    } as const;
    assert.equal(isFolderOperation(operation), true);
    assert.equal(confirmsFolderOperation(snapshot, operation), false);
    const confirmed = {
      ...snapshot,
      materialOrder: [{ id: 'source', folderId: 'destination' }, snapshot.materialOrder[1]],
    };
    assert.equal(confirmsFolderOperation(confirmed, operation), true);
  });
});
