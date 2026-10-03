import assert from 'node:assert/strict';
import test from 'node:test';

// All probes are reads. They can run against the existing campaign safely.
const base = new URL(process.env.MC_CONTAINER_URL ?? 'http://localhost:4200');
assert.ok(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname),
  'Container verification must target a loopback HTTP endpoint.');
const request = path => fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000) });

test('Container health and root document are available on the same origin', async () => {
  // Act
  const health = await request('/health');
  
  // Assert
  assert.equal(health.status, 200);
  
  // Act
  const page = await request('/');
  
  // Assert
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /^text\/html/);
  
  // Act
  const html = await page.text();
  
  // Assert
  assert.match(html, /<mc-app><\/mc-app>/);
  assert.match(html, /<title>MasterCompanion<\/title>/);
});

test('Production JavaScript and stylesheet assets are served locally', async () => {
  // Act
  const html = await (await request('/')).text();
  
  // Arrange
  const paths = new Set([...html.matchAll(/(?:src|href)="([^"<>]+\.(?:js|css))"/g)].map(match => match[1]));
  
  // Assert
  assert.ok(paths.size >= 2, 'The production document must reference JavaScript and styles.');
  for (const path of paths) {
    // Arrange
    const asset = new URL(path, base);
    
    // Assert
    assert.equal(asset.origin, base.origin, 'Runtime assets must remain on the local application origin.');
    
    // Act
    const response = await request(asset.href);
    
    // Assert
    assert.equal(response.status, 200, `Asset is unavailable: ${asset.pathname}`);
    assert.match(response.headers.get('content-type') ?? '', path.endsWith('.css') ? /^text\/css/ : /javascript/);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
});

test('SPA navigation is supported without masking missing API routes or assets', async () => {
  // Act
  const route = await request('/campaign');
  
  // Assert
  assert.equal(route.status, 200);
  // Act
  const actual1 = await route.text();

  // Assert
  assert.match(actual1, /<mc-app><\/mc-app>/);
  for (const path of ['/api/container-verification-missing', '/missing-container-asset.js']) {
    // Act
    const missing = await request(path);
    
    // Assert
    assert.equal(missing.status, 404, `Missing path must remain a failure: ${path}`);
    assert.doesNotMatch(await missing.text(), /<mc-app>/);
  }
});

test('Campaign materials, map assets and gameplay are readable through the container', async () => {
  // Act
  const response = await request('/api/workspace');
  
  // Assert
  assert.equal(response.status, 200);
  
  // Act
  const workspace = await response.json();
  
  // Assert
  assert.ok(Array.isArray(workspace.materials) && workspace.materials.length > 0);
  assert.equal(typeof workspace.campaignId, 'string');
  assert.equal(typeof workspace.startMaterialId, 'string');
  
  // Act
  const material = await request(`/api/materials/${encodeURIComponent(workspace.startMaterialId)}`);
  
  // Assert
  assert.equal(material.status, 200);
  
  // Act
  const document = await material.json();
  
  // Assert
  assert.equal(document.id, workspace.startMaterialId);
  assert.ok(Number.isSafeInteger(document.revision));
  assert.equal(document.document.type, 'doc');
  
  // Act
  const game = await request(`/api/campaigns/${encodeURIComponent(workspace.campaignId)}/game`);
  
  // Assert
  assert.equal(game.status, 200);
  assert.ok(Number.isSafeInteger((await game.json()).revision));
  for (const map of workspace.maps) {
    // Act
    const asset = await request(`/api/assets/${encodeURIComponent(map.assetId)}`);
    
    // Assert
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type') ?? '', /^image\//);
    assert.ok((await asset.arrayBuffer()).byteLength > 0);
  }
});
