import '@angular/compiler';
import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { HttpErrorResponse } from '@angular/common/http';
import type { MaterialDto, RichDocument } from '@mastercompanion/contracts';
import { ControlledHttp } from '../support/controlled-http';
import { MaterialSession } from '../../projects/engine/src/lib/features/materials/material-session';
import { WorkspaceMaterials } from '../../projects/engine/src/lib/features/workspace/workspace-materials';

const body: RichDocument = { type: 'doc', content: [{ type: 'paragraph' }] };
const original: MaterialDto = {
  id: 'note',
  title: 'Original',
  group: '',
  folderId: null,
  document: body,
  documentSchemaVersion: 1,
  revision: 1,
};
function fixture(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const http = new ControlledHttp<unknown>((value) => value);
  const confirmed: MaterialDto[] = [];
  const session = new MaterialSession(original, http.client, (value) => confirmed.push(value));
  t.after(() => session.destroy());
  return { session, http, confirmed };
}

describe('Campaign material title editing', () => {
  test('Title-only save waits for confirmation and preserves the body and identity', async (t) => {
    const { session, http, confirmed } = fixture(t);
    session.changeTitle('  New title  ');

    const closing = session.prepareToClose();

    assert.deepEqual(http.requests[0].body, {
      title: 'New title',
      document: body,
      expectedRevision: 1,
    });
    assert.equal(session.material.title, 'Original');
    assert.equal(session.dirty(), true);
    http.requests[0].response.next({ revision: 2 });
    assert.equal(await closing, true);
    assert.equal(session.titleDraft(), 'New title');
    assert.deepEqual(confirmed, [{ ...original, title: 'New title', revision: 2 }]);
    assert.equal(session.material.id, original.id);
  });

  test('New title and body typed during a pending save retain their own snapshot and next revision', async (t) => {
    const { session, http, confirmed } = fixture(t);
    session.changeTitle('First title');
    const saving = session.flush();
    const newerBody: RichDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New body' }] }],
    };
    session.changeTitle('Newer title');
    session.change(newerBody);

    http.requests[0].response.next({ revision: 2 });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(session.titleDraft(), 'Newer title');
    assert.equal(session.material.title, 'First title');
    assert.deepEqual(http.requests[1].body, {
      title: 'Newer title',
      document: newerBody,
      expectedRevision: 2,
    });
    http.requests[1].response.error(new HttpErrorResponse({ status: 503 }));
    assert.equal(await saving, false);
    assert.equal(session.titleDraft(), 'Newer title');
    assert.equal(session.document, newerBody);
    assert.equal(confirmed[0].title, 'First title');
    assert.equal(session.dirty(), true);
  });

  for (const title of ['', '   ', 'x'.repeat(301), 'Invalid\nTitle', 'Invalid\u0085Title']) {
    test(`Invalid title ${JSON.stringify(title)} retains its draft and blocks closure without a write`, async (t) => {
      const { session, http } = fixture(t);
      session.changeTitle(title);

      assert.equal(await session.prepareToClose(), false);

      assert.equal(session.error(), 'invalidTitle');
      assert.equal(session.titleDraft(), title);
      assert.equal(session.material.title, 'Original');
      assert.equal(session.dirty(), true);
      assert.equal(http.requests.length, 0);
    });
  }

  for (const recovery of ['adopt', 'reapply'] as const) {
    test(`Conflict ${recovery} explicitly resolves both title and body`, async (t) => {
      const { session, http } = fixture(t);
      session.changeTitle('My draft');
      const saving = session.flush();
      http.requests[0].response.error(new HttpErrorResponse({ status: 409 }));
      await saving;
      const reading = session.inspectSavedVersion();
      http.requests[1].response.next({ ...original, title: 'Remote title', revision: 2 });
      await reading;
      assert.equal(session.titleDraft(), 'My draft');
      assert.equal(session.material.title, 'Original');

      if (recovery === 'adopt') {
        assert.equal(session.adoptSavedVersion(), true);
        assert.equal(session.titleDraft(), 'Remote title');
        assert.equal(session.material.title, 'Remote title');
      } else {
        const reapplied = session.reapplyDraft();
        assert.deepEqual(http.requests[2].body, {
          title: 'My draft',
          document: body,
          expectedRevision: 2,
        });
        http.requests[2].response.next({ revision: 3 });
        assert.equal(await reapplied, true);
        assert.equal(session.material.title, 'My draft');
      }
    });
  }

  test('Confirmed rename updates workspace navigation and cached reopening without a document read', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const http = new ControlledHttp<unknown>((value) => value);
    const owner = new WorkspaceMaterials(http.client);
    t.after(() => owner.destroy());
    const loading = owner.initialize({
      campaignId: 'campaign',
      title: 'Campaign',
      moduleId: 'test',
      moduleVersion: '1',
      startMaterialId: original.id,
      folders: [],
      foldersRevision: 1,
      maps: [],
      materials: [original],
    });
    http.requests[0].response.next([original]);
    await loading;
    const session = await owner.open(original.id);
    session.changeTitle('Renamed');

    const saving = session.flush();
    http.requests[1].response.next({ revision: 2 });
    await saving;

    assert.equal(owner.workspace()?.materials[0].title, 'Renamed');
    owner.removeConfirmedSession(original.id);
    const reopened = await owner.open(original.id);
    assert.equal(reopened.material.title, 'Renamed');
    assert.equal(http.requests.length, 2);
  });
});
