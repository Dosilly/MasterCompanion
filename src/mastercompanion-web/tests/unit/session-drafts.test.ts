import '@angular/compiler';
import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import type { SessionRecord } from '@mastercompanion/contracts';
import { ControlledHttp } from '../support/controlled-http';
import { MeetingRecords } from '../../projects/engine/src/lib/features/sessions/meeting-records';
import { SessionDrafts } from '../../projects/engine/src/lib/features/sessions/session-drafts';

const id = 'c48a9676-c4f2-4427-a765-e00ae2755d10';
const record: SessionRecord = {
  id,
  title: 'Meeting',
  status: 'active',
  preparationMaterialId: `session-${id}-prep`,
  notesMaterialId: `session-${id}-notes`,
  summary: '',
  followUp: '',
  pinnedMaterialIds: [],
};

function fixture(t: TestContext) {
  const http = new ControlledHttp<unknown>((value) => value);
  const meetings = new MeetingRecords('campaign', http.client, {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
  t.after(() => meetings.destroy());
  meetings.accept({ revision: 1, sessions: [record] });
  return { http, meetings, drafts: new SessionDrafts() };
}

describe('Per-session text drafts', () => {
  test('Remote deletion leaves the original draft available for explicit recovery and disposal', async (t) => {
    const { drafts, meetings, http } = fixture(t);
    drafts.edit(record, 'summary', 'Keep deleted summary');
    drafts.edit(record, 'followUp', 'Keep deleted follow-up');
    meetings.accept({ revision: 2, sessions: [] });

    assert.equal(await drafts.saveAll(meetings), false);
    assert.deepEqual(drafts.missingRecords(meetings.snapshot().sessions), [record]);
    assert.equal(drafts.value(record).summary, 'Keep deleted summary');
    assert.equal(drafts.value(record).followUp, 'Keep deleted follow-up');
    assert.equal(http.requests.length, 0);
    assert.equal(drafts.dirty(), true);

    drafts.discard(record);
    assert.equal(drafts.dirty(), false);
    assert.deepEqual(drafts.missingRecords([]), []);
  });
  test('Confirmed retry clears a matching draft without replacing another draft', (t) => {
    const { drafts } = fixture(t);
    const other = { ...record, id: 'another-record' };
    drafts.edit(record, 'summary', 'Confirmed summary');
    drafts.edit(other, 'summary', 'Other draft');

    drafts.acceptConfirmed([{ ...record, summary: 'Confirmed summary' }]);

    assert.equal(drafts.hasChanges(record), false);
    assert.equal(drafts.value(other).summary, 'Other draft');
    assert.equal(drafts.dirty(), true);
  });
  test('Editing different records keeps independent drafts', (t) => {
    const { drafts } = fixture(t);
    const other = { ...record, id: 'different-record', title: 'Second' };

    drafts.edit(record, 'summary', 'First notes');
    drafts.edit(other, 'followUp', 'Second follow-up');

    assert.equal(drafts.value(record).summary, 'First notes');
    assert.equal(drafts.value(other).followUp, 'Second follow-up');
    assert.equal(drafts.dirty(), true);
  });

  test('Remote text changes preserve the draft and reject silent overwrite', async (t) => {
    const { drafts, meetings, http } = fixture(t);
    drafts.edit(record, 'summary', 'Local summary');
    meetings.accept({ revision: 2, sessions: [{ ...record, summary: 'Remote summary' }] });

    assert.equal(await drafts.save(record, meetings), false);
    assert.equal(drafts.conflict(), true);
    assert.equal(drafts.value(record).summary, 'Local summary');
    assert.equal(http.requests.length, 0);
  });

  test('Unrelated pin changes permit saving text at the current revision', async (t) => {
    const { drafts, meetings, http } = fixture(t);
    drafts.edit(record, 'summary', 'Local summary');
    meetings.accept({ revision: 2, sessions: [{ ...record, pinnedMaterialIds: ['material'] }] });

    const saved = drafts.save(record, meetings);
    assert.deepEqual(http.requests[0].body, {
      requestId: meetings.request()?.requestId,
      expectedRevision: 2,
      operation: {
        kind: 'update',
        sessionId: id,
        title: 'Meeting',
        summary: 'Local summary',
        followUp: '',
      },
    });
    http.requests[0].response.next({
      revision: 3,
      sessions: [{ ...record, summary: 'Local summary', pinnedMaterialIds: ['material'] }],
    });

    assert.equal(await saved, true);
    assert.equal(drafts.dirty(), false);
  });

  test('Failed save retains the draft until explicit discard', async (t) => {
    const { drafts, meetings, http } = fixture(t);
    drafts.edit(record, 'summary', 'Keep this draft');

    const saved = drafts.save(record, meetings);
    http.requests[0].response.error(new Error('Transport failed'));

    assert.equal(await saved, false);
    assert.equal(drafts.dirty(), true);
    assert.equal(drafts.value(record).summary, 'Keep this draft');
    drafts.discard(record);
    assert.equal(drafts.dirty(), false);
  });
});
