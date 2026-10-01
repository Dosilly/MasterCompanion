import '@angular/compiler';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import { Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

// Exercise the real session and boundary decoder without exporting private engine implementation.
mkdirSync('.local/tests', { recursive: true });
const sourceDirectory = 'projects/engine/src/lib/features/gameplay';
for (const name of ['game-wire', 'game-session', 'party-draft']) {
  const compiled = ts.transpileModule(readFileSync(`${sourceDirectory}/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replaceAll("'./game-wire'", "'./game-wire.mjs'");
  writeFileSync(resolve(`.local/tests/${name}.mjs`), compiled);
}
const { GameSession } = await import(pathToFileURL(resolve('.local/tests/game-session.mjs')));
const { isGameRequest, isGameState } = await import(pathToFileURL(resolve('.local/tests/game-wire.mjs')));
const { PartyDraft } = await import(pathToFileURL(resolve('.local/tests/party-draft.mjs')));
const campaignId = 'ec8bf847-08b7-4314-9e54-ffcd39b0ab8e';
const characterId = 'da929f55-a678-482a-a8c8-13b89f2b71ad';
const previousRequestId = '8c6e29fd-5266-42a1-9684-46ea79e99d1b';
const advance = { kind: 'advanceTime', minutes: 60 };
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('Party drafts preserve stable IDs and confirmed data while editing, cancelling and accepting revisions', () => {
  const confirmed = state(4, 1080);
  const draft = new PartyDraft();
  draft.begin(confirmed);
  draft.rename(characterId, 'Renamed character');
  draft.add();
  const newId = draft.members()[1].id;
  draft.rename(newId, 'New character');
  assert.equal(draft.dirty(), true);
  assert.equal(confirmed.snapshot.party[0].name, 'Character');
  assert.deepEqual(draft.validatedMembers(false), [
    { id: characterId, name: 'Renamed character' }, { id: newId, name: 'New character' },
  ]);
  assert.equal(draft.isStale(4), false);
  assert.equal(draft.isStale(5), true);
  const retained = structuredClone(draft.members());
  draft.acceptRevision(5);
  assert.equal(draft.isStale(5), false);
  assert.deepEqual(draft.members(), retained);
  draft.finish();
  assert.equal(draft.dirty(), false);
  assert.equal(draft.editing(), false);
  draft.begin(confirmed);
  assert.deepEqual(draft.members(), confirmed.snapshot.party);
});

test('Party draft validation allows removal of the final active member but requires nonempty initial setup', () => {
  const draft = new PartyDraft();
  draft.begin(state());
  draft.remove(characterId);
  assert.deepEqual(draft.validatedMembers(false), []);
  assert.equal(draft.validatedMembers(true), null);
  draft.add();
  const id = draft.members()[0].id;
  for (const invalid of ['', '   ', 'a'.repeat(101), 'Invalid\u0001name']) {
    draft.rename(id, invalid);
    assert.equal(draft.validatedMembers(false), null);
  }
  draft.rename(id, ' Trimmed character ');
  assert.deepEqual(draft.validatedMembers(false), [{ id, name: 'Trimmed character' }]);
  for (let index = 1; index <= 25; index++) draft.add();
  assert.equal(draft.members().length, 20);
  assert.equal(new Set(draft.members().map(member => member.id)).size, 20);
});

test('Party edits and short rests retain strict request shapes and existing character identities', () => {
  const base = { requestId: previousRequestId, expectedRevision: 4 };
  assert.equal(isGameRequest({ ...base, kind: 'updateParty', party: [] }), true);
  assert.equal(isGameRequest({ ...base, kind: 'updateParty', party: [{ id: characterId, name: 'Renamed character' }] }), true);
  assert.equal(isGameRequest({ ...base, kind: 'shortRest' }), true);
  for (const invalid of [
    { ...base, kind: 'configureParty', party: [] },
    { ...base, kind: 'updateParty' },
    { ...base, kind: 'updateParty', party: [{ id: characterId, name: ' Character ' }] },
    { ...base, kind: 'updateParty', party: Array.from({ length: 21 }, () => ({ id: crypto.randomUUID(), name: 'Character' })) },
    { ...base, kind: 'updateParty', party: Array.from({ length: 2 }, () => ({ id: characterId, name: 'Character' })) },
    { ...base, kind: 'shortRest', minutes: 60 },
    { ...base, kind: 'shortRest', party: [] },
  ]) assert.equal(isGameRequest(invalid), false);
});

test('Removing the last character preserves confirmed clock and long-rest history', async () => {
  const before = state(4, 1080, previousRequestId, 'longRest');
  before.snapshot.restEnds = [1080];
  const f = await loaded(fixture(), before);
  const operation = f.session.execute({ kind: 'updateParty', party: [] });
  const write = f.requests.at(-1);
  assert.deepEqual(write.body.party, []);
  const receipt = state(5, 1080, write.body.requestId, 'updateParty');
  receipt.snapshot.party = [];
  receipt.snapshot.restEnds = [1080];
  await confirm(f, write, receipt);
  assert.equal(await operation, true);
  assert.deepEqual(f.session.state().snapshot.party, []);
  assert.deepEqual(f.session.state().snapshot.restEnds, [1080]);
  assert.equal(f.session.state().snapshot.timeMinutes, 1080);
  assert.equal(isGameState(receipt), true);
});

test('An uncertain party edit recovers the same roster and ID after reload', async () => {
  const storage = memoryStorage();
  const original = await loaded(fixture(storage));
  const party = [{ id: characterId, name: 'Renamed character' }];
  const operation = original.session.execute({ kind: 'updateParty', party });
  const first = original.requests.at(-1);
  party[0].name = 'Changed caller draft';
  reject(first, 0);
  assert.equal(await operation, false);
  original.session.destroy();
  const recovered = await loaded(fixture(storage));
  const retry = recovered.session.retry();
  const replay = recovered.requests.at(-1);
  assert.deepEqual(replay.body, first.body);
  assert.equal(replay.body.party[0].name, 'Renamed character');
  const receipt = state(2, 0, replay.body.requestId, 'updateParty');
  receipt.snapshot.party = first.body.party;
  await confirm(recovered, replay, receipt);
  assert.equal(await retry, true);
  assert.deepEqual(recovered.session.state().snapshot.party, first.body.party);
});

test('A short rest accepts its new receipt without adding long-rest recovery history', async () => {
  const f = await loaded(fixture(), state(3, 720, previousRequestId, 'advanceTime'));
  const operation = f.session.execute({ kind: 'shortRest' });
  const write = f.requests.at(-1);
  const receipt = state(4, 780, write.body.requestId, 'shortRest');
  await confirm(f, write, receipt);
  assert.equal(await operation, true);
  assert.equal(f.session.state().snapshot.timeMinutes, 780);
  assert.deepEqual(f.session.state().snapshot.restEnds, []);
});

function state(revision = 1, minute = 0, requestId = previousRequestId, kind = 'configureParty') {
  return {
    revision,
    snapshot: {
      timeMinutes: minute, party: [{ id: characterId, name: 'Character' }], restEnds: [],
      moduleSchemaVersion: 1, moduleState: { characters: [] },
    },
    moduleView: { characters: [] },
    lastOperation: { requestId, kind, revision },
  };
}

function memoryStorage() {
  const entries = new Map();
  return {
    entries,
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, value); },
    removeItem(key) { entries.delete(key); },
  };
}

function fixture(storage = memoryStorage()) {
  const requests = [];
  const http = {
    get(url) {
      const response = new Subject();
      requests.push({ method: 'GET', url, response });
      return response;
    },
    post(url, body) {
      const response = new Subject();
      requests.push({ method: 'POST', url, body: structuredClone(body), response });
      assert.ok(storage.entries?.size > 0, 'The recovery request must be durable before HTTP starts');
      return response;
    },
  };
  return { storage, requests, session: new GameSession(campaignId, http, storage) };
}

function receive(request, body) {
  assert.ok(request, 'Expected an HTTP request');
  request.response.next(body);
  request.response.complete();
}

function reject(request, status) {
  assert.ok(request, 'Expected an HTTP request');
  request.response.error(new HttpErrorResponse({ status }));
}

async function loaded(fixture, body = state()) {
  const loading = fixture.session.load();
  receive(fixture.requests.at(-1), body);
  assert.equal(await loading, true);
  return fixture;
}

async function confirm(fixture, request, receipt, current = receipt) {
  receive(request, receipt);
  await nextTurn();
  const refresh = fixture.requests.at(-1);
  assert.equal(refresh.method, 'GET', 'A confirmed receipt must be followed by a fresh state read');
  receive(refresh, current);
}

test('An operation persists its identity before writing and accepts only a refreshed confirmed state', async () => {
  const f = await loaded(fixture());
  const operation = f.session.execute(advance);
  assert.equal(f.session.pending(), true);
  assert.equal(f.session.canOperate(), false);
  const request = f.requests.at(-1);
  assert.equal(request.method, 'POST');
  assert.equal(request.body.expectedRevision, 1);
  assert.equal(request.body.kind, 'advanceTime');
  assert.equal(request.body.minutes, 60);
  assert.match(request.body.requestId, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  assert.equal(await f.session.execute({ kind: 'longRest' }), false);
  assert.equal(f.requests.length, 2);
  const receipt = state(2, 60, request.body.requestId, 'advanceTime');
  receive(request, receipt);
  await nextTurn();
  assert.equal(f.session.pending(), true);
  assert.equal(f.session.state().revision, 1);
  receive(f.requests.at(-1), receipt);
  assert.equal(await operation, true);
  assert.equal(f.session.state().revision, 2);
  assert.equal(f.session.pending(), false);
  assert.equal(f.session.canOperate(), true);
  assert.equal(f.session.hasRecovery(), false);
  assert.equal(f.storage.entries.size, 0);
});

test('Ambiguous failures preserve the same idempotent request and prevent unrelated writes', async () => {
  for (const status of [0, 500]) {
    const f = await loaded(fixture());
    const operation = f.session.execute(advance);
    const original = f.requests.at(-1);
    reject(original, status);
    assert.equal(await operation, false);
    assert.equal(f.session.hasRecovery(), true);
    assert.equal(f.session.canOperate(), false);
    assert.equal(f.session.state().revision, 1);
    assert.equal(await f.session.execute({ kind: 'longRest' }), false);
    assert.equal(f.requests.length, 2);
    const retry = f.session.retry();
    const retried = f.requests.at(-1);
    assert.deepEqual(retried.body, original.body);
    await confirm(f, retried, state(2, 60, original.body.requestId, 'advanceTime'));
    assert.equal(await retry, true);
    assert.equal(f.session.hasRecovery(), false);
    assert.equal(f.storage.entries.size, 0);
  }
});

test('Reload restores uncertain requests and replay receipts never replace newer gameplay', async () => {
  const storage = memoryStorage();
  const first = await loaded(fixture(storage));
  const operation = first.session.execute(advance);
  const original = first.requests.at(-1);
  reject(original, 0);
  assert.equal(await operation, false);
  first.session.destroy();
  const resumed = fixture(storage);
  assert.equal(resumed.session.hasRecovery(), true);
  await loaded(resumed, state(7, 300));
  assert.equal(resumed.session.canOperate(), false);
  const retry = resumed.session.retry();
  const retried = resumed.requests.at(-1);
  assert.deepEqual(retried.body, original.body);
  await confirm(resumed, retried, state(2, 60, original.body.requestId, 'advanceTime'), state(7, 300));
  assert.equal(await retry, true);
  assert.equal(resumed.session.state().revision, 7);
  assert.equal(resumed.session.state().snapshot.timeMinutes, 300);
});

test('Definitive validation rejection drops recovery and preserves the previously confirmed state', async () => {
  const f = await loaded(fixture());
  const operation = f.session.execute(advance);
  reject(f.requests.at(-1), 400);
  assert.equal(await operation, false);
  assert.equal(f.session.state().revision, 1);
  assert.equal(f.session.hasRecovery(), false);
  assert.equal(f.session.canOperate(), true);
  assert.equal(f.storage.entries.size, 0);
  assert.ok(f.session.error());
});

test('Conflict blocks writes until a read refresh and never retries the rejected action', async () => {
  const f = await loaded(fixture());
  const operation = f.session.execute(advance);
  reject(f.requests.at(-1), 409);
  assert.equal(await operation, false);
  assert.equal(f.session.canOperate(), false);
  assert.equal(await f.session.execute({ kind: 'longRest' }), false);
  const refresh = f.session.retry();
  assert.equal(f.requests.at(-1).method, 'GET');
  receive(f.requests.at(-1), state(4, 180));
  assert.equal(await refresh, true);
  assert.equal(f.session.canOperate(), true);
  assert.equal(f.session.state().revision, 4);
  assert.equal(f.requests.filter(request => request.method === 'POST').length, 1);
});

test('Failure to read after confirmation keeps recovery and retries the original request safely', async () => {
  const f = await loaded(fixture());
  const operation = f.session.execute(advance);
  const original = f.requests.at(-1);
  receive(original, state(2, 60, original.body.requestId, 'advanceTime'));
  await nextTurn();
  reject(f.requests.at(-1), 500);
  assert.equal(await operation, false);
  assert.equal(f.session.state().revision, 1);
  assert.equal(f.session.canOperate(), false);
  assert.equal(f.session.hasRecovery(), true);
  const retry = f.session.retry();
  assert.deepEqual(f.requests.at(-1).body, original.body);
  await confirm(f, f.requests.at(-1), state(2, 60, original.body.requestId, 'advanceTime'));
  assert.equal(await retry, true);
});

test('Destroy cancels an in-flight write while retaining its durable recovery payload', async () => {
  const storage = memoryStorage();
  const f = await loaded(fixture(storage));
  const operation = f.session.execute(advance);
  const original = f.requests.at(-1);
  assert.equal(original.response.observers.length, 1);
  f.session.destroy();
  assert.equal(original.response.observers.length, 0);
  assert.equal(await operation, false);
  assert.equal(storage.entries.size, 1);
  const resumed = fixture(storage);
  assert.equal(resumed.session.hasRecovery(), true);
  await loaded(resumed);
  const retry = resumed.session.retry();
  assert.deepEqual(resumed.requests.at(-1).body, original.body);
  reject(resumed.requests.at(-1), 0);
  assert.equal(await retry, false);
  resumed.session.destroy();
});

test('Unavailable recovery storage prevents any gameplay write', async () => {
  for (const storage of [null, {
    getItem() { return null; },
    setItem() { throw new Error('Storage is unavailable'); },
    removeItem() {},
  }]) {
    const f = await loaded(fixture(storage));
    assert.equal(await f.session.execute(advance), false);
    assert.equal(f.requests.filter(request => request.method === 'POST').length, 0);
    assert.ok(f.session.error());
    assert.equal(f.session.state().revision, 1);
  }
});

test('Malformed recovery storage is preserved and blocks writes with an actionable error', async () => {
  const storage = memoryStorage();
  const first = await loaded(fixture(storage));
  const operation = first.session.execute(advance);
  reject(first.requests.at(-1), 0);
  assert.equal(await operation, false);
  first.session.destroy();
  const key = storage.entries.keys().next().value;
  storage.entries.set(key, '{invalid json');
  const resumed = await loaded(fixture(storage));
  assert.ok(resumed.session.error());
  assert.equal(resumed.session.canOperate(), false);
  assert.equal(await resumed.session.execute(advance), false);
  assert.equal(storage.entries.get(key), '{invalid json');
  assert.equal(resumed.requests.filter(request => request.method === 'POST').length, 0);
});

test('Malformed receipts are never accepted and preserve recovery for the uncertain operation', async () => {
  const f = await loaded(fixture());
  const operation = f.session.execute(advance);
  receive(f.requests.at(-1), { revision: 2, snapshot: {} });
  assert.equal(await operation, false);
  assert.equal(f.session.state().revision, 1);
  assert.equal(f.session.hasRecovery(), true);
  assert.equal(f.session.canOperate(), false);
  assert.equal(f.storage.entries.size, 1);
});

test('A state read older than the confirmed receipt cannot clear recovery or roll back the visible revision', async () => {
  const f = await loaded(fixture());
  const operation = f.session.execute(advance);
  const original = f.requests.at(-1);
  receive(original, state(2, 60, original.body.requestId, 'advanceTime'));
  await nextTurn();
  receive(f.requests.at(-1), state(1));
  assert.equal(await operation, false);
  assert.equal(f.session.hasRecovery(), true);
  assert.equal(f.session.canOperate(), false);
  assert.equal(f.session.state().revision, 1);
});

test('A receipt must identify the exact non-undo request before a refresh can confirm it', async () => {
  for (const mutation of ['requestId', 'kind', 'revision']) {
    const f = await loaded(fixture());
    const operation = f.session.execute(advance);
    const original = f.requests.at(-1);
    const receipt = state(2, 60, original.body.requestId, 'advanceTime');
    if (mutation === 'requestId') receipt.lastOperation.requestId = previousRequestId;
    if (mutation === 'kind') receipt.lastOperation.kind = 'longRest';
    if (mutation === 'revision') receipt.lastOperation.revision = 1;
    receive(original, receipt);
    await nextTurn();
    if (f.requests.at(-1).method === 'GET') receive(f.requests.at(-1), state(2, 60, original.body.requestId, 'advanceTime'));
    assert.equal(await operation, false);
    assert.equal(f.session.state().revision, 1);
    assert.equal(f.session.hasRecovery(), true);
    assert.equal(f.requests.length, 2);
  }
});

test('Caller mutation cannot change an uncertain request body between idempotent retries', async () => {
  const f = await loaded(fixture());
  const action = { kind: 'module', command: { kind: 'resolveCheck', characterId, success: true, d6: 3 } };
  const operation = f.session.execute(action);
  const original = f.requests.at(-1);
  action.command.d6 = 6;
  reject(original, 0);
  assert.equal(await operation, false);
  const retry = f.session.retry();
  assert.deepEqual(f.requests.at(-1).body, original.body);
  reject(f.requests.at(-1), 0);
  assert.equal(await retry, false);
});

test('State decoder rejects unsafe numeric, reference and structural inputs without replacing confirmed state', async () => {
  const mutations = [
    value => { value.revision = Number.MAX_SAFE_INTEGER + 1; },
    value => { value.revision = -1; },
    value => { value.snapshot.timeMinutes = NaN; },
    value => { value.snapshot.timeMinutes = 0.5; },
    value => { value.snapshot.timeMinutes = 52_560_001; },
    value => { value.snapshot.moduleSchemaVersion = 0; },
    value => { value.snapshot.party[0].id = 'invalid-id'; },
    value => { value.snapshot.party.push({ ...value.snapshot.party[0] }); },
    value => { value.snapshot.restEnds = [481]; },
    value => { value.lastOperation.revision = value.revision + 1; },
    value => { value.lastOperation.kind = 'unexpected'; },
    value => { delete value.snapshot.moduleState; },
    value => { delete value.moduleView; },
    value => { value.snapshot.moduleState = { invalid: NaN }; },
    value => { value.moduleView = { invalid: undefined }; },
  ];
  for (const mutate of mutations) {
    const f = await loaded(fixture());
    const invalid = state();
    mutate(invalid);
    const loading = f.session.load();
    receive(f.requests.at(-1), invalid);
    assert.equal(await loading, false);
    assert.equal(f.session.state().revision, 1);
    assert.ok(f.session.error());
    assert.equal(f.session.canOperate(), false);
  }
});

test('Engine state accepts opaque module data without interpreting module-owned rules', async () => {
  for (const data of [{ customRule: { value: 'opaque module state' } }, ['module-owned state'], null]) {
    const opaque = state();
    opaque.snapshot.moduleSchemaVersion = 3;
    opaque.snapshot.moduleState = data;
    opaque.moduleView = data;
    const f = await loaded(fixture(), opaque);
    assert.deepEqual(f.session.state(), opaque);
  }
});

test('An unconfigured read performs no writes and party setup advances from revision zero', async () => {
  const initial = state(0);
  initial.snapshot.party = [];
  initial.lastOperation = null;
  const f = await loaded(fixture(), initial);
  assert.equal(f.requests.length, 1);
  assert.equal(f.storage.entries.size, 0);
  const operation = f.session.execute({ kind: 'configureParty', party: [{ id: characterId, name: 'Character' }] });
  const request = f.requests.at(-1);
  assert.equal(request.body.expectedRevision, 0);
  await confirm(f, request, state(1, 0, request.body.requestId));
  assert.equal(await operation, true);
  assert.equal(f.session.state().snapshot.party.length, 1);
});

test('Undo receipt may name the previous remaining operation and restores the current state after refresh', async () => {
  const f = await loaded(fixture(), state(2, 60, previousRequestId, 'advanceTime'));
  const operation = f.session.execute({ kind: 'undo' });
  const request = f.requests.at(-1);
  const undone = state(3, 0);
  undone.lastOperation.revision = 1;
  await confirm(f, request, undone);
  assert.equal(await operation, true);
  assert.equal(f.session.state().revision, 3);
  assert.equal(f.session.state().snapshot.timeMinutes, 0);
  assert.equal(f.session.state().lastOperation.revision, 1);
});

test('Destroy during the post-confirmation refresh cancels the read and preserves recoverability', async () => {
  const f = await loaded(fixture());
  const operation = f.session.execute(advance);
  const original = f.requests.at(-1);
  receive(original, state(2, 60, original.body.requestId, 'advanceTime'));
  await nextTurn();
  const read = f.requests.at(-1);
  assert.equal(read.method, 'GET');
  assert.equal(read.response.observers.length, 1);
  f.session.destroy();
  assert.equal(read.response.observers.length, 0);
  assert.equal(await operation, false);
  assert.equal(f.storage.entries.size, 1);
  assert.equal(f.session.state().revision, 1);
  assert.equal(await f.session.retry(), false);
  assert.equal(await f.session.execute(advance), false);
});

test('Failure to remove recovery storage keeps actions blocked until safe replay can finish cleanup', async () => {
  const storage = memoryStorage();
  const remove = storage.removeItem;
  let cannotRemove = true;
  storage.removeItem = function(key) {
    if (cannotRemove) throw new Error('Storage cannot be modified');
    remove.call(this, key);
  };
  const f = await loaded(fixture(storage));
  const operation = f.session.execute(advance);
  const request = f.requests.at(-1);
  const receipt = state(2, 60, request.body.requestId, 'advanceTime');
  await confirm(f, request, receipt);
  assert.equal(await operation, false);
  assert.equal(f.session.state().revision, 2);
  assert.equal(f.session.hasRecovery(), true);
  assert.equal(f.session.canOperate(), false);
  assert.equal(f.session.error(), 'storageUnavailable');
  cannotRemove = false;
  const retry = f.session.retry();
  assert.deepEqual(f.requests.at(-1).body, request.body);
  await confirm(f, f.requests.at(-1), receipt);
  assert.equal(await retry, true);
  assert.equal(f.storage.entries.size, 0);
});

test('Recovery requests with unsafe revisions, unsupported shapes or invalid identities remain blocked', async () => {
  const valid = { ...advance, requestId: previousRequestId, expectedRevision: 1 };
  const invalidRequests = [
    { ...valid, expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, expectedRevision: -1 },
    { ...valid, minutes: 0 },
    { ...valid, minutes: 525_601 },
    { ...valid, minutes: '60' },
    { ...valid, requestId: '00000000-0000-0000-0000-000000000000' },
    { ...valid, command: { kind: 'anything' } },
    { ...valid, kind: 'unsupported' },
  ];
  for (const invalid of invalidRequests) {
    const storage = memoryStorage();
    const key = `mastercompanion.game.pending.${campaignId}`;
    const stored = JSON.stringify(invalid);
    storage.setItem(key, stored);
    const f = await loaded(fixture(storage));
    assert.equal(f.session.invalidPending(), true);
    assert.equal(f.session.error(), 'invalidPending');
    assert.equal(await f.session.retry(), false);
    assert.equal(await f.session.execute(advance), false);
    assert.equal(storage.getItem(key), stored);
    assert.equal(f.requests.length, 1);
  }
});

test('Destroy after a response emission prevents queued continuations from starting reads or clearing recovery', async () => {
  for (const stage of ['write', 'refresh']) {
    const f = await loaded(fixture());
    const operation = f.session.execute(advance);
    const write = f.requests.at(-1);
    const receipt = state(2, 60, write.body.requestId, 'advanceTime');
    receive(write, receipt);
    if (stage === 'refresh') {
      await nextTurn();
      assert.equal(f.requests.at(-1).method, 'GET');
      receive(f.requests.at(-1), receipt);
    }
    // firstValueFrom has resolved, but the await continuation has not yet run.
    f.session.destroy();
    assert.equal(await operation, false);
    assert.equal(f.requests.length, stage === 'write' ? 2 : 3);
    assert.equal(f.session.state().revision, 1);
    assert.equal(f.session.hasRecovery(), true);
    assert.equal(f.storage.entries.size, 1);
    assert.equal(JSON.parse([...f.storage.entries.values()][0]).requestId, write.body.requestId);
  }
});

test('An operation kind encoded as an array is rejected without enabling game actions', async () => {
  const f = fixture();
  const loading = f.session.load();
  const invalid = state(1, 0);
  invalid.lastOperation.kind = ['configureParty'];
  receive(f.requests.at(-1), invalid);
  assert.equal(await loading, false);
  assert.equal(f.session.state(), null);
  assert.equal(f.session.error(), 'invalidResponse');
  assert.equal(f.session.canOperate(), false);
});
