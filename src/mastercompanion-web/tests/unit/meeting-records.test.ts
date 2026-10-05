import '@angular/compiler';
import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { HttpErrorResponse } from '@angular/common/http';
import type {
  SessionOperationRequest,
  SessionRecord,
  SessionSnapshot,
} from '@mastercompanion/contracts';
import { ControlledHttp } from '../support/controlled-http';
import { MeetingRecords } from '../../projects/engine/src/lib/features/sessions/meeting-records';
import {
  isSessionRequest,
  isSessionSnapshot,
} from '../../projects/engine/src/lib/features/sessions/session-wire';

const id = 'e629b0e2-fce8-4d4b-959c-03c8b89f0afd';
function meeting(title = 'Meeting'): SessionRecord {
  return {
    id,
    title,
    status: 'planned',
    preparationMaterialId: `session-${id}-prep`,
    notesMaterialId: `session-${id}-notes`,
    summary: '',
    followUp: '',
    pinnedMaterialIds: [],
  };
}

function fixture(t: TestContext) {
  const http = new ControlledHttp<SessionOperationRequest | null>((value) => {
    if (value === null || isSessionRequest(value)) {
      return value;
    }
    throw new Error('Unexpected session request.');
  });
  const stored = new Map<string, string>();
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      stored.set(key, value);
    },
    removeItem: (key: string) => {
      stored.delete(key);
    },
  };
  const records = new MeetingRecords('campaign', http.client, storage);
  records.accept({ revision: 0, sessions: [] });
  t.after(() => records.destroy());
  return { http, stored, storage, records };
}

const create = {
  kind: 'create',
  sessionId: id,
  title: 'Meeting',
  preparationTitle: 'Preparation',
  notesTitle: 'Play notes',
} as const;

