import { mkdirSync, writeFileSync } from 'node:fs';
import { buildLibraries, ng } from './build.mjs';

buildLibraries();
mkdirSync('.local', { recursive: true });
writeFileSync('.local/proxy.json', JSON.stringify({ '/api': { target: process.env.API_BASE_URL ?? 'http://localhost:5142', secure: false, changeOrigin: true } }));
ng(['serve', 'web', '--host', '127.0.0.1', '--port', process.env.PORT ?? '4200', '--proxy-config', '.local/proxy.json']);
