import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';

// Cache only the dedicated UI bundle. Live frontend output and API processes are unrelated.
export function sourceFingerprint(root) {
  const hash = createHash('sha256').update(process.version).update(readFileSync(new URL(import.meta.url)));
  function add(path) {
    hash.update(relative(root, path)).update(readFileSync(path));
  }
  function directory(path) {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (['node_modules', 'dist', '.angular', '.local', 'out-tsc'].includes(entry.name)) continue;
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) directory(child);
      else add(child);
    }
  }
  for (const name of ['src', 'projects']) directory(resolve(root, name));
  for (const name of readdirSync(root).sort()) {
    if (['angular.json', 'package.json', 'pnpm-lock.yaml'].includes(name) || /^tsconfig.*\.json$/.test(name)) add(resolve(root, name));
  }
  for (const name of ['build.mjs', 'check-code-policy.mjs', 'check-boundaries.mjs']) add(resolve(root, 'tools', name));
  return hash.digest('hex');
}

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.woff2', 'font/woff2'], ['.ico', 'image/x-icon'],
]);

export function createUiServer(directory) {
  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end(); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname); }
    catch { response.writeHead(400).end(); return; }
    // There is deliberately no backend or proxy. Missing test API mocks must fail.
    if (pathname.startsWith('/api/') || pathname.includes('\\')) { response.writeHead(404).end(); return; }
    const path = resolve(directory, pathname === '/' ? 'index.html' : `.${pathname}`);
    const local = relative(directory, path);
    if (isAbsolute(local) || local.startsWith('..')) { response.writeHead(404).end(); return; }
    try {
      if (!(await stat(path)).isFile()) { response.writeHead(404).end(); return; }
      const body = await readFile(path);
      response.writeHead(200, { 'Content-Type': mimeTypes.get(extname(path)) ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') { response.writeHead(404).end(); return; }
      console.error('Could not serve UI test asset.', error);
      response.writeHead(500).end();
    }
  });
}

if (import.meta.main) {
  const root = process.cwd();
  const directory = resolve(root, '.local/ui-web/browser');
  const fingerprintPath = resolve(root, '.local/ui-build.sha256');
  const fingerprint = sourceFingerprint(root);
  const { buildLibraries, ng } = await import('./build.mjs');
  if (!existsSync(resolve(directory, 'index.html')) || !existsSync(fingerprintPath) || readFileSync(fingerprintPath, 'utf8') !== fingerprint) {
    buildLibraries();
    ng(['build', 'web', '--output-path', '.local/ui-web']);
    mkdirSync(resolve(root, '.local'), { recursive: true });
    writeFileSync(fingerprintPath, fingerprint);
    console.log('Built current UI test bundle.');
  } else console.log('Reusing unchanged UI test bundle.');
  const server = createUiServer(directory);
  server.on('error', error => { console.error('Could not start isolated UI test server.', error); process.exitCode = 1; });
  server.listen(4310, '127.0.0.1', () => console.log('UI test server: http://127.0.0.1:4310'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close());
}
