import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_GAME,
  type GameAction,
  type GameStateDto,
  type GameToolContext,
} from '@mastercompanion/contracts';
import { RivalForcesTool } from '../../projects/ythryn/src/lib/gameplay/rival-forces-tool';
import {
  forceDeaths,
  forceLossAction,
  readRivalForcesView,
} from '../../projects/ythryn/src/lib/gameplay/rival-forces-view';

function fixture(): GameStateDto {
  return {
    revision: 1,
    lastOperation: null,
    snapshot: { timeMinutes: 0, restEnds: [], party: [], moduleSchemaVersion: 4, moduleState: {} },
    moduleView: {
      expedition: { auril: { arrivedAt: null } },
      forces: {
        cultFanatics: 20,
        gargoyles: 2,
        ravens: 1,
        mountainGoats: 10,
        frostGiantSkeletons: 3,
        snowGolems: 6,
        winterWolves: 6,
        coldlightWalkers: 0,
        convertedCultists: 0,
      },
    },
  };
}
describe('Rival force projection and casualty commands', () => {
  test('Converted cultists are counted separately from deaths and walker losses', () => {
    const state = fixture();
    state.moduleView = {
      expedition: { auril: { arrivedAt: 0 } },
      forces: {
        cultFanatics: 0,
        gargoyles: 2,
        ravens: 1,
        mountainGoats: 10,
        frostGiantSkeletons: 3,
        snowGolems: 6,
        winterWolves: 6,
        coldlightWalkers: 12,
        convertedCultists: 15,
      },
    };

    const view = readRivalForcesView(state);

    assert.ok(view);
    assert.equal(forceDeaths(view, 'cultFanatics'), 5);
    assert.equal(forceDeaths(view, 'coldlightWalkers'), 3);
    assert.deepEqual(forceLossAction(view, 'coldlightWalkers', 3), {
      kind: 'module',
      command: { kind: 'recordForceLoss', unit: 'coldlightWalkers', count: 3 },
    });
    assert.equal(forceLossAction(view, 'cultFanatics', 1), null);
  });

  for (const losses of [0, -1, 21, 1.5, Number.NaN]) {
    test(`Invalid casualty count ${losses} cannot produce a command`, () => {
      const view = readRivalForcesView(fixture());
      assert.ok(view);

      assert.equal(forceLossAction(view, 'cultFanatics', losses), null);
    });
  }

  for (const [name, forces] of [
    ['negative', { cultFanatics: -1 }],
    ['fractional', { gargoyles: 1.5 }],
    ['over initial count', { winterWolves: 7 }],
    ['walkers without conversion', { coldlightWalkers: 1 }],
    ['conversion before arrival', { convertedCultists: 1 }],
  ] as const) {
    test(`Invalid projection: ${name}`, () => {
      const state = fixture();
      state.moduleView = {
        expedition: { auril: { arrivedAt: null } },
        forces: {
          cultFanatics: 20,
          gargoyles: 2,
          ravens: 1,
          mountainGoats: 10,
          frostGiantSkeletons: 3,
          snowGolems: 6,
          winterWolves: 6,
          coldlightWalkers: 0,
          convertedCultists: 0,
          ...forces,
        },
      };

      assert.equal(readRivalForcesView(state), null);
    });
  }

  test('Failed and blocked saves preserve the casualty draft; confirmation clears it', async (t) => {
    const requests: GameAction[] = [];
    const canOperate = signal(true);
    let success = false;
    const game: GameToolContext = {
      state: signal(fixture()),
      pending: signal(false),
      canOperate,
      execute: async (action) => {
        requests.push(action);
        return success;
      },
      openMaterial() {},
    };
    const injector = Injector.create({ providers: [{ provide: CAMPAIGN_GAME, useValue: game }] });
    t.after(() => injector.destroy());
    const tool = runInInjectionContext(injector, () => new RivalForcesTool());
    tool.setLoss('cultFanatics', '5');
    const event = new Event('submit');

    await tool.recordLoss(event, 'cultFanatics');

    assert.equal(tool.draft().cultFanatics, '5');
    assert.equal(requests.length, 1);

    canOperate.set(false);
    await tool.recordLoss(event, 'cultFanatics');

    assert.equal(requests.length, 1);
    assert.equal(tool.draft().cultFanatics, '5');

    canOperate.set(true);
    success = true;
    await tool.recordLoss(event, 'cultFanatics');

    assert.equal(tool.draft().cultFanatics, undefined);
    assert.deepEqual(requests[1], {
      kind: 'module',
      command: { kind: 'recordForceLoss', unit: 'cultFanatics', count: 5 },
    });
  });
});
