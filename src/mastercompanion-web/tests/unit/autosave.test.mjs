import '@angular/compiler';
import { describe, test } from 'node:test';
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
writeFileSync(
  compiled,
  ts.transpileModule(
    readFileSync('projects/engine/src/lib/features/materials/material-session.ts', 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText,
);
const { MaterialSession } = await import(pathToFileURL(compiled));
const document = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
function fixture() {
  const requests = [];
  const http = {
    put(url, body) {
      const response = new Subject();
      requests.push({ body, response });
      return response;
    },
  };
  return {
    requests,
    session: new MaterialSession(
      {
        id: 'note',
        title: 'Note',
        group: 'Group',
        document: document('original'),
        documentSchemaVersion: 1,
        revision: 10,
      },
      http,
    ),
  };
}
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));
describe('Material autosave', () => {
  test('Changes during an in-flight save are queued with the confirmed next revision', async () => {
    // Arrange
    const { requests, session } = fixture();
    session.change(document('first'));

    // Act
    const pending = session.flush();
    session.change(document('second'));

    // Assert
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].body.document, document('first'));

    // Act
    requests[0].response.next({ revision: 11 });
    requests[0].response.complete();
    await nextTurn();

    // Assert
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.expectedRevision, 11);
    assert.deepEqual(requests[1].body.document, document('second'));

    // Act
    requests[1].response.next({ revision: 12 });
    requests[1].response.complete();
    const actual1 = await pending;

    // Assert
    assert.equal(actual1, true);
    assert.equal(session.status(), 'saved');
    assert.equal(session.dirty(), false);

    // Act
    await session.flush(); // Clear the debounce belonging to the second edit.

    // Assert
    assert.equal(requests.length, 2);
  });
  test('A connection failure keeps the draft and can retry without claiming it is saved', async () => {
    // Arrange
    const { requests, session } = fixture();
    session.change(document('draft'));

    // Act
    const pending = session.flush();
    requests[0].response.error(new HttpErrorResponse({ status: 0 }));
    const actual1 = await pending;

    // Assert
    assert.equal(actual1, false);
    assert.equal(session.status(), 'error');
    assert.equal(session.error(), 'saveFailed');
    assert.equal(session.dirty(), true);
    assert.deepEqual(session.document, document('draft'));

    // Act
    const retry = session.flush();

    // Assert
    assert.equal(requests[1].body.expectedRevision, 10);

    // Act
    requests[1].response.next({ revision: 11 });
    requests[1].response.complete();
    const actual2 = await retry;

    // Assert
    assert.equal(actual2, true);
  });
  test('A revision conflict retains the draft and blocks automatic overwriting', async () => {
    // Arrange
    const { requests, session } = fixture();
    session.change(document('my draft'));

    // Act
    const pending = session.flush();
    requests[0].response.error(new HttpErrorResponse({ status: 409 }));
    const actual1 = await pending;

    // Assert
    assert.equal(actual1, false);

    // Act
    session.change(document('still my draft'));
    const actual2 = await session.flush();

    // Assert
    assert.equal(actual2, false);
    assert.equal(requests.length, 1);
    assert.equal(session.status(), 'conflict');
    assert.equal(session.error(), 'saveConflict');
    assert.equal(session.dirty(), true);
    assert.deepEqual(session.document, document('still my draft'));
  });
  test('Closing during autosave waits for every pending edit and its confirmed revision', async () => {
    // Arrange
    const { requests, session } = fixture();
    session.change(document('first'));

    // Act
    const save = session.flush();
    session.change(document('last edit before closing'));
    // Arrange
    let closed = false;

    // Act
    const closing = session.prepareToClose().then((canClose) => {
      closed = canClose;
      return canClose;
    });

    // Assert
    assert.equal(closed, false);

    // Act
    requests[0].response.next({ revision: 11 });
    requests[0].response.complete();
    await nextTurn();

    // Assert
    assert.equal(closed, false);
    assert.deepEqual(requests[1].body.document, document('last edit before closing'));

    // Act
    requests[1].response.next({ revision: 12 });
    requests[1].response.complete();
    const actual1 = await save;

    // Assert
    assert.equal(actual1, true);

    // Act
    const actual2 = await closing;

    // Assert
    assert.equal(actual2, true);
    assert.equal(session.dirty(), false);
  });
  test('Closing after a save failure or conflict keeps the unsaved material open', async () => {
    // Arrange
    for (const status of [0, 409]) {
      // Arrange
      const { requests, session } = fixture();
      session.change(document('unsaved draft'));

      // Act
      const closing = session.prepareToClose();
      requests[0].response.error(new HttpErrorResponse({ status }));
      const actual1 = await closing;

      // Assert
      assert.equal(actual1, false);
      assert.equal(session.dirty(), true);
      assert.deepEqual(session.document, document('unsaved draft'));
    }
  });
});
