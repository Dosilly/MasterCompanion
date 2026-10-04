import '@angular/compiler';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MaterialDto, RichDocument } from '@mastercompanion/contracts';
import { ControlledHttp } from '../support/controlled-http';
import { CampaignMaterialCache } from '../../projects/engine/src/lib/features/workspace/campaign-material-cache';

function material(id: string, revision = 1, text = 'Confirmed content'): MaterialDto {
  return {
    id,
    title: id,
    group: '',
    folderId: null,
    revision,
    documentSchemaVersion: 1,
    document: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    },
  };
}

function fixture() {
  const transport = new ControlledHttp((value) => value);
  const cache = new CampaignMaterialCache('campaign:one', transport.client);
  return { cache, requests: transport.requests };
}

function nestedDocument(blockquoteCount: number): RichDocument {
  let child: RichDocument = {
    type: 'paragraph',
    content: [{ type: 'text', text: 'Deep content' }],
  };
  for (let level = 0; level < blockquoteCount; level++) {
    child = { type: 'blockquote', content: [child] };
  }
  return { type: 'doc', content: [child] };
}

function documentWithParagraphs(count: number): RichDocument {
  return {
    type: 'doc',
    content: Array.from({ length: count }, () => ({ type: 'paragraph' })),
  };
}

describe('Confirmed campaign material cache', () => {
  test('Concurrent refreshes share one campaign-scoped batch request', async (t) => {
    const { cache, requests } = fixture();
    t.after(() => cache.destroy());
    const first = cache.refresh();
    const second = cache.refresh();

    assert.equal(first, second);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'GET');
    assert.equal(requests[0].url, '/api/campaigns/campaign%3Aone/materials');

    const snapshot = [material('one'), material('two', 4)];
    requests[0].response.next(snapshot);
    await Promise.all([first, second]);

    assert.deepEqual(cache.materials(), snapshot);
    assert.equal(cache.get('two'), snapshot[1]);
  });

  test('A failed refresh retains the confirmed snapshot and permits a retry', async (t) => {
    const { cache, requests } = fixture();
    t.after(() => cache.destroy());
    const original = material('one', 3);
    cache.confirm(original);
    const pending = cache.refresh();
    const rejected = assert.rejects(pending, /Read failed/);

    requests[0].response.error(new Error('Read failed'));
    await rejected;

    assert.equal(cache.get('one'), original);
    const retry = cache.refresh();
    const current = material('one', 4);
    requests[1].response.next([current]);
    await retry;

    assert.equal(cache.get('one'), current);
    assert.equal(requests.length, 2);
  });

  test('A delayed snapshot cannot roll back a save confirmed during the read', async (t) => {
    const { cache, requests } = fixture();
    t.after(() => cache.destroy());
    cache.confirm(material('one', 3, 'Before save'));
    const pending = cache.refresh();
    const saved = material('one', 4, 'Locally confirmed save');

    cache.confirm(saved);
    requests[0].response.next([material('one', 3, 'Stale snapshot')]);
    await pending;

    assert.equal(cache.get('one'), saved);
  });

  test('A higher remote revision wins over a local confirmation made during refresh', async (t) => {
    const { cache, requests } = fixture();
    t.after(() => cache.destroy());
    const pending = cache.refresh();
    cache.confirm(material('one', 4, 'Local save'));
    const remote = material('one', 5, 'Later remote save');

    requests[0].response.next([remote]);
    await pending;
    cache.confirm(material('one', 4, 'Delayed local confirmation'));

    assert.equal(cache.get('one'), remote);
  });

  test('A note created during a pending snapshot is retained when absent from that snapshot', async (t) => {
    const { cache, requests } = fixture();
    t.after(() => cache.destroy());
    const pending = cache.refresh();
    const created = material('new-note');

    cache.confirm(created);
    requests[0].response.next([material('existing-note')]);
    await pending;

    assert.equal(cache.get('new-note'), created);
    assert.deepEqual(
      cache.materials().map((item) => item.id),
      ['existing-note', 'new-note'],
    );
  });

  test('A complete snapshot removes records absent before the request began', async (t) => {
    const { cache, requests } = fixture();
    t.after(() => cache.destroy());
    cache.confirm(material('removed-note'));

    const pending = cache.refresh();
    requests[0].response.next([material('remaining-note')]);
    await pending;

    assert.equal(cache.get('removed-note'), undefined);
    assert.deepEqual(
      cache.materials().map((item) => item.id),
      ['remaining-note'],
    );
  });

  test('Duplicate snapshot identifiers reject the entire refresh without partial publication', async (t) => {
    const { cache, requests } = fixture();
    t.after(() => cache.destroy());
    const original = material('original', 7);
    cache.confirm(original);
    const pending = cache.refresh();
    const rejected = assert.rejects(pending, /duplicate identifiers/);

    requests[0].response.next([material('new'), material('new', 2)]);
    await rejected;

    assert.deepEqual(cache.materials(), [original]);
    assert.equal(cache.get('new'), undefined);
  });

  const invalidSnapshotCases: { name: string; response: unknown; error: RegExp }[] = [
    { name: 'null snapshot', response: null, error: /not an array/ },
    { name: 'object snapshot', response: { materials: [] }, error: /not an array/ },
  ];
  for (const scenario of invalidSnapshotCases) {
    test(`Rejecting ${scenario.name} retains the confirmed cache`, async (t) => {
      const { cache, requests } = fixture();
      t.after(() => cache.destroy());
      const original = material('original', 7);
      cache.confirm(original);
      const pending = cache.refresh();
      const rejected = assert.rejects(pending, scenario.error);

      requests[0].response.next(scenario.response);
      await rejected;

      assert.deepEqual(cache.materials(), [original]);
    });
  }

  const validMaterial = material('invalid');
  const invalidMaterialCases: { name: string; material: unknown }[] = [
    { name: 'null material', material: null },
    {
      name: 'unsupported document version',
      material: { ...validMaterial, documentSchemaVersion: 2 },
    },
    { name: 'missing document root', material: { ...validMaterial, document: null } },
    { name: 'non-document root', material: { ...validMaterial, document: { type: 'paragraph' } } },
    {
      name: 'invalid document content',
      material: { ...validMaterial, document: { type: 'doc', content: 'text' } },
    },
    {
      name: 'unknown node type',
      material: { ...validMaterial, document: { type: 'doc', content: [{ type: 'unknownNode' }] } },
    },
    {
      name: 'unknown mark type',
      material: {
        ...validMaterial,
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Marked', marks: [{ type: 'unknownMark' }] }],
            },
          ],
        },
      },
    },
    {
      name: 'schema-invalid child',
      material: {
        ...validMaterial,
        document: { type: 'doc', content: [{ type: 'text', text: 'Requires a paragraph' }] },
      },
    },
    { name: 'zero revision', material: { ...validMaterial, revision: 0 } },
    { name: 'fractional revision', material: { ...validMaterial, revision: 1.5 } },
    {
      name: 'unsafe revision',
      material: { ...validMaterial, revision: Number.MAX_SAFE_INTEGER + 1 },
    },
    { name: 'empty identifier', material: { ...validMaterial, id: '' } },
    { name: 'non-text title', material: { ...validMaterial, title: 4 } },
    { name: 'non-text group', material: { ...validMaterial, group: false } },
    { name: 'empty folder identifier', material: { ...validMaterial, folderId: '' } },
    {
      name: 'document deeper than 32 levels',
      material: { ...validMaterial, document: nestedDocument(31) },
    },
    {
      name: 'document larger than 20000 nodes',
      material: { ...validMaterial, document: documentWithParagraphs(20_000) },
    },
  ];
  for (const scenario of invalidMaterialCases) {
    test(`A snapshot containing ${scenario.name} is rejected atomically after a valid prefix`, async (t) => {
      const { cache, requests } = fixture();
      t.after(() => cache.destroy());
      const original = material('original', 7);
      cache.confirm(original);
      const pending = cache.refresh();
      const rejected = assert.rejects(pending, /unsupported material/);

      requests[0].response.next([material('valid-prefix'), scenario.material]);
      await rejected;

      assert.deepEqual(cache.materials(), [original]);
      assert.equal(cache.get('valid-prefix'), undefined);
    });
  }

  const validBoundaryCases = [
    { name: '32-level document', document: nestedDocument(30) },
    { name: '20000-node document', document: documentWithParagraphs(19_999) },
  ];
  for (const scenario of validBoundaryCases) {
    test(`A supported ${scenario.name} is accepted at the validation limit`, async (t) => {
      const { cache, requests } = fixture();
      t.after(() => cache.destroy());
      const accepted = { ...material('accepted'), document: scenario.document };

      const pending = cache.refresh();
      requests[0].response.next([accepted]);
      await pending;

      assert.equal(cache.get(accepted.id), accepted);
    });
  }

  test('Destruction cancels a pending read and rejects later refreshes', async () => {
    const { cache, requests } = fixture();
    cache.confirm(material('original'));
    const pending = cache.refresh();
    const rejected = assert.rejects(pending, { name: 'EmptyError' });

    cache.destroy();
    requests[0].response.next([material('late')]);
    cache.confirm(material('also-late'));
    await rejected;

    assert.equal(requests[0].response.observed, false);
    assert.deepEqual(cache.materials(), []);
    await assert.rejects(cache.refresh(), /destroyed/);
    assert.equal(requests.length, 1);
  });
});
