import assert from 'node:assert/strict';
import test from 'node:test';

// All probes are reads. They can run against the existing campaign safely.
const base = new URL(process.env.MC_CONTAINER_URL ?? 'http://localhost:4200');
assert.ok(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname),
  'Container verification must target a loopback HTTP endpoint.');
const request = path => fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000) });

test('Container health and root document are available on the same origin', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  const page = await request('/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /^text\/html/);
  const html = await page.text();
  assert.match(html, /<mc-app><\/mc-app>/);
  assert.match(html, /<title>MasterCompanion<\/title>/);
});

test('Production JavaScript and stylesheet assets are served locally', async () => {
  const html = await (await request('/')).text();
  const paths = new Set([...html.matchAll(/(?:src|href)="([^"<>]+\.(?:js|css))"/g)].map(match => match[1]));
  assert.ok(paths.size >= 2, 'The production document must reference JavaScript and styles.');
  for (const path of paths) {
    const asset = new URL(path, base);
    assert.equal(asset.origin, base.origin, 'Runtime assets must remain on the local application origin.');
    const response = await request(asset.href);
    assert.equal(response.status, 200, `Asset is unavailable: ${asset.pathname}`);
    assert.match(response.headers.get('content-type') ?? '', path.endsWith('.css') ? /^text\/css/ : /javascript/);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
});

test('SPA navigation is supported without masking missing API routes or assets', async () => {
  const route = await request('/campaign');
  assert.equal(route.status, 200);
  assert.match(await route.text(), /<mc-app><\/mc-app>/);
  for (const path of ['/api/container-verification-missing', '/missing-container-asset.js']) {
    const missing = await request(path);
    assert.equal(missing.status, 404, `Missing path must remain a failure: ${path}`);
    assert.doesNotMatch(await missing.text(), /<mc-app>/);
  }
});

test('Campaign materials, map assets and gameplay are readable through the container', async () => {
  const response = await request('/api/workspace');
  assert.equal(response.status, 200);
  const workspace = await response.json();
  assert.ok(Array.isArray(workspace.materials) && workspace.materials.length > 0);
  assert.equal(typeof workspace.campaignId, 'string');
  assert.equal(typeof workspace.startMaterialId, 'string');
  const material = await request(`/api/materials/${encodeURIComponent(workspace.startMaterialId)}`);
  assert.equal(material.status, 200);
  const document = await material.json();
  assert.equal(document.id, workspace.startMaterialId);
  assert.ok(Number.isSafeInteger(document.revision));
  assert.equal(document.document.type, 'doc');
  const game = await request(`/api/campaigns/${encodeURIComponent(workspace.campaignId)}/game`);
  assert.equal(game.status, 200);
  assert.ok(Number.isSafeInteger((await game.json()).revision));
  for (const map of workspace.maps) {
    const asset = await request(`/api/assets/${encodeURIComponent(map.assetId)}`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type') ?? '', /^image\//);
    assert.ok((await asset.arrayBuffer()).byteLength > 0);
  }
});
