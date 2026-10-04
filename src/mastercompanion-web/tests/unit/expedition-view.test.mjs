import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readExpeditionView,
  explorationAction,
  buildingAction,
  encounterAction,
  encounterMaterials,
  encounterPreview,
  selectedEncounterRoll,
} from '../../projects/ythryn/src/lib/gameplay/expedition-view';
function fixture() {
  return {
    snapshot: { timeMinutes: 1500, restEnds: [480], moduleSchemaVersion: 3 },
    moduleView: {
      expedition: {
        aurilEnabled: true,
        explorationMinutes: 90,
        nextHourlyIn: 30,
        pending: [
          { id: 1, kind: 'hourly', minute: 60 },
          { id: 2, kind: 'building', minute: 90 },
        ],
        lastResult: null,
        pendingTable: [
          { min: 1, max: 50, outcome: 'none' },
          { min: 51, max: 55, outcome: 'tombTapper' },
          { min: 56, max: 60, outcome: 'livingHands' },
          { min: 61, max: 65, outcome: 'spittingMimics' },
          { min: 66, max: 70, outcome: 'gargoyles' },
          { min: 71, max: 75, outcome: 'galvanPatrol' },
          { min: 76, max: 80, outcome: 'hypnosPatrol' },
          { min: 81, max: 90, outcome: 'nothics' },
          { min: 91, max: 100, outcome: 'iriolarthas' },
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
  };
}
describe('Expedition projection and commands', () => {
  test('Expedition projection preserves due chronology and first-rest and 24-hour reminders', () => {
    // Arrange
    const state = fixture();

    // Act
    const view = readExpeditionView(state);

    // Assert
    assert.equal(view.avarice.pending, true);
    assert.equal(view.auril.pending, true);
    assert.equal(view.nextHourlyIn, 30);
    assert.deepEqual(
      view.pending.map((x) => x.minute),
      [60, 90],
    );
    // Arrange
    state.snapshot.restEnds = [];
    state.moduleView.expedition.avarice = {
      deadline: null,
      arrivedAt: null,
      enabled: true,
      remainingMinutes: null,
      pending: false,
    };

    // Act
    const actual1 = readExpeditionView(state).avarice.deadline;

    // Assert
    assert.equal(actual1, null);
  });
  test('Preview maps every table endpoint and clears stale or invalid selections', () => {
    // Act
    const view = readExpeditionView(fixture());
    // Arrange
    const check = view.pending[0];
    for (const band of view.pendingTable) {
      // Arrange
      for (const roll of [band.min, band.max])
        assert.equal(encounterPreview(view, { check, value: String(roll) }), band.outcome);
    }
    for (const value of ['', '0', '101', '1.5', 'NaN'])
      assert.equal(encounterPreview(view, { check, value }), null);
    for (const staleCheck of [
      { ...check, id: 2 },
      { ...check, minute: 90 },
      { ...check, kind: 'building' },
    ]) {
      // Arrange
      const draft = { check: staleCheck, value: '56' };

      // Act
      const actual1 = selectedEncounterRoll(view, draft);

      // Assert
      assert.equal(actual1, '');

      // Act
      const actual2 = encounterPreview(view, draft);

      // Assert
      assert.equal(actual2, null);
    }

    // Act
    const actual1 = encounterPreview(view, null);

    // Assert
    assert.equal(actual1, null);
  });
  test('Preview uses refreshed server replacements and the separate patrol table', () => {
    // Arrange
    const state = fixture();
    const draft = { check: state.moduleView.expedition.pending[0], value: '56' };

    // Act
    const actual1 = encounterPreview(readExpeditionView(state), draft);

    // Assert
    assert.equal(actual1, 'livingHands');
    // Arrange
    state.moduleView.expedition.pendingTable[2].outcome = 'cultFanatics';

    // Act
    const actual2 = encounterPreview(readExpeditionView(state), draft);

    // Assert
    assert.equal(actual2, 'cultFanatics');
    // Arrange
    state.moduleView.expedition.pending[0].kind = 'avaricePatrol';
    state.moduleView.expedition.pendingTable = [
      { min: 1, max: 20, outcome: 'avaricePatrol' },
      { min: 21, max: 100, outcome: 'none' },
    ];

    // Act
    const actual3 = encounterPreview(readExpeditionView(state), { ...draft, value: '20' });

    // Assert
    assert.equal(actual3, 'avaricePatrol');

    // Act
    const actual4 = encounterPreview(readExpeditionView(state), { ...draft, value: '21' });

    // Assert
    assert.equal(actual4, 'none');
  });
  test('Incomplete, overlapping or unknown preview tables fail explicitly', () => {
    // Arrange
    for (const mutate of [
      (table) => {
        table[0].min = 0;
      },
      (table) => {
        table[1].min = 50;
      },
      (table) => {
        table[1].min = 52;
      },
      (table) => {
        table[0].max = 0;
      },
      (table) => {
        table[0].max = 50.5;
      },
      (table) => {
        table[8].max = 101;
      },
      (table) => {
        table[8].max = 99;
      },
      (table) => {
        table[1].outcome = 'constructor';
      },
      (table) => {
        table[1].outcome = 'unknown';
      },
      (table) => {
        table.pop();
      },
    ]) {
      // Arrange
      const state = fixture();

      // Act
      mutate(state.moduleView.expedition.pendingTable);
      const actual1 = readExpeditionView(state);

      // Assert
      assert.equal(actual1, null);
    }
    for (const table of [undefined, null, [], 'invalid']) {
      // Arrange
      const state = fixture();
      state.moduleView.expedition.pendingTable = table;

      // Act
      const actual1 = readExpeditionView(state);

      // Assert
      assert.equal(actual1, null);
    }
    const state = fixture();
    state.moduleView.expedition.pending = [];

    // Act
    const actual1 = readExpeditionView(state);

    // Assert
    assert.equal(actual1, null);
    // Arrange
    state.moduleView.expedition.pendingTable = null;

    // Act
    const actual2 = readExpeditionView(state).pendingTable;

    // Assert
    assert.equal(actual2, null);
  });
  test('Malformed expedition projections and inconsistent deadlines fail explicitly', () => {
    // Arrange
    for (const mutate of [
      (state) => {
        state.moduleView.expedition = null;
      },
      (state) => {
        state.snapshot.moduleSchemaVersion = 2;
      },
      (state) => {
        state.moduleView.expedition.nextHourlyIn = 0;
      },
      (state) => {
        state.moduleView.expedition.explorationMinutes = 1501;
      },
      (state) => {
        state.moduleView.expedition.pending[1].id = 1;
      },
      (state) => {
        state.moduleView.expedition.pending[1].minute = 59;
      },
      (state) => {
        state.moduleView.expedition.pending[0].kind = 'unknown';
      },
      (state) => {
        state.moduleView.expedition.pending[0].minute = 1501;
      },
      (state) => {
        state.moduleView.expedition.avarice.deadline = 720;
      },
      (state) => {
        state.moduleView.expedition.auril.deadline = 1441;
      },
      (state) => {
        state.moduleView.expedition.auril.pending = false;
      },
      (state) => {
        state.moduleView.expedition.auril.arrivedAt = 1501;
      },
      (state) => {
        state.moduleView.expedition.auril.enabled = false;
      },
      (state) => {
        state.moduleView.expedition.auril.remainingMinutes = -1;
      },
      (state) => {
        state.moduleView.expedition.lastResult = {
          check: { id: 4, kind: 'hourly', minute: 60 },
          roll: 50,
          outcome: 'none',
        };
      },
    ]) {
      // Arrange
      const state = fixture();

      // Act
      mutate(state);
      const actual1 = readExpeditionView(state);

      // Assert
      assert.equal(actual1, null);
    }
  });
  test('Disabled and already confirmed arrivals have no pending reminder', () => {
    // Arrange
    const state = fixture();
    state.moduleView.expedition.avarice.arrivedAt = 480;
    state.moduleView.expedition.avarice.pending = false;
    state.moduleView.expedition.aurilEnabled = false;
    state.moduleView.expedition.auril.enabled = false;
    state.moduleView.expedition.auril.pending = false;

    // Act
    const actual1 = readExpeditionView(state).avarice.arrivedAt;

    // Assert
    assert.equal(actual1, 480);

    // Act
    const actual2 = readExpeditionView(state).auril.pending;

    // Assert
    assert.equal(actual2, false);
  });
  test('Exploration actions combine module behavior and bounded engine time in one request', () => {
    // Act
    const actual1 = explorationAction(60);

    // Assert
    assert.deepEqual(actual1, { kind: 'module', minutes: 60, command: { kind: 'explore' } });
    for (const value of [0, -1, 1441, 1.5, NaN, Infinity])
      assert.equal(explorationAction(value), null);

    // Act
    const actual2 = buildingAction(true, false);

    // Assert
    assert.deepEqual(actual2, {
      kind: 'module',
      minutes: 30,
      command: { kind: 'searchBuilding', unnumbered: true, newBuilding: false },
    });
  });
  test('Roll input belongs to the oldest check and accepts 100 as the table upper boundary', () => {
    // Act
    const view = readExpeditionView(fixture());
    const actual1 = encounterAction(view, 1, 100);

    // Assert
    assert.deepEqual(actual1, {
      kind: 'module',
      command: { kind: 'resolveEncounter', checkId: 1, roll: 100 },
    });
    for (const value of [0, 101, 1.5, NaN]) assert.equal(encounterAction(view, 1, value), null);

    // Act
    const actual2 = encounterAction(view, 2, 50);

    // Assert
    assert.equal(actual2, null);

    // Act
    view.pending.shift();
    const actual3 = encounterAction(view, 1, 50);

    // Assert
    assert.equal(actual3, null);
  });
  test('Last confirmed results are decoded with a stable material link and bounded roll', () => {
    // Arrange
    const state = fixture();

    // Act
    state.moduleView.expedition.pending.shift();
    // Arrange
    state.moduleView.expedition.lastResult = {
      check: { id: 1, kind: 'hourly', minute: 60 },
      roll: 56,
      outcome: 'cultFanatics',
    };

    // Act
    const view = readExpeditionView(state);
    const actual1 = encounterMaterials[view.lastResult.outcome];

    // Assert
    assert.equal(actual1, 's081fb4cf10b7');
    for (const outcome of ['unknown', '__proto__', 'constructor']) {
      // Arrange
      state.moduleView.expedition.lastResult.outcome = outcome;

      // Act
      const actual1 = readExpeditionView(state);

      // Assert
      assert.equal(actual1, null);
    }
    // Arrange
    state.moduleView.expedition.lastResult.outcome = 'none';
    state.moduleView.expedition.lastResult.roll = 0;

    // Act
    const actual2 = readExpeditionView(state);

    // Assert
    assert.equal(actual2, null);
  });
});
