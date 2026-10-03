import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const directory = resolve('.local/tests/expedition-tool');
mkdirSync(directory, { recursive: true });
const contracts = pathToFileURL(`${directory}/contracts.mjs`).href;
writeFileSync(`${directory}/contracts.mjs`, ts.transpileModule(readFileSync('projects/contracts/src/public-api.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
const messages = JSON.parse(readFileSync('projects/ythryn/src/lib/i18n/en.json', 'utf8'));
writeFileSync(`${directory}/messages.mjs`, `export const uiMessages = ${JSON.stringify(messages)};`);
for (const name of ['action-required', 'blight-view', 'blight-tool', 'expedition-view', 'expedition-tool', 'ythryn-tools']) {
  const source = readFileSync(`projects/ythryn/src/lib/gameplay/${name}.ts`, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText.replaceAll("'@mastercompanion/contracts'", JSON.stringify(contracts))
    .replace(/from '\.\/([^']+)'/g, "from './$1.mjs'")
    .replaceAll("'../i18n/messages'", "'./messages.mjs'");
  writeFileSync(`${directory}/${name}.mjs`, compiled);
}
const { CAMPAIGN_GAME } = await import(contracts);
const { ExpeditionTool } = await import(pathToFileURL(`${directory}/expedition-tool.mjs`));
const { YthrynTools } = await import(pathToFileURL(`${directory}/ythryn-tools.mjs`));
function fixture() {
  const state = signal({ snapshot: { timeMinutes: 1500, restEnds: [480], moduleSchemaVersion: 3,
    party: [{ id: 'hero', name: 'Hero' }] }, moduleView: {
    characters: [{ id: 'hero', status: 'healthy', dc: 15, failures: 0, nextCheck: { kind: 'exposure', minute: 720, pending: true } }],
    expedition: { aurilEnabled: true, explorationMinutes: 120, nextHourlyIn: 60,
      pending: [{ id: 1, minute: 60, kind: 'hourly' }, { id: 2, minute: 120, kind: 'hourly' }], lastResult: null,
      pendingTable: [{ min: 1, max: 50, outcome: 'none' }, { min: 51, max: 100, outcome: 'livingHands' }],
      avarice: { deadline: 480, arrivedAt: null, enabled: true, remainingMinutes: 0, pending: true },
      auril: { deadline: 1440, arrivedAt: null, enabled: true, remainingMinutes: 0, pending: true } } } });
  const requests = [], targets = [];
  const game = { state, canOperate: signal(true), pending: signal(false),
    execute: async action => { requests.push(action); return false; }, openMaterial: target => targets.push(target) };
  const injector = Injector.create({ providers: [{ provide: CAMPAIGN_GAME, useValue: game }] });
  const tool = runInInjectionContext(injector, () => new ExpeditionTool());
  const tools = runInInjectionContext(injector, () => new YthrynTools());
  return { tool, tools, game, requests, targets };
}

test('Dice and repeated rerolls preview freely without writing game state', t => {
  const { tool, game, requests, targets } = fixture();
  const before = structuredClone(game.state());
  t.mock.method(Math, 'random', () => .55);
  tool.roll(1);
  assert.equal(tool.selectedRoll(1), '56');
  assert.equal(tool.preview(), 'livingHands');
  tool.roll(1);
  assert.equal(tool.preview(), 'livingHands', 'A repeated outcome remains editable and rerollable.');
  t.mock.method(Math, 'random', () => 0);
  tool.roll(1);
  assert.equal(tool.selectedRoll(1), '1');
  assert.equal(tool.preview(), 'none');
  t.mock.method(Math, 'random', () => .999999);
  tool.roll(1);
  assert.equal(tool.selectedRoll(1), '100');
  tool.openResult(tool.preview());
  assert.deepEqual(targets, [{ id: 's451a6a504213' }]);
  assert.deepEqual(requests, []);
  assert.deepEqual(game.state(), before);
});
test('Failed confirmation preserves the draft; success clears it for the next check', async t => {
  const { tool, game, requests } = fixture();
  t.mock.method(Math, 'random', () => .55);
  tool.roll(1);
  const event = { preventDefault() {} };
  await tool.resolve(event, 1);
  assert.deepEqual(requests, [{ kind: 'module', command: { kind: 'resolveEncounter', checkId: 1, roll: 56 } }]);
  assert.equal(tool.selectedRoll(1), '56');
  game.execute = async () => {
    game.state.update(value => { const next = structuredClone(value); next.moduleView.expedition.pending.shift(); return next; });
    return true;
  };
  await tool.resolve(event, 1);
  assert.equal(tool.selectedRoll(2), '');
  assert.equal(tool.preview(), null);
});
test('Recovery changing the oldest check prevents carrying a stale roll into the next operation', t => {
  const { tool, game } = fixture();
  t.mock.method(Math, 'random', () => .55);
  tool.roll(1);
  game.state.update(value => { const next = structuredClone(value); next.moduleView.expedition.pending.shift(); return next; });
  assert.equal(tool.selectedRoll(2), '');
  assert.equal(tool.preview(), null);
  game.canOperate.set(false);
  tool.roll(2);
  assert.equal(tool.selectedRoll(2), '');
  game.canOperate.set(true);
  tool.roll(1);
  assert.equal(tool.selectedRoll(2), '');
  tool.roll(2);
  assert.equal(tool.selectedRoll(2), '56');
});
test('Pending summary links disappear after confirmed arrivals and resolved checks', () => {
  const { tools, game } = fixture();
  assert.deepEqual(tools.pendingActions().map(action => action.target),
    ['encounter-queue', 'avarice-arrival', 'auril-arrival', 'blight-character-hero']);
  game.state.update(value => {
    const next = structuredClone(value), expedition = next.moduleView.expedition;
    expedition.pending = []; expedition.pendingTable = null;
    expedition.avarice.arrivedAt = 480; expedition.avarice.pending = false;
    expedition.aurilEnabled = false; expedition.auril.enabled = false; expedition.auril.pending = false;
    next.moduleView.characters[0].nextCheck = { kind: 'exposure', minute: 2160, pending: false };
    return next;
  });
  assert.deepEqual(tools.pendingActions(), []);
});
