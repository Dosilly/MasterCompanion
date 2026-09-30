import '@angular/compiler';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import { Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

// Compile the actual class, without exposing this implementation through the library's public API.
mkdirSync('.local/tests', { recursive: true });
const compiled = resolve('.local/tests/material-session.mjs');
writeFileSync(compiled, ts.transpileModule(readFileSync('projects/engine/src/lib/features/materials/material-session.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
const { MaterialSession } = await import(pathToFileURL(compiled));
const document = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
function fixture() {
  const requests = [];
  const http = { put(url, body) { const response = new Subject(); requests.push({ body, response }); return response; } };
  return { requests, session: new MaterialSession({ id: 'note', title: 'Note', group: 'Group', document: document('original'), documentSchemaVersion: 1, revision: 10 }, http) };
}
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
test('Changes during an in-flight save are queued with the confirmed next revision', async () => {
  const { requests, session } = fixture();
  session.change(document('first'));
  const pending = session.flush();
  session.change(document('second'));
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].body.document, document('first'));
  requests[0].response.next({ revision: 11 }); requests[0].response.complete();
  await nextTurn();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.expectedRevision, 11);
  assert.deepEqual(requests[1].body.document, document('second'));
  requests[1].response.next({ revision: 12 }); requests[1].response.complete();
  assert.equal(await pending, true);
  assert.equal(session.status(), 'saved');
  assert.equal(session.dirty(), false);
  await session.flush(); // Clear the debounce belonging to the second edit.
  assert.equal(requests.length, 2);
});
test('A connection failure keeps the draft and can retry without claiming it is saved', async () => {
  const { requests, session } = fixture();
  session.change(document('draft'));
  const pending = session.flush();
  requests[0].response.error(new HttpErrorResponse({ status: 0 }));
  assert.equal(await pending, false);
  assert.equal(session.status(), 'error');
  assert.equal(session.error(), 'saveFailed');
  assert.equal(session.dirty(), true);
  assert.deepEqual(session.document, document('draft'));
  const retry = session.flush();
  assert.equal(requests[1].body.expectedRevision, 10);
  requests[1].response.next({ revision: 11 }); requests[1].response.complete();
  assert.equal(await retry, true);
});
test('A revision conflict retains the draft and blocks automatic overwriting', async () => {
  const { requests, session } = fixture();
  session.change(document('my draft'));
  const pending = session.flush();
  requests[0].response.error(new HttpErrorResponse({ status: 409 }));
  assert.equal(await pending, false);
  session.change(document('still my draft'));
  assert.equal(await session.flush(), false);
  assert.equal(requests.length, 1);
  assert.equal(session.status(), 'conflict');
  assert.equal(session.error(), 'saveConflict');
  assert.equal(session.dirty(), true);
  assert.deepEqual(session.document, document('still my draft'));
});

test('Closing during autosave waits for every pending edit and its confirmed revision', async () => {
  const { requests, session } = fixture();
  session.change(document('first'));
  const save = session.flush();
  session.change(document('last edit before closing'));
  let closed = false;
  const closing = session.prepareToClose().then(canClose => { closed = canClose; return canClose; });
  assert.equal(closed, false);
  requests[0].response.next({ revision: 11 }); requests[0].response.complete();
  await nextTurn();
  assert.equal(closed, false);
  assert.deepEqual(requests[1].body.document, document('last edit before closing'));
  requests[1].response.next({ revision: 12 }); requests[1].response.complete();
  assert.equal(await save, true);
  assert.equal(await closing, true);
  assert.equal(session.dirty(), false);
});

test('Closing after a save failure or conflict keeps the unsaved material open', async () => {
  for (const status of [0, 409]) {
    const { requests, session } = fixture();
    session.change(document('unsaved draft'));
    const closing = session.prepareToClose();
    requests[0].response.error(new HttpErrorResponse({ status }));
    assert.equal(await closing, false);
    assert.equal(session.dirty(), true);
    assert.deepEqual(session.document, document('unsaved draft'));
  }
});
