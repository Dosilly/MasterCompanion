import assert from 'node:assert/strict';
import test from 'node:test';

const base = new URL(process.env.MC_CONTAINER_URL ?? 'http://localhost:4200');
assert.ok(
  base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname),
  'Search verification must target a loopback HTTP endpoint.',
);

function request(path) {
  return fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000) });
}

test('Container search finds a persisted title without changing its document or revision', async () => {
  const workspaceResponse = await request('/api/workspace');
  assert.equal(workspaceResponse.status, 200);
  const workspace = await workspaceResponse.json();
  const materialPath = `/api/materials/${encodeURIComponent(workspace.startMaterialId)}`;
  const beforeResponse = await request(materialPath);
  assert.equal(beforeResponse.status, 200);
  const before = await beforeResponse.json();
  const query = before.title.trim().slice(0, 160);
  assert.ok(query.length > 0, 'The start material must have a searchable title.');

  const response = await request(
    `/api/campaigns/${encodeURIComponent(workspace.campaignId)}/materials/search?${new URLSearchParams({ query })}`,
  );

  assert.equal(response.status, 200);
  const search = await response.json();
  assert.equal(typeof search.hasMore, 'boolean');
  assert.ok(Array.isArray(search.results));
  assert.ok(search.results.length <= 50);
  const match = search.results.find((result) => result.id === before.id);
  assert.ok(match, 'The current persisted start material title must be searchable.');
  assert.equal(match.title, before.title);
  assert.equal(typeof match.snippet, 'string');
  assert.ok(match.snippet.length <= 200);
  const afterResponse = await request(materialPath);
  assert.equal(afterResponse.status, 200);
  assert.deepEqual(await afterResponse.json(), before);
});

test('Container search rejects an empty query with a stable validation code', async () => {
  const workspaceResponse = await request('/api/workspace');
  assert.equal(workspaceResponse.status, 200);
  const workspace = await workspaceResponse.json();

  const response = await request(
    `/api/campaigns/${encodeURIComponent(workspace.campaignId)}/materials/search?query=`,
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'invalid_search_query');
});
