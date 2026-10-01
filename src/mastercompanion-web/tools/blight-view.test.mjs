import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

mkdirSync('.local/tests', { recursive: true });
const compiled = resolve('.local/tests/blight-view.mjs');
writeFileSync(compiled, ts.transpileModule(readFileSync('projects/ythryn/src/lib/gameplay/blight-view.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
const { readBlightView, resolveCheckCommand, selectedCheckDie } = await import(pathToFileURL(compiled));
const firstId = 'd4b79cd8-44ad-4ef7-a2a3-985cff36c6aa';
const secondId = '61466089-3f99-4d97-a497-450e87581165';
function fixture(time = 1080) {
  return {
    revision: 3,
    snapshot: { timeMinutes: time, party: [{ id: firstId, name: 'First' }, { id: secondId, name: 'Second' }],
      restEnds: [1080], moduleSchemaVersion: 1, moduleState: {} },
    moduleView: { characters: [
      { id: firstId, status: 'healthy', dc: 15, failures: 0, nextCheck: { kind: 'exposure', minute: 720, pending: true } },
      { id: secondId, status: 'infected', dc: 12, failures: 1, nextCheck: { kind: 'rest', minute: 1080, pending: true } },
    ] },
    lastOperation: null,
  };
}

test('Projection links names by character ID regardless of projection order', () => {
  const state = fixture();
  state.moduleView.characters.reverse();
  const view = readBlightView(state);
  assert.equal(view[0].name, 'Second');
  assert.equal(view[1].name, 'First');
  assert.equal(view[0].nextCheck.minute, 1080);
});

test('Malformed projections are rejected rather than repaired or partially displayed', () => {
  for (const mutate of [
    state => { state.moduleView = null; },
    state => { state.moduleView.characters = 'not an array'; },
    state => { state.moduleView.characters.pop(); },
    state => { state.moduleView.characters[0].id = 'unknown'; },
    state => { state.moduleView.characters[0].id = secondId; },
    state => { state.moduleView.characters[0].status = 'unknown'; },
    state => { state.moduleView.characters[0].dc = 16; },
    state => { state.moduleView.characters[0].failures = 0.5; },
    state => { state.moduleView.characters[0].nextCheck.pending = false; },
    state => { state.moduleView.characters[0].nextCheck.minute = Infinity; },
    state => { state.moduleView.characters[0].nextCheck.kind = 'unknown'; },
    state => { delete state.moduleView.characters[0].nextCheck; },
    state => { state.snapshot.moduleSchemaVersion = 2; },
    state => { state.snapshot.party[0].id = secondId; },
  ]) {
    const state = fixture();
    mutate(state);
    assert.equal(readBlightView(state), null);
  }
});

test('Projection preserves future deadlines and refuses an inconsistent due flag', () => {
  const state = fixture();
  state.moduleView.characters[0].nextCheck = { kind: 'exposure', minute: 1440, pending: false };
  assert.equal(readBlightView(state)[0].nextCheck.pending, false);
  state.moduleView.characters[0].nextCheck.pending = true;
  assert.equal(readBlightView(state), null);
});

test('Status and check kinds must agree; terminal statuses have no check', () => {
  for (const [status, nextCheck] of [
    ['healthy', null],
    ['healthy', { kind: 'rest', minute: 720, pending: true }],
    ['infected', { kind: 'exposure', minute: 720, pending: true }],
    ['immune', { kind: 'rest', minute: 720, pending: true }],
    ['transformed', { kind: 'exposure', minute: 720, pending: true }],
  ]) {
    const state = fixture();
    Object.assign(state.moduleView.characters[0], { status, nextCheck });
    assert.equal(readBlightView(state), null);
  }
  for (const status of ['infected', 'immune', 'transformed']) {
    const state = fixture();
    Object.assign(state.moduleView.characters[0], { status, nextCheck: null });
    assert.equal(readBlightView(state)[0].nextCheck, null);
  }
});

test('Success on recovery requires one explicit d6 result in the accepted range', () => {
  const character = readBlightView(fixture())[1];
  for (const die of [null, 0, 7, 1.5, NaN, '6']) assert.equal(resolveCheckCommand(character, true, die), null);
  for (let die = 1; die <= 6; die++) {
    assert.deepEqual(resolveCheckCommand(character, true, die), {
      kind: 'resolveCheck', characterId: secondId, success: true, d6: die,
    });
  }
});

test('Exposure and failed recovery commands omit any previously selected die', () => {
  const [healthy, infected] = readBlightView(fixture());
  for (const success of [true, false]) assert.deepEqual(resolveCheckCommand(healthy, success, 6), {
    kind: 'resolveCheck', characterId: firstId, success,
  });
  assert.deepEqual(resolveCheckCommand(infected, false, 6), {
    kind: 'resolveCheck', characterId: secondId, success: false,
  });
});

test('Commands are unavailable for future checks and characters with no scheduled check', () => {
  const state = fixture();
  state.moduleView.characters[0].nextCheck = { kind: 'exposure', minute: 1440, pending: false };
  state.moduleView.characters[1].nextCheck = null;
  for (const character of readBlightView(state)) {
    assert.equal(resolveCheckCommand(character, true, 6), null);
    assert.equal(resolveCheckCommand(character, false, null), null);
  }
});

test('An uncertain write keeps its die while retry success requires a new selection for the next rest', () => {
  const character = readBlightView(fixture())[1];
  const selection = { characterId: character.id, kind: 'rest', minute: 1080, die: 6 };
  assert.equal(selectedCheckDie(structuredClone(character), selection), 6);
  const nextRest = { ...character, nextCheck: { kind: 'rest', minute: 1560, pending: true } };
  assert.equal(selectedCheckDie(nextRest, selection), null);
  assert.equal(resolveCheckCommand(nextRest, true, selectedCheckDie(nextRest, selection)), null);
  assert.equal(selectedCheckDie(nextRest, { ...selection, minute: 1560, die: 2 }), 2);
  assert.equal(selectedCheckDie({ ...character, id: firstId }, selection), null);
  assert.equal(selectedCheckDie({ ...character, nextCheck: { ...character.nextCheck, kind: 'exposure' } }, selection), null);
  assert.equal(selectedCheckDie({ ...character, nextCheck: null }, selection), null);
});
