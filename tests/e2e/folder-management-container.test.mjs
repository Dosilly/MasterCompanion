import assert from 'node:assert/strict';
import test from 'node:test';

const base = new URL(process.env.MC_CONTAINER_URL ?? 'http://localhost:4200');
assert.ok(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname),
  'Folder runtime verification must target a loopback HTTP endpoint.');

test('Deployed folder snapshot exposes the workspace hierarchy revision and stable IDs', async () => {
  const workspaceResponse = await fetch(new URL('/api/workspace', base), {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(workspaceResponse.status, 200);
  const workspace = await workspaceResponse.json();

  const folderResponse = await fetch(new URL(`/api/campaigns/${workspace.campaignId}/folders`, base), {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(folderResponse.status, 200);
  const snapshot = await folderResponse.json();

  assert.ok(Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0);
  assert.ok(snapshot.revision >= workspace.foldersRevision);
  assert.equal(new Set(snapshot.folders.map(folder => folder.id)).size, snapshot.folders.length);
  const ids = new Set(snapshot.folders.map(folder => folder.id));
  for (const folder of snapshot.folders) {
    assert.equal(typeof folder.title, 'string');
    assert.ok(folder.title.trim().length > 0);
    assert.ok(folder.parentId === null || ids.has(folder.parentId));
  }
  if (snapshot.revision === workspace.foldersRevision) {
    assert.deepEqual(snapshot.folders, workspace.folders);
  }
});
