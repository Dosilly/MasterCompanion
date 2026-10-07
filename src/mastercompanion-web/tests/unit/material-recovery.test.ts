import '@angular/compiler';
import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { HttpErrorResponse } from '@angular/common/http';
import type { RichDocument } from '@mastercompanion/contracts';
import { ControlledHttp } from '../support/controlled-http';
import { MaterialSession } from '../../projects/engine/src/lib/features/materials/material-session';

const document = (text: string): RichDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const original = {
  id: 'note',
  title: 'Note',
  group: '',
  folderId: null,
  revision: 1,
  documentSchemaVersion: 1,
  document: document('original'),
};
const remote = { ...original, revision: 2, document: document('remote') };

async function fixture(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const http = new ControlledHttp<unknown>((value) => value);
  const confirmed: unknown[] = [];
  const session = new MaterialSession(original, http.client, (value) => confirmed.push(value));
  t.after(() => session.destroy());
  session.change(document('draft'));
  const save = session.flush();
  http.requests[0].response.error(new HttpErrorResponse({ status: 409 }));
  await save;
  return { http, session, confirmed };
}

describe('Material conflict recovery', () => {
  test('Inspection retains the complete draft and publishes no confirmed content', async (t) => {
    const { http, session, confirmed } = await fixture(t);
    const inspection = session.inspectSavedVersion();
    session.change(document('newer retained draft'));
    http.requests[1].response.next(remote);
    await inspection;

    assert.equal(session.savedVersion().kind, 'ready');
    assert.deepEqual(session.document, document('newer retained draft'));
    assert.equal(session.confirmedRevision(), 1);
    assert.equal(session.dirty(), true);
    assert.deepEqual(confirmed, []);
  });

  test('Explicit adoption confirms inspected content without another write', async (t) => {
    const { http, session, confirmed } = await fixture(t);
    const inspection = session.inspectSavedVersion();
    http.requests[1].response.next(remote);
    await inspection;

    assert.equal(session.adoptSavedVersion(), true);
    assert.deepEqual(session.document, remote.document);
    assert.equal(session.confirmedRevision(), 2);
    assert.equal(session.dirty(), false);
    assert.equal(session.status(), 'saved');
    assert.deepEqual(confirmed, [remote]);
    assert.equal(http.requests.length, 2);
  });

  test('Reapplication uses the inspected revision and a later remote write causes another conflict', async (t) => {
    const { http, session } = await fixture(t);
    const inspection = session.inspectSavedVersion();
    http.requests[1].response.next(remote);
    await inspection;

    const save = session.reapplyDraft();
    assert.deepEqual(http.requests[2].body, {
      title: 'Note',
      document: document('draft'),
      expectedRevision: 2,
    });
    http.requests[2].response.error(new HttpErrorResponse({ status: 409 }));

    assert.equal(await save, false);
    assert.equal(session.status(), 'conflict');
    assert.equal(session.savedVersion().kind, 'idle');
    assert.deepEqual(session.document, document('draft'));
    assert.equal(await session.reapplyDraft(), false);
    assert.equal(http.requests.length, 3);
  });

  for (const [name, response] of [
    ['foreign identity', { ...remote, id: 'foreign' }],
    ['unsupported document', { ...remote, document: { type: 'unsupported' } }],
    ['invalid revision', { ...remote, revision: 0 }],
  ] as const) {
    test(`Invalid inspection with ${name} preserves the draft`, async (t) => {
      const { http, session } = await fixture(t);
      const inspection = session.inspectSavedVersion();
      http.requests[1].response.next(response);
      await inspection;

      assert.equal(session.savedVersion().kind, 'failed');
      assert.equal(session.adoptSavedVersion(), false);
      assert.deepEqual(session.document, document('draft'));
    });
  }

  test('Failed reads can retry and destroying the owner cancels pending inspection', async (t) => {
    const { http, session } = await fixture(t);
    const failed = session.inspectSavedVersion();
    http.requests[1].response.error(new HttpErrorResponse({ status: 503 }));
    await failed;
    assert.equal(session.savedVersion().kind, 'failed');

    const pending = session.inspectSavedVersion();
    session.destroy();
    await pending;
    http.requests[2].response.next(remote);
    assert.equal(session.savedVersion().kind, 'loading');
    assert.deepEqual(session.document, document('draft'));
  });
});
