import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { sourceFingerprint, createUiServer } from '../../tools/ui-server.mjs';
function directory(t) {
  const path = mkdtempSync(resolve(tmpdir(), 'mastercompanion-ui-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

async function serve(t, web) {
  const server = createUiServer(web);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolveClose, reject) =>
        server.close((error) => (error ? reject(error) : resolveClose())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
describe('Isolated UI test server', () => {
  for (const path of [
    '/materials/ui-reader',
    '/materials/module:note.one',
    '/maps/map.one',
    '/game',
    '/party',
    '/workspace',
    '/unknown-location',
  ]) {
    test(`Deep link ${path} returns the SPA document for GET and HEAD`, async (t) => {
      const web = directory(t);
      writeFileSync(resolve(web, 'index.html'), '<main>UI fixture</main>');
      const origin = await serve(t, web);

      const response = await fetch(origin + path);
      const head = await fetch(origin + path, { method: 'HEAD' });

      assert.equal(response.status, 200);
      assert.equal(await response.text(), '<main>UI fixture</main>');
      assert.match(response.headers.get('content-type'), /^text\/html/);
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
    });
  }
  test('UI build cache changes with source, localization and dependencies, but not reports', (t) => {
    // Arrange
    const root = directory(t);
    for (const path of ['src', 'projects/engine/i18n', 'tools', '.local'])
      mkdirSync(resolve(root, path), { recursive: true });
    for (const path of [
      'src/main.ts',
      'projects/engine/i18n/pl.json',
      'angular.json',
      'tsconfig.json',
      'package.json',
      'pnpm-lock.yaml',
      'tools/build.mjs',
      'tools/check-code-policy.mjs',
      'tools/check-boundaries.mjs',
    ])
      writeFileSync(resolve(root, path), 'initial');

    // Act
    let previous = sourceFingerprint(root);
    for (const path of [
      'src/main.ts',
      'projects/engine/i18n/pl.json',
      'angular.json',
      'tsconfig.json',
      'package.json',
      'pnpm-lock.yaml',
      'tools/build.mjs',
    ]) {
      // Act
      writeFileSync(resolve(root, path), 'changed');
      const next = sourceFingerprint(root);

      // Assert
      assert.notEqual(next, previous, `Changes to ${path} must invalidate the UI build cache.`);
      // Arrange
      previous = next;
    }
    writeFileSync(resolve(root, '.local/report.html'), 'report');
    const actual1 = sourceFingerprint(root);

    // Assert
    assert.equal(actual1, previous);
  });
  test('UI server serves static assets and refuses API writes, missing assets and traversal', async (t) => {
    // Arrange
    const root = directory(t);
    const web = resolve(root, 'web');

    // Act
    mkdirSync(web);
    writeFileSync(resolve(web, 'index.html'), '<main>UI fixture</main>');
    writeFileSync(resolve(web, 'app.js'), 'export const fixture = true;');
    writeFileSync(resolve(root, 'outside.txt'), 'private fixture');
    // Arrange
    const origin = await serve(t, web);

    // Act
    const index = await fetch(origin);

    // Assert
    assert.equal(index.status, 200);

    // Act
    const actual1 = await index.text();

    // Assert
    assert.equal(actual1, '<main>UI fixture</main>');
    assert.match((await fetch(`${origin}/app.js`)).headers.get('content-type'), /javascript/);
    assert.equal((await fetch(`${origin}/app.js`, { method: 'HEAD' })).status, 200);
    for (const path of [
      '/api/workspace',
      '/missing.js',
      '/%2e%2e%2foutside.txt',
      '/%2e%2e%5coutside.txt',
    ]) {
      // Assert
      assert.equal((await fetch(origin + path)).status, 404, path);
    }
    assert.equal((await fetch(`${origin}/%GG`)).status, 400);
    assert.equal(
      (await fetch(`${origin}/api/materials/note`, { method: 'PUT', body: '{}' })).status,
      405,
    );
  });
});