describe('Meeting records and operation recovery', () => {
  test('Confirmed creation advances records and clears durable recovery', async (t) => {
    const { records, http, stored } = fixture(t);

    const result = records.execute(create);
    assert.equal(records.pending(), true);
    assert.equal(stored.size, 1);
    http.requests[0].response.next({ revision: 1, sessions: [meeting()] });

    assert.equal(await result, true);
    assert.equal(records.snapshot().revision, 1);
    assert.equal(stored.size, 0);
    assert.equal(records.locked(), false);
  });

  test('Lost response survives reload and retries the exact identity', async (t) => {
    const { records, http, storage, stored } = fixture(t);
    const first = records.execute(create);
    const request = http.requests[0].body;
    http.requests[0].response.error(new HttpErrorResponse({ status: 0 }));
    assert.equal(await first, false);
    assert.equal(records.error(), 'uncertain');

    const reopened = new MeetingRecords('campaign', http.client, storage);
    t.after(() => reopened.destroy());
    reopened.accept({ revision: 1, sessions: [meeting()] });
    const retry = reopened.retry();
    assert.deepEqual(http.requests[1].body, request);
    http.requests[1].response.next({ revision: 1, sessions: [meeting()] });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(http.requests[2].method, 'GET');
    http.requests[2].response.next({ revision: 1, sessions: [meeting()] });

    assert.equal(await retry, true);
    assert.equal(reopened.locked(), false);
    assert.equal(stored.size, 0);
  });

  test('Malformed success keeps the uncertain identity instead of reporting saved', async (t) => {
    const { records, http, stored } = fixture(t);
    const result = records.execute(create);
    http.requests[0].response.next({ revision: 1, sessions: [meeting('Wrong title')] });

    assert.equal(await result, false);
    assert.equal(records.error(), 'uncertain');
    assert.equal(records.snapshot().revision, 0);
    assert.equal(stored.size, 1);
  });

  test('Explicit revision rejection clears retry identity and retains confirmed records', async (t) => {
    const { records, http, stored } = fixture(t);
    const result = records.execute(create);
    http.requests[0].response.error(
      new HttpErrorResponse({ status: 409, error: { code: 'session_revision_conflict' } }),
    );

    assert.equal(await result, false);
    assert.equal(records.error(), 'conflict');
    assert.equal(stored.size, 0);
    assert.equal(records.snapshot().revision, 0);
  });

  test('Unknown failure payload cannot clear an uncertain operation', async (t) => {
    const { records, http, stored } = fixture(t);
    const result = records.execute(create);
    http.requests[0].response.error(
      new HttpErrorResponse({ status: 409, error: { detail: 'Unrecognized' } }),
    );

    assert.equal(await result, false);
    assert.equal(records.error(), 'uncertain');
    assert.equal(stored.size, 1);
  });

  test('Unavailable recovery storage prevents sending writes', async (t) => {
    const { http } = fixture(t);
    const records = new MeetingRecords('other', http.client, null);
    t.after(() => records.destroy());
    records.accept({ revision: 0, sessions: [] });

    assert.equal(await records.execute(create), false);
    assert.equal(records.error(), 'storageUnavailable');
    assert.equal(http.requests.length, 0);
  });

  test('Unreadable recovery blocks writes until deliberate removal', (t) => {
    const { http, storage, stored } = fixture(t);
    stored.set('mastercompanion.sessions.pending.other', '{invalid');
    const records = new MeetingRecords('other', http.client, storage);
    t.after(() => records.destroy());
    records.accept({ revision: 0, sessions: [] });

    assert.equal(records.locked(), true);
    assert.equal(records.invalidRecovery(), true);
    records.discardUnreadable();
    assert.equal(records.locked(), false);
    assert.equal(stored.size, 0);
  });

  test('Older receipt replay cannot roll back a newer confirmed record', async (t) => {
    const { records, http } = fixture(t);
    const result = records.execute(create);
    records.accept({ revision: 2, sessions: [meeting('Newer title')] });
    http.requests[0].response.next({ revision: 1, sessions: [meeting()] });

    assert.equal(await result, true);
    assert.equal(records.snapshot().revision, 2);
    assert.equal(records.snapshot().sessions[0].title, 'Newer title');
  });

  test('Same-revision divergent records are rejected', (t) => {
    const { records } = fixture(t);
    records.accept({ revision: 1, sessions: [meeting()] });

    assert.equal(records.accept({ revision: 1, sessions: [meeting('Changed')] }), false);
    assert.equal(records.snapshot().sessions[0].title, 'Meeting');
  });

  test('Destroy cancels requests without clearing recoverable writes', async (t) => {
    const { records, stored } = fixture(t);
    const result = records.execute(create);
    records.destroy();

    assert.equal(await result, false);
    assert.equal(stored.size, 1);
  });
});

describe('Session wire validation', () => {
  const valid: SessionSnapshot = { revision: 1, sessions: [meeting()] };
  const invalidCases: readonly [string, unknown][] = [
    ['duplicate records', { ...valid, sessions: [meeting(), meeting()] }],
    [
      'duplicate pins',
      { ...valid, sessions: [{ ...meeting(), pinnedMaterialIds: ['same', 'same'] }] },
    ],
    ['unsupported status', { ...valid, sessions: [{ ...meeting(), status: 'unknown' }] }],
    ['non-string status', { ...valid, sessions: [{ ...meeting(), status: ['planned'] }] }],
    [
      'unsafe material ID',
      { ...valid, sessions: [{ ...meeting(), pinnedMaterialIds: ['../bad'] }] },
    ],
    [
      'unexpected document identity',
      { ...valid, sessions: [{ ...meeting(), notesMaterialId: 'wrong' }] },
    ],
    ['unsafe revision', { ...valid, revision: Number.MAX_SAFE_INTEGER + 1 }],
    ['extra response field', { ...valid, extra: true }],
  ];
  for (const [name, value] of invalidCases) {
    test(`Rejects ${name}`, () => {
      assert.equal(isSessionSnapshot(value), false);
    });
  }
});
