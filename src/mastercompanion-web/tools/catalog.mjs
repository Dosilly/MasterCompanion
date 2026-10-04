import { ng } from './build.mjs';

ng(['build', 'ui']);
ng(['serve', 'ui-catalog', '--host', '127.0.0.1', '--port', '4311']);
