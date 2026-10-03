import '@angular/compiler';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import { Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

mkdirSync('.local/tests', { recursive: true });
const compiled = resolve('.local/tests/material-creation.mjs');
writeFileSync(compiled, ts.transpileModule(readFileSync('projects/engine/src/lib/features/materials/material-creation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace('../../editor-schema.mjs', pathToFileURL(resolve('projects/engine/src/lib/editor-schema.mjs')).href));
const { MaterialCreation, isCreationRequest } = await import(pathToFileURL(compiled));
const campaignId = '00000000-0000-0000-0000-000000000001';
const key = `mastercompanion.material.pending.${campaignId}`;
const id = '01234567-89ab-cdef-0123-456789abcdef';
const paragraph = text => ({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] });
function storage() {
  const entries = new Map();
  return { entries, getItem: name => entries.get(name) ?? null, setItem: (name, value) => entries.set(name, value), removeItem: name => entries.delete(name) };
}
function fixture(store = storage(), campaign = campaignId) {
  const requests = [];
  const http = { post(url, body) {
    const response = new Subject();
    requests.push({ url, body, response });
    assert.deepEqual(JSON.parse(store.getItem(`mastercompanion.material.pending.${campaign}`)), body, 'Recovery must exist before sending.');
    return response;
  } };
  return { creation: new MaterialCreation(campaign, http, store), requests, store };
}
function result(request, revision = 1, text = '') {
  return { id: `note-${request.body.id}`, title: request.body.title, folderId: request.body.folderId, group: '',
    documentSchemaVersion: 1, revision, document: paragraph(text) };
}
function receive(request, value = result(request)) { request.response.next(value); request.response.complete(); }
function reject(request, status, code) { request.response.error(new HttpErrorResponse({ status, error: code ? { code } : undefined })); }

test('Creation trims a title, uses the chosen stable folder and blocks repeated submissions', async () => {
  const f = fixture();
  f.creation.setTitle('  Session notes  ');
  f.creation.setFolder('folder:existing');
  const creating = f.creation.create(['folder:existing']);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, `/api/campaigns/${campaignId}/materials`);
  assert.match(f.requests[0].body.id, /^[0-9a-f-]{36}$/);
  assert.equal(f.requests[0].body.title, 'Session notes');
  assert.equal(f.requests[0].body.folderId, 'folder:existing');
  assert.equal(await f.creation.create(['folder:existing']), null);
  f.creation.setTitle('Attempted replacement'); f.creation.setFolder(null);
  assert.equal(f.creation.title(), 'Session notes');
  assert.equal(f.creation.folderId(), 'folder:existing');
  receive(f.requests[0]);
  const material = await creating;
  assert.equal(material.id, `note-${f.requests[0].body.id}`);
  assert.equal(f.creation.pending(), false);
  assert.equal(f.creation.hasRecovery(), false);
  assert.equal(f.creation.title(), '');
  assert.equal(f.store.entries.size, 0);
});

test('Lost responses retain one exact identity and replay current content and revision after reload', async () => {
  const f = fixture(); f.creation.setTitle('New note');
  const creating = f.creation.create([]);
  const original = structuredClone(f.requests[0].body);
  reject(f.requests[0], 0);
  assert.equal(await creating, null);
  assert.equal(f.creation.error(), 'uncertain');
  assert.equal(f.creation.locked(), true);
  assert.equal(await f.creation.create([]), null);
  f.creation.destroy();
  const resumed = fixture(f.store);
  assert.equal(resumed.creation.title(), 'New note');
  assert.equal(resumed.creation.hasRecovery(), true);
  const retry = resumed.creation.retry();
  assert.deepEqual(resumed.requests[0].body, original);
  receive(resumed.requests[0], result(resumed.requests[0], 7, 'Edited in another window'));
  const material = await retry;
  assert.equal(material.revision, 7);
  assert.deepEqual(material.document, paragraph('Edited in another window'));
});

test('Expected server rejections unlock the original draft and expose localized error identifiers', async () => {
  for (const [status, code, expected] of [
    [400, 'invalid_material_creation', 'rejected'], [400, 'material_folder_not_found', 'invalidFolder'],
    [404, 'campaign_not_found', 'campaignMissing'], [409, 'material_creation_conflict', 'identityConflict'],
    [413, 'material_request_too_large', 'rejected'], [415, 'material_json_required', 'rejected'],
  ]) {
    const f = fixture(); f.creation.setTitle('Preserved title');
    const creating = f.creation.create([]);
    reject(f.requests[0], status, code);
    assert.equal(await creating, null);
    assert.equal(f.creation.error(), expected);
    assert.equal(f.creation.title(), 'Preserved title');
    assert.equal(f.creation.locked(), false);
    assert.equal(f.store.entries.size, 0);
  }
});

test('Unexpected HTTP errors and invalid successful responses retain the exact recovery request', async () => {
  for (const [status, code] of [[503, undefined], [400, 'unknown_code'], [404, undefined], [409, 'other_conflict']]) {
    const f = fixture(); f.creation.setTitle('Recoverable');
    const creating = f.creation.create([]);
    reject(f.requests[0], status, code);
    assert.equal(await creating, null);
    assert.equal(f.creation.error(), 'uncertain');
    assert.ok(f.creation.hasRecovery());
  }
  for (const mutate of [value => value.id = 'wrong', value => value.revision = 0,
    value => value.title = 'wrong', value => value.folderId = 'wrong', value => value.documentSchemaVersion = 2,
    value => value.document = { type: 'paragraph', content: [] }, value => value.document = { type: 'doc', content: [{ type: 'script' }] }]) {
    const f = fixture(); f.creation.setTitle('Recoverable');
    const creating = f.creation.create([]);
    const value = result(f.requests[0]); mutate(value);
    receive(f.requests[0], value);
    assert.equal(await creating, null);
    assert.equal(f.creation.error(), 'invalidResponse');
    assert.ok(f.creation.hasRecovery());
  }
});

test('Unavailable recovery storage prevents writes and preserves input', async () => {
  const store = storage(); store.setItem = () => { throw new Error('Storage disabled'); };
  const f = fixture(store); f.creation.setTitle('Kept title');
  assert.equal(await f.creation.create([]), null);
  assert.equal(f.requests.length, 0);
  assert.equal(f.creation.title(), 'Kept title');
  assert.equal(f.creation.error(), 'storageUnavailable');
  assert.equal(f.creation.locked(), false);
});

test('Failure removing recovery storage does not falsely confirm creation', async () => {
  const f = fixture(); f.creation.setTitle('Kept title');
  f.store.removeItem = () => { throw new Error('Storage removal failed'); };
  const creating = f.creation.create([]); receive(f.requests[0]);
  assert.equal(await creating, null);
  assert.equal(f.creation.error(), 'storageUnavailable');
  assert.equal(f.creation.title(), 'Kept title');
  assert.equal(f.creation.hasRecovery(), true);
});

test('Invalid recovery requests block writes until explicitly discarded', async () => {
  const store = storage(); store.entries.set(key, '{broken');
  const f = fixture(store);
  assert.equal(f.creation.invalidPending(), true);
  assert.equal(await f.creation.create([]), null);
  assert.equal(f.creation.discardUnreadable(), true);
  assert.equal(f.creation.hasRecovery(), false);
  assert.equal(f.store.entries.size, 0);
  assert.equal(f.requests.length, 0);
});

test('Pending requests are campaign scoped and destruction cancels observation without discarding recovery', async () => {
  const f = fixture(); f.creation.setTitle('Pending title');
  const creating = f.creation.create([]);
  const other = fixture(f.store, '00000000-0000-0000-0000-000000000002');
  assert.equal(other.creation.hasRecovery(), false);
  f.creation.destroy();
  assert.equal(await creating, null);
  assert.ok(f.store.entries.has(key));
  receive(f.requests[0]);
  assert.equal(f.creation.title(), 'Pending title');
  assert.equal(await f.creation.retry(), null);
});

test('Boundary validation rejects unsupported titles and unknown folders before sending', async () => {
  const f = fixture();
  for (const title of ['', '   ', 'x'.repeat(301), 'title\u0085control', 'title\ncontrol']) {
    f.creation.setTitle(title);
    assert.equal(await f.creation.create([]), null);
    assert.equal(f.creation.error(), 'invalidTitle');
  }
  f.creation.setTitle('Valid title'); f.creation.setFolder('missing');
  assert.equal(await f.creation.create([]), null);
  assert.equal(f.creation.error(), 'invalidFolder');
  assert.equal(f.requests.length, 0);
  assert.equal(isCreationRequest({ id, title: 'Valid title', folderId: null }), true);
  assert.equal(isCreationRequest({ id, title: 'Valid title', folderId: 'nonascii-folder-æ' }), true);
  for (const value of [null, { id, title: 'Valid title' }, { id, title: 'Valid title', folderId: null, extra: true },
    { id: id.toUpperCase(), title: 'Valid title', folderId: null }, { id, title: ' untrimmed ', folderId: null }]) {
    assert.equal(isCreationRequest(value), false);
  }
});
