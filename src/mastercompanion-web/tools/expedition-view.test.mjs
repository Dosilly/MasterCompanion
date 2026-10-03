import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

mkdirSync('.local/tests', { recursive: true });
const target = resolve('.local/tests/expedition-view.mjs');
writeFileSync(target, ts.transpileModule(readFileSync('projects/ythryn/src/lib/gameplay/expedition-view.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
const { readExpeditionView, explorationAction, buildingAction, encounterAction, encounterMaterials } = await import(pathToFileURL(target));
function fixture() {
  return {
    snapshot: { timeMinutes: 1500, restEnds: [480], moduleSchemaVersion: 3 },
    moduleView: { expedition: {
      aurilEnabled: true, explorationMinutes: 90, nextHourlyIn: 30,
      pending: [{ id: 1, kind: 'hourly', minute: 60 }, { id: 2, kind: 'building', minute: 90 }], lastResult: null,
      avarice: { deadline: 480, arrivedAt: null, enabled: true, remainingMinutes: 0, pending: true },
      auril: { deadline: 1440, arrivedAt: null, enabled: true, remainingMinutes: 0, pending: true },
    } },
  };
}
test('Expedition projection preserves due chronology and first-rest and 24-hour reminders', () => {
  const state = fixture();
  const view = readExpeditionView(state);
  assert.equal(view.avarice.pending, true);
  assert.equal(view.auril.pending, true);
  assert.equal(view.nextHourlyIn, 30);
  assert.deepEqual(view.pending.map(x => x.minute), [60, 90]);
  state.snapshot.restEnds = [];
  state.moduleView.expedition.avarice = { deadline: null, arrivedAt: null, enabled: true, remainingMinutes: null, pending: false };
  assert.equal(readExpeditionView(state).avarice.deadline, null);
});
test('Malformed expedition projections and inconsistent deadlines fail explicitly', () => {
  for (const mutate of [
    state => { state.moduleView.expedition = null; },
    state => { state.snapshot.moduleSchemaVersion = 2; },
    state => { state.moduleView.expedition.nextHourlyIn = 0; },
    state => { state.moduleView.expedition.explorationMinutes = 1501; },
    state => { state.moduleView.expedition.pending[1].id = 1; },
    state => { state.moduleView.expedition.pending[1].minute = 59; },
    state => { state.moduleView.expedition.pending[0].kind = 'unknown'; },
    state => { state.moduleView.expedition.pending[0].minute = 1501; },
    state => { state.moduleView.expedition.avarice.deadline = 720; },
    state => { state.moduleView.expedition.auril.deadline = 1441; },
    state => { state.moduleView.expedition.auril.pending = false; },
    state => { state.moduleView.expedition.auril.arrivedAt = 1501; },
    state => { state.moduleView.expedition.auril.enabled = false; },
    state => { state.moduleView.expedition.auril.remainingMinutes = -1; },
    state => { state.moduleView.expedition.lastResult = { check: { id: 4, kind: 'hourly', minute: 60 }, roll: 50, outcome: 'none' }; },
  ]) { const state = fixture(); mutate(state); assert.equal(readExpeditionView(state), null); }
});
test('Disabled and already confirmed arrivals have no pending reminder', () => {
  const state = fixture();
  state.moduleView.expedition.avarice.arrivedAt = 480;
  state.moduleView.expedition.avarice.pending = false;
  state.moduleView.expedition.aurilEnabled = false;
  state.moduleView.expedition.auril.enabled = false;
  state.moduleView.expedition.auril.pending = false;
  assert.equal(readExpeditionView(state).avarice.arrivedAt, 480);
  assert.equal(readExpeditionView(state).auril.pending, false);
});
test('Exploration actions combine module behavior and bounded engine time in one request', () => {
  assert.deepEqual(explorationAction(60), { kind: 'module', minutes: 60, command: { kind: 'explore' } });
  for (const value of [0, -1, 1441, 1.5, NaN, Infinity]) assert.equal(explorationAction(value), null);
  assert.deepEqual(buildingAction(true, false), { kind: 'module', minutes: 30, command: { kind: 'searchBuilding', unnumbered: true, newBuilding: false } });
});
test('Roll input belongs to the oldest check and accepts 100 as the table upper boundary', () => {
  const view = readExpeditionView(fixture());
  assert.deepEqual(encounterAction(view, 1, 100), { kind: 'module', command: { kind: 'resolveEncounter', checkId: 1, roll: 100 } });
  for (const value of [0, 101, 1.5, NaN]) assert.equal(encounterAction(view, 1, value), null);
  assert.equal(encounterAction(view, 2, 50), null);
  view.pending.shift();
  assert.equal(encounterAction(view, 1, 50), null);
});
test('Last confirmed results are decoded with a stable material link and bounded roll', () => {
  const state = fixture(); state.moduleView.expedition.pending.shift();
  state.moduleView.expedition.lastResult = { check: { id: 1, kind: 'hourly', minute: 60 }, roll: 56, outcome: 'cultFanatics' };
  const view = readExpeditionView(state);
  assert.equal(encounterMaterials[view.lastResult.outcome], 's081fb4cf10b7');
  for (const outcome of ['unknown', '__proto__', 'constructor']) {
    state.moduleView.expedition.lastResult.outcome = outcome;
    assert.equal(readExpeditionView(state), null);
  }
  state.moduleView.expedition.lastResult.outcome = 'none';
  state.moduleView.expedition.lastResult.roll = 0;
  assert.equal(readExpeditionView(state), null);
});
