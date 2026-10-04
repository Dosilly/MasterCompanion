import '@angular/compiler';
import { HttpErrorResponse } from '@angular/common/http';
import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import type { MaterialSearchResponse } from '@mastercompanion/contracts';
import { MaterialSearch } from '../../projects/engine/src/lib/features/materials/material-search';
import { MaterialSession } from '../../projects/engine/src/lib/features/materials/material-session';
import { ControlledHttp } from '../support/controlled-http';

function fixture(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const transport = new ControlledHttp((value) => value);
  const search = new MaterialSearch('campaign', transport.client);
  t.after(() => search.destroy());
  return { search, requests: transport.requests, client: transport.client };
}

function results(id: string, hasMore = false): MaterialSearchResponse {
  return {
    results: [
      { id, title: 'Material title', folderId: null, snippet: '<script>plain text</script>' },
    ],
    hasMore,
  };
}

describe('Persisted material search', () => {
  test('Typing debounces one whitespace-normalized phrase and exposes bounded plain-text results', (t) => {
    // Arrange
    const { search, requests } = fixture(t);

    // Act
    search.updateQuery('  Frost  maiden  ');

    // Assert
    assert.deepEqual(search.state(), { kind: 'loading' });
    assert.equal(requests.length, 0);

    // Act
    t.mock.timers.tick(250);
    requests[0].response.next(results('match', true));

    // Assert
    assert.equal(requests[0].method, 'GET');
    assert.equal(requests[0].url, '/api/campaigns/campaign/materials/search?query=Frost%20maiden');
    assert.deepEqual(search.state(), { kind: 'ready', ...results('match', true) });
    assert.equal(search.query(), '  Frost  maiden  ');
  });

  test('A newer phrase cancels the previous request and ignores its late result', (t) => {
    // Arrange
    const { search, requests } = fixture(t);
    search.updateQuery('old');
    t.mock.timers.tick(250);

    // Act
    search.updateQuery('new');
    requests[0].response.next(results('stale'));

    // Assert
    assert.equal(requests[0].response.observed, false);
    assert.deepEqual(search.state(), { kind: 'loading' });

    // Act
    t.mock.timers.tick(250);
    requests[1].response.next(results('current'));

    // Assert
    assert.deepEqual(search.state(), { kind: 'ready', ...results('current') });
  });

  test('Clearing cancels both a queued phrase and a pending request and restores idle navigation', (t) => {
    // Arrange
    const { search, requests } = fixture(t);
    search.updateQuery('queued');

    // Act
    search.updateQuery(' ');
    t.mock.timers.tick(250);

    // Assert
    assert.deepEqual(search.state(), { kind: 'idle' });
    assert.equal(requests.length, 0);

    // Act
    search.updateQuery('pending');
    t.mock.timers.tick(250);
    search.updateQuery('');
    requests[0].response.next(results('late'));

    // Assert
    assert.equal(requests[0].response.observed, false);
    assert.deepEqual(search.state(), { kind: 'idle' });
  });

  test('An empty response exposes a ready empty result without claiming a failure', (t) => {
    // Arrange
    const { search, requests } = fixture(t);
    search.updateQuery('absent');
    t.mock.timers.tick(250);

    // Act
    requests[0].response.next({ results: [], hasMore: false });

    // Assert
    assert.deepEqual(search.state(), { kind: 'ready', results: [], hasMore: false });
  });

  for (const [status, error] of [
    [400, 'invalidQuery'],
    [404, 'campaignMissing'],
    [0, 'failed'],
    [500, 'failed'],
  ] as const) {
    test(`HTTP ${status} becomes ${error} and an explicit retry retains the phrase`, (t) => {
      // Arrange
      const { search, requests } = fixture(t);
      search.updateQuery('remembered');
      t.mock.timers.tick(250);

      // Act
      requests[0].response.error(new HttpErrorResponse({ status, error: 'Private diagnostics' }));

      // Assert
      assert.deepEqual(search.state(), { kind: 'error', error });
      assert.equal(search.query(), 'remembered');

      // Act
      search.retry();
      requests[1].response.next(results('recovered'));

      // Assert
      assert.equal(requests[1].url, requests[0].url);
      assert.deepEqual(search.state(), { kind: 'ready', ...results('recovered') });
    });
  }

  const invalidResponses: [string, unknown][] = [
    ['missing results', { hasMore: false }],
    ['non-boolean limit flag', { results: [], hasMore: 'false' }],
    [
      'invalid excerpt',
      { results: [{ ...results('match').results[0], snippet: null }], hasMore: false },
    ],
    [
      'duplicate identities',
      { results: [...results('same').results, ...results('same').results], hasMore: false },
    ],
    [
      'unbounded results',
      {
        results: Array.from({ length: 51 }, (_, index) => results(String(index)).results[0]),
        hasMore: true,
      },
    ],
  ];
  for (const [name, response] of invalidResponses) {
    test(`A response with ${name} shows a recoverable error`, (t) => {
      // Arrange
      const { search, requests } = fixture(t);
      search.updateQuery('phrase');
      t.mock.timers.tick(250);

      // Act
      requests[0].response.next(response);

      // Assert
      assert.deepEqual(search.state(), { kind: 'error', error: 'failed' });
    });
  }

  for (const [name, query] of [
    ['overlong phrase', 'x'.repeat(161)],
    ['control character', 'bad\u0000phrase'],
  ]) {
    test(`A locally invalid ${name} sends no request`, (t) => {
      // Arrange
      const { search, requests } = fixture(t);

      // Act
      search.updateQuery(query);
      t.mock.timers.tick(250);

      // Assert
      assert.deepEqual(search.state(), { kind: 'error', error: 'invalidQuery' });
      assert.equal(requests.length, 0);
    });
  }

  test('Refreshing a confirmed change searches again while an empty phrase stays idle', (t) => {
    // Arrange
    const { search, requests } = fixture(t);
    search.updateQuery('phrase');
    t.mock.timers.tick(250);
    requests[0].response.next(results('before'));

    // Act
    search.refresh();
    t.mock.timers.tick(250);
    requests[1].response.next(results('after'));

    // Assert
    assert.equal(requests[1].url, requests[0].url);
    assert.deepEqual(search.state(), { kind: 'ready', ...results('after') });

    // Act
    search.updateQuery('');
    search.refresh();
    t.mock.timers.tick(250);

    // Assert
    assert.equal(requests.length, 2);
    assert.deepEqual(search.state(), { kind: 'idle' });
  });

  test('Disposal cancels pending work and disables query, retry and refresh operations', (t) => {
    // Arrange
    const { search, requests } = fixture(t);
    search.updateQuery('pending');
    t.mock.timers.tick(250);

    // Act
    search.destroy();
    requests[0].response.next(results('late'));
    search.updateQuery('ignored');
    search.retry();
    search.refresh();
    t.mock.timers.tick(250);

    // Assert
    assert.equal(requests[0].response.observed, false);
    assert.equal(requests.length, 1);
    assert.equal(search.query(), 'pending');
    assert.deepEqual(search.state(), { kind: 'loading' });
  });

  test('Disposal cancels a debounce before it creates a request', (t) => {
    // Arrange
    const { search, requests } = fixture(t);
    search.updateQuery('queued');

    // Act
    search.destroy();
    t.mock.timers.tick(250);

    // Assert
    assert.equal(requests.length, 0);
  });
});

describe('Material search invalidation after persistence', () => {
  test('Drafts and failed saves preserve the confirmed revision; only a confirmed save advances it', async (t) => {
    // Arrange
    const { requests, client } = fixture(t);
    const session = new MaterialSession(
      {
        id: 'note',
        title: 'Note',
        folderId: null,
        group: '',
        revision: 4,
        documentSchemaVersion: 1,
        document: { type: 'doc', content: [] },
      },
      client,
    );

    // Act
    session.change({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft' }] }],
    });
    const failure = session.flush();
    requests[0].response.error(new HttpErrorResponse({ status: 0 }));
    await failure;

    // Assert
    assert.equal(session.confirmedRevision(), 4);
    assert.equal(session.dirty(), true);

    // Act
    const saved = session.flush();
    requests[1].response.next({ revision: 5 });
    requests[1].response.complete();
    await saved;

    // Assert
    assert.equal(session.confirmedRevision(), 5);
    assert.equal(session.dirty(), false);
  });
});
