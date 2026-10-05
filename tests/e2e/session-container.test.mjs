import assert from 'node:assert/strict';
import { test } from 'node:test';

const base = new URL(process.env.MC_CONTAINER_URL ?? 'http://localhost:4200');
assert.ok(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname),
  'Container checks must target a loopback HTTP endpoint.');
const request = (path) => fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000) });

test('Session deep route serves the SPA and the application is ready', async () => {
  const health = await request('/health');
  const response = await request('/sessions');

  assert.equal(health.status, 200);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html/);
  assert.match(await response.text(), /<mc-app><\/mc-app>/);
});

test('Session collection is readable with stable campaign material references', async () => {
  const workspaceResponse = await request('/api/workspace');
  assert.equal(workspaceResponse.status, 200);
  const workspace = await workspaceResponse.json();

  const response = await request(`/api/campaigns/${workspace.campaignId}/sessions`);
  assert.equal(response.status, 200);
  const snapshot = await response.json();

  assert.ok(Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0);
  assert.ok(Array.isArray(snapshot.sessions));
  assert.ok(snapshot.sessions.filter((item) => item.status === 'active').length <= 1);
  const materials = new Set(workspace.materials.map((item) => item.id));
  for (const session of snapshot.sessions) {
    assert.ok(['planned', 'active', 'completed'].includes(session.status));
    assert.ok(materials.has(session.preparationMaterialId));
    assert.ok(materials.has(session.notesMaterialId));
    for (const materialId of session.pinnedMaterialIds) {
      assert.ok(materials.has(materialId));
    }
  }
});

test('An unknown campaign has a session-specific HTTP failure', async () => {
  const response = await request('/api/campaigns/00000000-0000-0000-0000-000000000000/sessions');

  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'campaign_not_found');
});
