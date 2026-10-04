import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_GAME } from '@mastercompanion/contracts';
import { ExpeditionTool } from '../../projects/ythryn/src/lib/gameplay/expedition-tool';
import { YthrynTools } from '../../projects/ythryn/src/lib/gameplay/ythryn-tools';
function fixture() {
  const state = signal({
    snapshot: {
      timeMinutes: 1500,
      restEnds: [480],
      moduleSchemaVersion: 4,
      party: [{ id: 'hero', name: 'Hero' }],
    },
    moduleView: {
      characters: [
        {
          id: 'hero',
          status: 'healthy',
          dc: 15,
          failures: 0,
          nextCheck: { kind: 'exposure', minute: 720, pending: true },
        },
      ],
      expedition: {
        aurilEnabled: true,
        explorationMinutes: 120,
        nextHourlyIn: 60,
        pending: [
          { id: 1, minute: 60, kind: 'hourly' },
          { id: 2, minute: 120, kind: 'hourly' },
        ],
        lastResult: null,
        pendingTable: [
          { min: 1, max: 50, outcome: 'none' },
          { min: 51, max: 100, outcome: 'livingHands' },
        ],
        avarice: {
          deadline: 480,
          arrivedAt: null,
          enabled: true,
          remainingMinutes: 0,
          pending: true,
        },
        auril: {
          deadline: 1440,
          arrivedAt: null,
          enabled: true,
          remainingMinutes: 0,
          pending: true,
        },
      },
    },
  });
  const requests = [],
    targets = [];
  const game = {
    state,
    canOperate: signal(true),
    pending: signal(false),
    execute: async (action) => {
      requests.push(action);
      return false;
    },
    openMaterial: (target) => targets.push(target),
  };
  const injector = Injector.create({ providers: [{ provide: CAMPAIGN_GAME, useValue: game }] });
  const tool = runInInjectionContext(injector, () => new ExpeditionTool());
  const tools = runInInjectionContext(injector, () => new YthrynTools());
  return { tool, tools, game, requests, targets };
}
describe('Module tools and campaign game contract', () => {
  test('Dice and repeated rerolls preview freely without writing game state', (t) => {
    // Arrange
    const { tool, game, requests, targets } = fixture();
    const before = structuredClone(game.state());

    // Act
    t.mock.method(Math, 'random', () => 0.55);
    tool.roll(1);

    // Assert
    assert.equal(tool.selectedRoll(1), '56');
    assert.equal(tool.preview(), 'livingHands');

    // Act
    tool.roll(1);

    // Assert
    assert.equal(
      tool.preview(),
      'livingHands',
      'A repeated outcome remains editable and rerollable.',
    );

    // Act
    t.mock.method(Math, 'random', () => 0);
    tool.roll(1);

    // Assert
    assert.equal(tool.selectedRoll(1), '1');
    assert.equal(tool.preview(), 'none');

    // Act
    t.mock.method(Math, 'random', () => 0.999999);
    tool.roll(1);

    // Assert
    assert.equal(tool.selectedRoll(1), '100');

    // Act
    tool.openResult(tool.preview());

    // Assert
    assert.deepEqual(targets, [{ id: 's451a6a504213' }]);
    assert.deepEqual(requests, []);
    assert.deepEqual(game.state(), before);
  });
  test('Failed confirmation preserves the draft; success clears it for the next check', async (t) => {
    // Arrange
    const { tool, game, requests } = fixture();

    // Act
    t.mock.method(Math, 'random', () => 0.55);
    tool.roll(1);
    // Arrange
    const event = { preventDefault() {} };

    // Act
    await tool.resolve(event, 1);

    // Assert
    assert.deepEqual(requests, [
      { kind: 'module', command: { kind: 'resolveEncounter', checkId: 1, roll: 56 } },
    ]);
    assert.equal(tool.selectedRoll(1), '56');
    // Arrange
    game.execute = async () => {
      game.state.update((value) => {
        const next = structuredClone(value);
        next.moduleView.expedition.pending.shift();
        return next;
      });
      return true;
    };

    // Act
    await tool.resolve(event, 1);

    // Assert
    assert.equal(tool.selectedRoll(2), '');
    assert.equal(tool.preview(), null);
  });
  test('Recovery changing the oldest check prevents carrying a stale roll into the next operation', (t) => {
    // Arrange
    const { tool, game } = fixture();

    // Act
    t.mock.method(Math, 'random', () => 0.55);
    tool.roll(1);
    game.state.update((value) => {
      const next = structuredClone(value);
      next.moduleView.expedition.pending.shift();
      return next;
    });

    // Assert
    assert.equal(tool.selectedRoll(2), '');
    assert.equal(tool.preview(), null);

    // Act
    game.canOperate.set(false);
    tool.roll(2);

    // Assert
    assert.equal(tool.selectedRoll(2), '');

    // Act
    game.canOperate.set(true);
    tool.roll(1);

    // Assert
    assert.equal(tool.selectedRoll(2), '');

    // Act
    tool.roll(2);

    // Assert
    assert.equal(tool.selectedRoll(2), '56');
  });
  test('Pending summary links disappear after confirmed arrivals and resolved checks', () => {
    // Arrange
    const { tools, game } = fixture();

    // Assert
    assert.deepEqual(
      tools.pendingActions().map((action) => action.target),
      ['encounter-queue', 'avarice-arrival', 'auril-arrival', 'blight-character-hero'],
    );

    // Act
    game.state.update((value) => {
      const next = structuredClone(value),
        expedition = next.moduleView.expedition;
      expedition.pending = [];
      expedition.pendingTable = null;
      expedition.avarice.arrivedAt = 480;
      expedition.avarice.pending = false;
      expedition.aurilEnabled = false;
      expedition.auril.enabled = false;
      expedition.auril.pending = false;
      next.moduleView.characters[0].nextCheck = { kind: 'exposure', minute: 2160, pending: false };
      return next;
    });

    // Assert
    assert.deepEqual(tools.pendingActions(), []);
  });
});
