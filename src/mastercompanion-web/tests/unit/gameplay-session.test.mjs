import '@angular/compiler';
import { describe, test } from 'node:test';
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
describe('Gameplay session and wire validation', () => {
    test('Module activities accept bounded time and preserve strict recovery request shapes', () => {
        // Arrange
        const base = { requestId: previousRequestId, expectedRevision: 4, kind: 'module', command: { kind: 'explore' } };

        // Act
        const actual1 = isGameRequest(base);

        // Assert
        assert.equal(actual1, true);

        // Act
        const actual2 = isGameRequest({ ...base, minutes: 60 });

        // Assert
        assert.equal(actual2, true);
        for (const minutes of [0, -1, 525601, 1.5, '30', null])
            assert.equal(isGameRequest({ ...base, minutes }), false);

        // Act
        const actual3 = isGameRequest({ ...base, minutes: 30, party: [] });

        // Assert
        assert.equal(actual3, false);
    });
    test('Party drafts preserve stable IDs and confirmed data while editing, cancelling and accepting revisions', () => {
        // Arrange
        const confirmed = state(4, 1080);
        const draft = new PartyDraft();

        // Act
        draft.begin(confirmed);
        draft.rename(characterId, 'Renamed character');
        draft.add();
        // Arrange
        const newId = draft.members()[1].id;

        // Act
        draft.rename(newId, 'New character');

        // Assert
        assert.equal(draft.dirty(), true);
        assert.equal(confirmed.snapshot.party[0].name, 'Character');
        assert.deepEqual(draft.validatedMembers(false), [
            { id: characterId, name: 'Renamed character' }, { id: newId, name: 'New character' },
        ]);
        assert.equal(draft.isStale(4), false);
        assert.equal(draft.isStale(5), true);
        // Arrange
        const retained = structuredClone(draft.members());

        // Act
        draft.acceptRevision(5);

        // Assert
        assert.equal(draft.isStale(5), false);
        assert.deepEqual(draft.members(), retained);

        // Act
        draft.finish();

        // Assert
        assert.equal(draft.dirty(), false);
        assert.equal(draft.editing(), false);

        // Act
        draft.begin(confirmed);

        // Assert
        assert.deepEqual(draft.members(), confirmed.snapshot.party);
    });
    test('Party draft validation allows removal of the final active member but requires nonempty initial setup', () => {
        // Arrange
        const draft = new PartyDraft();

        // Act
        draft.begin(state());
        draft.remove(characterId);

        // Assert
        assert.deepEqual(draft.validatedMembers(false), []);
        assert.equal(draft.validatedMembers(true), null);

        // Act
        draft.add();
        // Arrange
        const id = draft.members()[0].id;
        for (const invalid of ['', '   ', 'a'.repeat(101), 'Invalid\u0001name']) {

            // Act
            draft.rename(id, invalid);

            // Assert
            assert.equal(draft.validatedMembers(false), null);
        }

        // Act
        draft.rename(id, ' Trimmed character ');

        // Assert
        assert.deepEqual(draft.validatedMembers(false), [{ id, name: 'Trimmed character' }]);
        for (let index = 1; index <= 25; index++)
            draft.add();
        assert.equal(draft.members().length, 20);
        assert.equal(new Set(draft.members().map(member => member.id)).size, 20);
    });
    test('Party edits and short rests retain strict request shapes and existing character identities', () => {
        // Arrange
        const base = { requestId: previousRequestId, expectedRevision: 4 };

        // Act
        const actual1 = isGameRequest({ ...base, kind: 'updateParty', party: [] });

        // Assert
        assert.equal(actual1, true);

        // Act
        const actual2 = isGameRequest({ ...base, kind: 'updateParty', party: [{ id: characterId, name: 'Renamed character' }] });

        // Assert
        assert.equal(actual2, true);

        // Act
        const actual3 = isGameRequest({ ...base, kind: 'shortRest' });

        // Assert
        assert.equal(actual3, true);
        for (const invalid of [
            { ...base, kind: 'configureParty', party: [] },
            { ...base, kind: 'updateParty' },
            { ...base, kind: 'updateParty', party: [{ id: characterId, name: ' Character ' }] },
            { ...base, kind: 'updateParty', party: Array.from({ length: 21 }, () => ({ id: crypto.randomUUID(), name: 'Character' })) },
            { ...base, kind: 'updateParty', party: Array.from({ length: 2 }, () => ({ id: characterId, name: 'Character' })) },
            { ...base, kind: 'shortRest', minutes: 60 },
            { ...base, kind: 'shortRest', party: [] },
        ])
            assert.equal(isGameRequest(invalid), false);
    });
    test('Removing the last character preserves confirmed clock and long-rest history', async () => {
        // Arrange
        const before = state(4, 1080, previousRequestId, 'longRest');
        before.snapshot.restEnds = [1080];
        const f = await loaded(fixture(), before);

        // Act
        const operation = f.session.execute({ kind: 'updateParty', party: [] });
        // Arrange
        const write = f.requests.at(-1);

        // Assert
        assert.deepEqual(write.body.party, []);
        // Arrange
        const receipt = state(5, 1080, write.body.requestId, 'updateParty');
        receipt.snapshot.party = [];
        receipt.snapshot.restEnds = [1080];

        // Act
        await confirm(f, write, receipt);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, true);
        assert.deepEqual(f.session.state().snapshot.party, []);
        assert.deepEqual(f.session.state().snapshot.restEnds, [1080]);
        assert.equal(f.session.state().snapshot.timeMinutes, 1080);

        // Act
        const actual2 = isGameState(receipt);

        // Assert
        assert.equal(actual2, true);
    });
    test('An uncertain party edit recovers the same roster and ID after reload', async () => {
        // Arrange
        const storage = memoryStorage();
        const original = await loaded(fixture(storage));
        const party = [{ id: characterId, name: 'Renamed character' }];

        // Act
        const operation = original.session.execute({ kind: 'updateParty', party });
        // Arrange
        const first = original.requests.at(-1);
        party[0].name = 'Changed caller draft';

        // Act
        reject(first, 0);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);

        // Act
        original.session.destroy();
        // Arrange
        const recovered = await loaded(fixture(storage));
        const retry = recovered.session.retry();
        const replay = recovered.requests.at(-1);

        // Assert
        assert.deepEqual(replay.body, first.body);
        assert.equal(replay.body.party[0].name, 'Renamed character');
        // Arrange
        const receipt = state(2, 0, replay.body.requestId, 'updateParty');
        receipt.snapshot.party = first.body.party;

        // Act
        await confirm(recovered, replay, receipt);
        const actual2 = await retry;

        // Assert
        assert.equal(actual2, true);
        assert.deepEqual(recovered.session.state().snapshot.party, first.body.party);
    });
    test('A short rest accepts its new receipt without adding long-rest recovery history', async () => {
        // Arrange
        const f = await loaded(fixture(), state(3, 720, previousRequestId, 'advanceTime'));

        // Act
        const operation = f.session.execute({ kind: 'shortRest' });
        // Arrange
        const write = f.requests.at(-1);
        const receipt = state(4, 780, write.body.requestId, 'shortRest');

        // Act
        await confirm(f, write, receipt);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, true);
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
        // Arrange
        const f = await loaded(fixture());

        // Act
        const operation = f.session.execute(advance);

        // Assert
        assert.equal(f.session.pending(), true);
        assert.equal(f.session.canOperate(), false);
        // Arrange
        const request = f.requests.at(-1);

        // Assert
        assert.equal(request.method, 'POST');
        assert.equal(request.body.expectedRevision, 1);
        assert.equal(request.body.kind, 'advanceTime');
        assert.equal(request.body.minutes, 60);
        assert.match(request.body.requestId, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);

        // Act
        const actual1 = await f.session.execute({ kind: 'longRest' });

        // Assert
        assert.equal(actual1, false);
        assert.equal(f.requests.length, 2);
        // Arrange
        const receipt = state(2, 60, request.body.requestId, 'advanceTime');

        // Act
        receive(request, receipt);
        await nextTurn();

        // Assert
        assert.equal(f.session.pending(), true);
        assert.equal(f.session.state().revision, 1);

        // Act
        receive(f.requests.at(-1), receipt);
        const actual2 = await operation;

        // Assert
        assert.equal(actual2, true);
        assert.equal(f.session.state().revision, 2);
        assert.equal(f.session.pending(), false);
        assert.equal(f.session.canOperate(), true);
        assert.equal(f.session.hasRecovery(), false);
        assert.equal(f.storage.entries.size, 0);
    });
    test('Ambiguous failures preserve the same idempotent request and prevent unrelated writes', async () => {
        // Arrange
        for (const status of [0, 500]) {
            // Arrange
            const f = await loaded(fixture());

            // Act
            const operation = f.session.execute(advance);
            // Arrange
            const original = f.requests.at(-1);

            // Act
            reject(original, status);
            const actual1 = await operation;

            // Assert
            assert.equal(actual1, false);
            assert.equal(f.session.hasRecovery(), true);
            assert.equal(f.session.canOperate(), false);
            assert.equal(f.session.state().revision, 1);

            // Act
            const actual2 = await f.session.execute({ kind: 'longRest' });

            // Assert
            assert.equal(actual2, false);
            assert.equal(f.requests.length, 2);
            // Arrange
            const retry = f.session.retry();
            const retried = f.requests.at(-1);

            // Assert
            assert.deepEqual(retried.body, original.body);

            // Act
            await confirm(f, retried, state(2, 60, original.body.requestId, 'advanceTime'));
            const actual3 = await retry;

            // Assert
            assert.equal(actual3, true);
            assert.equal(f.session.hasRecovery(), false);
            assert.equal(f.storage.entries.size, 0);
        }
    });
    test('Reload restores uncertain requests and replay receipts never replace newer gameplay', async () => {
        // Arrange
        const storage = memoryStorage();
        const first = await loaded(fixture(storage));

        // Act
        const operation = first.session.execute(advance);
        // Arrange
        const original = first.requests.at(-1);

        // Act
        reject(original, 0);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);

        // Act
        first.session.destroy();
        // Arrange
        const resumed = fixture(storage);

        // Assert
        assert.equal(resumed.session.hasRecovery(), true);

        // Act
        await loaded(resumed, state(7, 300));

        // Assert
        assert.equal(resumed.session.canOperate(), false);
        // Arrange
        const retry = resumed.session.retry();
        const retried = resumed.requests.at(-1);

        // Assert
        assert.deepEqual(retried.body, original.body);

        // Act
        await confirm(resumed, retried, state(2, 60, original.body.requestId, 'advanceTime'), state(7, 300));
        const actual2 = await retry;

        // Assert
        assert.equal(actual2, true);
        assert.equal(resumed.session.state().revision, 7);
        assert.equal(resumed.session.state().snapshot.timeMinutes, 300);
    });
    test('Definitive validation rejection drops recovery and preserves the previously confirmed state', async () => {
        // Arrange
        const f = await loaded(fixture());

        // Act
        const operation = f.session.execute(advance);
        reject(f.requests.at(-1), 400);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);
        assert.equal(f.session.state().revision, 1);
        assert.equal(f.session.hasRecovery(), false);
        assert.equal(f.session.canOperate(), true);
        assert.equal(f.storage.entries.size, 0);
        assert.ok(f.session.error());
    });
    test('Conflict blocks writes until a read refresh and never retries the rejected action', async () => {
        // Arrange
        const f = await loaded(fixture());

        // Act
        const operation = f.session.execute(advance);
        reject(f.requests.at(-1), 409);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);
        assert.equal(f.session.canOperate(), false);

        // Act
        const actual2 = await f.session.execute({ kind: 'longRest' });

        // Assert
        assert.equal(actual2, false);
        // Arrange
        const refresh = f.session.retry();

        // Assert
        assert.equal(f.requests.at(-1).method, 'GET');

        // Act
        receive(f.requests.at(-1), state(4, 180));
        const actual3 = await refresh;

        // Assert
        assert.equal(actual3, true);
        assert.equal(f.session.canOperate(), true);
        assert.equal(f.session.state().revision, 4);
        assert.equal(f.requests.filter(request => request.method === 'POST').length, 1);
    });
    test('Failure to read after confirmation keeps recovery and retries the original request safely', async () => {
        // Arrange
        const f = await loaded(fixture());

        // Act
        const operation = f.session.execute(advance);
        // Arrange
        const original = f.requests.at(-1);

        // Act
        receive(original, state(2, 60, original.body.requestId, 'advanceTime'));
        await nextTurn();
        reject(f.requests.at(-1), 500);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);
        assert.equal(f.session.state().revision, 1);
        assert.equal(f.session.canOperate(), false);
        assert.equal(f.session.hasRecovery(), true);
        // Arrange
        const retry = f.session.retry();

        // Assert
        assert.deepEqual(f.requests.at(-1).body, original.body);

        // Act
        await confirm(f, f.requests.at(-1), state(2, 60, original.body.requestId, 'advanceTime'));
        const actual2 = await retry;

        // Assert
        assert.equal(actual2, true);
    });
    test('Destroy cancels an in-flight write while retaining its durable recovery payload', async () => {
        // Arrange
        const storage = memoryStorage();
        const f = await loaded(fixture(storage));

        // Act
        const operation = f.session.execute(advance);
        // Arrange
        const original = f.requests.at(-1);

        // Assert
        assert.equal(original.response.observers.length, 1);

        // Act
        f.session.destroy();

        // Assert
        assert.equal(original.response.observers.length, 0);

        // Act
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);
        assert.equal(storage.entries.size, 1);
        // Arrange
        const resumed = fixture(storage);

        // Assert
        assert.equal(resumed.session.hasRecovery(), true);

        // Act
        await loaded(resumed);
        // Arrange
        const retry = resumed.session.retry();

        // Assert
        assert.deepEqual(resumed.requests.at(-1).body, original.body);

        // Act
        reject(resumed.requests.at(-1), 0);
        const actual2 = await retry;

        // Assert
        assert.equal(actual2, false);

        // Act
        resumed.session.destroy();
    });
    test('Unavailable recovery storage prevents any gameplay write', async () => {
        // Arrange
        for (const storage of [null, {
                getItem() { return null; },
                setItem() { throw new Error('Storage is unavailable'); },
                removeItem() { },
            }]) {
            // Arrange
            const f = await loaded(fixture(storage));

            // Act
            const actual1 = await f.session.execute(advance);

            // Assert
            assert.equal(actual1, false);
            assert.equal(f.requests.filter(request => request.method === 'POST').length, 0);
            assert.ok(f.session.error());
            assert.equal(f.session.state().revision, 1);
        }
    });
    test('Malformed recovery storage is preserved and blocks writes with an actionable error', async () => {
        // Arrange
        const storage = memoryStorage();
        const first = await loaded(fixture(storage));

        // Act
        const operation = first.session.execute(advance);
        reject(first.requests.at(-1), 0);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);

        // Act
        first.session.destroy();
        // Arrange
        const key = storage.entries.keys().next().value;

        // Act
        storage.entries.set(key, '{invalid json');
        // Arrange
        const resumed = await loaded(fixture(storage));

        // Assert
        assert.ok(resumed.session.error());
        assert.equal(resumed.session.canOperate(), false);

        // Act
        const actual2 = await resumed.session.execute(advance);

        // Assert
        assert.equal(actual2, false);
        assert.equal(storage.entries.get(key), '{invalid json');
        assert.equal(resumed.requests.filter(request => request.method === 'POST').length, 0);
    });
    test('Malformed receipts are never accepted and preserve recovery for the uncertain operation', async () => {
        // Arrange
        const f = await loaded(fixture());

        // Act
        const operation = f.session.execute(advance);
        receive(f.requests.at(-1), { revision: 2, snapshot: {} });
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);
        assert.equal(f.session.state().revision, 1);
        assert.equal(f.session.hasRecovery(), true);
        assert.equal(f.session.canOperate(), false);
        assert.equal(f.storage.entries.size, 1);
    });
    test('A state read older than the confirmed receipt cannot clear recovery or roll back the visible revision', async () => {
        // Arrange
        const f = await loaded(fixture());

        // Act
        const operation = f.session.execute(advance);
        // Arrange
        const original = f.requests.at(-1);

        // Act
        receive(original, state(2, 60, original.body.requestId, 'advanceTime'));
        await nextTurn();
        receive(f.requests.at(-1), state(1));
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);
        assert.equal(f.session.hasRecovery(), true);
        assert.equal(f.session.canOperate(), false);
        assert.equal(f.session.state().revision, 1);
    });
    test('A receipt must identify the exact non-undo request before a refresh can confirm it', async () => {
        // Arrange
        for (const mutation of ['requestId', 'kind', 'revision']) {
            // Arrange
            const f = await loaded(fixture());

            // Act
            const operation = f.session.execute(advance);
            // Arrange
            const original = f.requests.at(-1);
            const receipt = state(2, 60, original.body.requestId, 'advanceTime');
            if (mutation === 'requestId')
                receipt.lastOperation.requestId = previousRequestId;
            if (mutation === 'kind')
                receipt.lastOperation.kind = 'longRest';
            if (mutation === 'revision')
                receipt.lastOperation.revision = 1;

            // Act
            receive(original, receipt);
            await nextTurn();
            // Arrange
            if (f.requests.at(-1).method === 'GET')
                receive(f.requests.at(-1), state(2, 60, original.body.requestId, 'advanceTime'));

            // Act
            const actual1 = await operation;

            // Assert
            assert.equal(actual1, false);
            assert.equal(f.session.state().revision, 1);
            assert.equal(f.session.hasRecovery(), true);
            assert.equal(f.requests.length, 2);
        }
    });
    test('Caller mutation cannot change an uncertain request body between idempotent retries', async () => {
        // Arrange
        const f = await loaded(fixture());
        const action = { kind: 'module', command: { kind: 'resolveCheck', characterId, success: true, d6: 3 } };

        // Act
        const operation = f.session.execute(action);
        // Arrange
        const original = f.requests.at(-1);
        action.command.d6 = 6;

        // Act
        reject(original, 0);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);
        // Arrange
        const retry = f.session.retry();

        // Assert
        assert.deepEqual(f.requests.at(-1).body, original.body);

        // Act
        reject(f.requests.at(-1), 0);
        const actual2 = await retry;

        // Assert
        assert.equal(actual2, false);
    });
    test('State decoder rejects unsafe numeric, reference and structural inputs without replacing confirmed state', async () => {
        // Arrange
        const mutations = [
            value => { value.revision = Number.MAX_SAFE_INTEGER + 1; },
            value => { value.revision = -1; },
            value => { value.snapshot.timeMinutes = NaN; },
            value => { value.snapshot.timeMinutes = 0.5; },
            value => { value.snapshot.timeMinutes = 52560001; },
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
            // Arrange
            const f = await loaded(fixture());
            const invalid = state();

            // Act
            mutate(invalid);
            const loading = f.session.load();
            receive(f.requests.at(-1), invalid);
            const actual1 = await loading;

            // Assert
            assert.equal(actual1, false);
            assert.equal(f.session.state().revision, 1);
            assert.ok(f.session.error());
            assert.equal(f.session.canOperate(), false);
        }
    });
    test('Engine state accepts opaque module data without interpreting module-owned rules', async () => {
        // Arrange
        for (const data of [{ customRule: { value: 'opaque module state' } }, ['module-owned state'], null]) {
            // Arrange
            const opaque = state();
            opaque.snapshot.moduleSchemaVersion = 3;
            opaque.snapshot.moduleState = data;
            opaque.moduleView = data;
            const f = await loaded(fixture(), opaque);

            // Assert
            assert.deepEqual(f.session.state(), opaque);
        }
    });
    test('An unconfigured read performs no writes and party setup advances from revision zero', async () => {
        // Arrange
        const initial = state(0);
        initial.snapshot.party = [];
        initial.lastOperation = null;
        const f = await loaded(fixture(), initial);

        // Assert
        assert.equal(f.requests.length, 1);
        assert.equal(f.storage.entries.size, 0);

        // Act
        const operation = f.session.execute({ kind: 'configureParty', party: [{ id: characterId, name: 'Character' }] });
        // Arrange
        const request = f.requests.at(-1);

        // Assert
        assert.equal(request.body.expectedRevision, 0);

        // Act
        await confirm(f, request, state(1, 0, request.body.requestId));
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, true);
        assert.equal(f.session.state().snapshot.party.length, 1);
    });
    test('Undo receipt may name the previous remaining operation and restores the current state after refresh', async () => {
        // Arrange
        const f = await loaded(fixture(), state(2, 60, previousRequestId, 'advanceTime'));

        // Act
        const operation = f.session.execute({ kind: 'undo' });
        // Arrange
        const request = f.requests.at(-1);
        const undone = state(3, 0);
        undone.lastOperation.revision = 1;

        // Act
        await confirm(f, request, undone);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, true);
        assert.equal(f.session.state().revision, 3);
        assert.equal(f.session.state().snapshot.timeMinutes, 0);
        assert.equal(f.session.state().lastOperation.revision, 1);
    });
    test('Destroy during the post-confirmation refresh cancels the read and preserves recoverability', async () => {
        // Arrange
        const f = await loaded(fixture());

        // Act
        const operation = f.session.execute(advance);
        // Arrange
        const original = f.requests.at(-1);

        // Act
        receive(original, state(2, 60, original.body.requestId, 'advanceTime'));
        await nextTurn();
        // Arrange
        const read = f.requests.at(-1);

        // Assert
        assert.equal(read.method, 'GET');
        assert.equal(read.response.observers.length, 1);

        // Act
        f.session.destroy();

        // Assert
        assert.equal(read.response.observers.length, 0);

        // Act
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);
        assert.equal(f.storage.entries.size, 1);
        assert.equal(f.session.state().revision, 1);

        // Act
        const actual2 = await f.session.retry();

        // Assert
        assert.equal(actual2, false);

        // Act
        const actual3 = await f.session.execute(advance);

        // Assert
        assert.equal(actual3, false);
    });
    test('Failure to remove recovery storage keeps actions blocked until safe replay can finish cleanup', async () => {
        // Arrange
        const storage = memoryStorage();
        const remove = storage.removeItem;
        let cannotRemove = true;
        storage.removeItem = function (key) {
            if (cannotRemove)
                throw new Error('Storage cannot be modified');
            remove.call(this, key);
        };
        const f = await loaded(fixture(storage));

        // Act
        const operation = f.session.execute(advance);
        // Arrange
        const request = f.requests.at(-1);
        const receipt = state(2, 60, request.body.requestId, 'advanceTime');

        // Act
        await confirm(f, request, receipt);
        const actual1 = await operation;

        // Assert
        assert.equal(actual1, false);
        assert.equal(f.session.state().revision, 2);
        assert.equal(f.session.hasRecovery(), true);
        assert.equal(f.session.canOperate(), false);
        assert.equal(f.session.error(), 'storageUnavailable');
        // Arrange
        cannotRemove = false;
        const retry = f.session.retry();

        // Assert
        assert.deepEqual(f.requests.at(-1).body, request.body);

        // Act
        await confirm(f, f.requests.at(-1), receipt);
        const actual2 = await retry;

        // Assert
        assert.equal(actual2, true);
        assert.equal(f.storage.entries.size, 0);
    });
    test('Recovery requests with unsafe revisions, unsupported shapes or invalid identities remain blocked', async () => {
        // Arrange
        const valid = { ...advance, requestId: previousRequestId, expectedRevision: 1 };
        const invalidRequests = [
            { ...valid, expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
            { ...valid, expectedRevision: -1 },
            { ...valid, minutes: 0 },
            { ...valid, minutes: 525601 },
            { ...valid, minutes: '60' },
            { ...valid, requestId: '00000000-0000-0000-0000-000000000000' },
            { ...valid, command: { kind: 'anything' } },
            { ...valid, kind: 'unsupported' },
        ];
        for (const invalid of invalidRequests) {
            // Arrange
            const storage = memoryStorage();
            const key = `mastercompanion.game.pending.${campaignId}`;
            const stored = JSON.stringify(invalid);

            // Act
            storage.setItem(key, stored);
            // Arrange
            const f = await loaded(fixture(storage));

            // Assert
            assert.equal(f.session.invalidPending(), true);
            assert.equal(f.session.error(), 'invalidPending');

            // Act
            const actual1 = await f.session.retry();

            // Assert
            assert.equal(actual1, false);

            // Act
            const actual2 = await f.session.execute(advance);

            // Assert
            assert.equal(actual2, false);
            assert.equal(storage.getItem(key), stored);
            assert.equal(f.requests.length, 1);
        }
    });
    test('Destroy after a response emission prevents queued continuations from starting reads or clearing recovery', async () => {
        // Arrange
        for (const stage of ['write', 'refresh']) {
            // Arrange
            const f = await loaded(fixture());

            // Act
            const operation = f.session.execute(advance);
            // Arrange
            const write = f.requests.at(-1);
            const receipt = state(2, 60, write.body.requestId, 'advanceTime');

            // Act
            receive(write, receipt);
            // Arrange
            if (stage === 'refresh') {
                await nextTurn();
                assert.equal(f.requests.at(-1).method, 'GET');
                receive(f.requests.at(-1), receipt);
            }
            // firstValueFrom has resolved, but the await continuation has not yet run.

            // Act
            f.session.destroy();
            const actual1 = await operation;

            // Assert
            assert.equal(actual1, false);
            assert.equal(f.requests.length, stage === 'write' ? 2 : 3);
            assert.equal(f.session.state().revision, 1);
            assert.equal(f.session.hasRecovery(), true);
            assert.equal(f.storage.entries.size, 1);
            assert.equal(JSON.parse([...f.storage.entries.values()][0]).requestId, write.body.requestId);
        }
    });
    test('An operation kind encoded as an array is rejected without enabling game actions', async () => {
        // Arrange
        const f = fixture();

        // Act
        const loading = f.session.load();
        // Arrange
        const invalid = state(1, 0);
        invalid.lastOperation.kind = ['configureParty'];

        // Act
        receive(f.requests.at(-1), invalid);
        const actual1 = await loading;

        // Assert
        assert.equal(actual1, false);
        assert.equal(f.session.state(), null);
        assert.equal(f.session.error(), 'invalidResponse');
        assert.equal(f.session.canOperate(), false);
    });
});
