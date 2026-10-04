import '@angular/compiler';
import { describe, test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { MaterialDto, RichDocument } from '@mastercompanion/contracts';
import { ControlledHttp } from '../support/controlled-http';
import { HttpErrorResponse } from '@angular/common/http';
import { MaterialSession } from '../../projects/engine/src/lib/features/materials/material-session';
const document = (text: string): RichDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
interface SaveRequest {
  document: unknown;
  expectedRevision: number;
}
function saveRequest(value: unknown): SaveRequest {
  assert.ok(
    value !== null &&
      typeof value === 'object' &&
      'document' in value &&
      'expectedRevision' in value,
  );
  assert.ok(typeof value.expectedRevision === 'number');
  assert.ok(
    value.document !== null && typeof value.document === 'object' && 'type' in value.document,
  );
  assert.equal(value.document.type, 'doc');
  return { document: value.document, expectedRevision: value.expectedRevision };
}
function fixture(t: TestContext, onConfirmedSave?: (material: MaterialDto) => void) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const transport = new ControlledHttp(saveRequest);
  return {
    requests: transport.requests,
    session: new MaterialSession(
      {
        id: 'note',
        title: 'Note',
        group: 'Group',
        folderId: null,
        document: document('original'),
        documentSchemaVersion: 1,
        revision: 10,
      },
      transport.client,
      onConfirmedSave,
    ),
  };
}
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));
describe('Material autosave', () => {
  test('A queued save failure publishes only the confirmed document while preserving the newer draft', async (t) => {
    const confirmed: MaterialDto[] = [];
    const { requests, session } = fixture(t, (material) => confirmed.push(material));
    session.change(document('first'));

    const pending = session.flush();
    session.change(document('newer draft'));
    requests[0].response.next({ revision: 11 });
    requests[0].response.complete();
    await nextTurn();
    requests[1].response.error(new HttpErrorResponse({ status: 0 }));
    const saved = await pending;

    assert.equal(saved, false);
    assert.equal(confirmed.length, 1);
    assert.equal(confirmed[0].revision, 11);
    assert.deepEqual(confirmed[0].document, document('first'));
    assert.deepEqual(session.document, document('newer draft'));
    assert.equal(session.confirmedRevision(), 11);
    assert.equal(session.dirty(), true);
    assert.equal(session.status(), 'error');
  });
  test('Changes during an in-flight save are queued with the confirmed next revision', async (t) => {
    // Arrange
    const { requests, session } = fixture(t);
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
  test('A connection failure keeps the draft and can retry without claiming it is saved', async (t) => {
    // Arrange
    const { requests, session } = fixture(t);
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
  test('A revision conflict retains the draft and blocks automatic overwriting', async (t) => {
    // Arrange
    const { requests, session } = fixture(t);
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
  test('Closing during autosave waits for every pending edit and its confirmed revision', async (t) => {
    // Arrange
    const { requests, session } = fixture(t);
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
  for (const status of [0, 409]) {
    test(`Closing after HTTP status ${status} keeps the unsaved material open`, async (t) => {
      // Arrange
      const { requests, session } = fixture(t);
      session.change(document('unsaved draft'));

      // Act
      const closing = session.prepareToClose();
      requests[0].response.error(new HttpErrorResponse({ status }));
      const actual1 = await closing;

      // Assert
      assert.equal(actual1, false);
      assert.equal(session.dirty(), true);
      assert.deepEqual(session.document, document('unsaved draft'));
    });
  }
});
