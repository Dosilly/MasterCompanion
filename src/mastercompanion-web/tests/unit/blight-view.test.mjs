import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readBlightView,
  remainingCheckMinutes,
  resolveCheckCommand,
  selectedCheckDie,
} from '../../projects/ythryn/src/lib/gameplay/blight-view';
const firstId = 'd4b79cd8-44ad-4ef7-a2a3-985cff36c6aa';
const secondId = '61466089-3f99-4d97-a497-450e87581165';
function fixture(time = 1080) {
  return {
    revision: 3,
    snapshot: {
      timeMinutes: time,
      party: [
        { id: firstId, name: 'First' },
        { id: secondId, name: 'Second' },
      ],
      restEnds: [1080],
      moduleSchemaVersion: 1,
      moduleState: {},
    },
    moduleView: {
      characters: [
        {
          id: firstId,
          status: 'healthy',
          dc: 15,
          failures: 0,
          nextCheck: { kind: 'exposure', minute: 720, pending: true },
        },
        {
          id: secondId,
          status: 'infected',
          dc: 12,
          failures: 1,
          nextCheck: { kind: 'rest', minute: 1080, pending: true },
        },
      ],
    },
    lastOperation: null,
  };
}
describe('Arcane Blight projection and commands', () => {
  test('Projection links names by character ID regardless of projection order', () => {
    // Arrange
    const state = fixture();

    // Act
    state.moduleView.characters.reverse();
    const view = readBlightView(state);

    // Assert
    assert.equal(view[0].name, 'Second');
    assert.equal(view[1].name, 'First');
    assert.equal(view[0].nextCheck.minute, 1080);
  });
  test('Current expedition schema retains the existing Arcane Blight projection', () => {
    // Arrange
    const state = fixture();
    state.snapshot.moduleSchemaVersion = 3;
    state.moduleView.expedition = { opaque: true };

    // Act
    const actual1 = readBlightView(state).length;

    // Assert
    assert.equal(actual1, 2);
    // Arrange
    state.moduleView.characters[1].nextCheck = null;

    // Act
    const actual2 = readBlightView(state);

    // Assert
    assert.equal(actual2, null);
  });
  test('Malformed projections are rejected rather than repaired or partially displayed', () => {
    // Arrange
    for (const mutate of [
      (state) => {
        state.moduleView = null;
      },
      (state) => {
        state.moduleView.characters = 'not an array';
      },
      (state) => {
        state.moduleView.characters.pop();
      },
      (state) => {
        state.moduleView.characters[0].id = 'unknown';
      },
      (state) => {
        state.moduleView.characters[0].id = secondId;
      },
      (state) => {
        state.moduleView.characters[0].status = 'unknown';
      },
      (state) => {
        state.moduleView.characters[0].dc = 16;
      },
      (state) => {
        state.moduleView.characters[0].failures = 0.5;
      },
      (state) => {
        state.moduleView.characters[0].nextCheck.pending = false;
      },
      (state) => {
        state.moduleView.characters[0].nextCheck.minute = Infinity;
      },
      (state) => {
        state.moduleView.characters[0].nextCheck.kind = 'unknown';
      },
      (state) => {
        delete state.moduleView.characters[0].nextCheck;
      },
      (state) => {
        state.snapshot.moduleSchemaVersion = 5;
      },
      (state) => {
        state.snapshot.party[0].id = secondId;
      },
    ]) {
      // Arrange
      const state = fixture();

      // Act
      mutate(state);
      const actual1 = readBlightView(state);

      // Assert
      assert.equal(actual1, null);
    }
  });
  test('Projection preserves future deadlines and refuses an inconsistent due flag', () => {
    // Arrange
    const state = fixture();
    state.moduleView.characters[0].nextCheck = { kind: 'exposure', minute: 1440, pending: false };

    // Act
    const actual1 = readBlightView(state)[0].nextCheck.pending;

    // Assert
    assert.equal(actual1, false);
    // Arrange
    state.moduleView.characters[0].nextCheck.pending = true;

    // Act
    const actual2 = readBlightView(state);

    // Assert
    assert.equal(actual2, null);
  });
  test('Check countdown follows game time and clamps due and overdue deadlines to zero', () => {
    // Arrange
    for (const [gameMinute, expected] of [
      [0, 720],
      [60, 660],
      [719, 1],
      [720, 0],
      [1080, 0],
    ]) {
      // Act
      const actual1 = remainingCheckMinutes(720, gameMinute);

      // Assert
      assert.equal(actual1, expected);
      // Arrange
      const state = fixture(gameMinute);
      state.moduleView.characters[0].nextCheck.pending = gameMinute >= 720;
      state.moduleView.characters[1].nextCheck.pending = gameMinute >= 1080;

      // Act
      const check = readBlightView(state)[0].nextCheck;

      // Assert
      assert.equal(check.remainingMinutes, expected);
      assert.equal(check.minute, 720, 'Countdown must preserve the absolute check identity');
    }
  });
  test('Advancing game time updates countdown without replacing the check or its selected die', () => {
    // Arrange
    const futureState = fixture(0);
    futureState.moduleView.characters[0].nextCheck.pending = false;
    futureState.moduleView.characters[1].nextCheck.pending = false;

    // Act
    const futureCheck = readBlightView(futureState)[0].nextCheck;
    // Arrange
    futureState.snapshot.timeMinutes = 60;

    // Act
    const advancedCheck = readBlightView(futureState)[0].nextCheck;

    // Assert
    assert.equal(futureCheck.remainingMinutes, 720);
    assert.equal(advancedCheck.remainingMinutes, 660);
    assert.equal(advancedCheck.minute, futureCheck.minute);
    // Arrange
    const state = fixture(1080);

    // Act
    const before = readBlightView(state)[1];
    // Arrange
    const selection = { characterId: secondId, kind: 'rest', minute: 1080, die: 4 };
    state.snapshot.timeMinutes = 1140;

    // Act
    const after = readBlightView(state)[1];

    // Assert
    assert.equal(after.nextCheck.remainingMinutes, 0);
    assert.equal(after.nextCheck.minute, before.nextCheck.minute);

    // Act
    const actual1 = selectedCheckDie(after, selection);

    // Assert
    assert.equal(actual1, 4);

    // Act
    const actual2 = resolveCheckCommand(after, true, selectedCheckDie(after, selection));

    // Assert
    assert.deepEqual(actual2, {
      kind: 'resolveCheck',
      characterId: secondId,
      success: true,
      d6: 4,
    });
  });
  test('Status and check kinds must agree; terminal statuses have no check', () => {
    // Arrange
    for (const [status, nextCheck] of [
      ['healthy', null],
      ['healthy', { kind: 'rest', minute: 720, pending: true }],
      ['healthy', { kind: 'recovery', minute: 720, pending: true }],
      ['infected', { kind: 'exposure', minute: 720, pending: true }],
      ['immune', { kind: 'rest', minute: 720, pending: true }],
      ['immune', { kind: 'recovery', minute: 720, pending: true }],
      ['transformed', { kind: 'exposure', minute: 720, pending: true }],
      ['transformed', { kind: 'recovery', minute: 720, pending: true }],
    ]) {
      // Arrange
      const state = fixture();
      state.snapshot.moduleSchemaVersion = 2;

      // Act
      Object.assign(state.moduleView.characters[0], { status, nextCheck });
      const actual1 = readBlightView(state);

      // Assert
      assert.equal(actual1, null);
    }
    for (const status of ['infected', 'immune', 'transformed']) {
      // Arrange
      const state = fixture();

      // Act
      Object.assign(state.moduleView.characters[0], { status, nextCheck: null });
      const actual1 = readBlightView(state)[0].nextCheck;

      // Assert
      assert.equal(actual1, null);
    }
  });
  test('Success on recovery requires one explicit d6 result in the accepted range', () => {
    // Arrange
    for (const kind of ['rest', 'recovery']) {
      // Arrange
      const state = fixture();
      state.snapshot.moduleSchemaVersion = 2;
      state.moduleView.characters[1].nextCheck.kind = kind;

      // Act
      const character = readBlightView(state)[1];
      for (const die of [null, 0, 7, 1.5, NaN, '6'])
        assert.equal(resolveCheckCommand(character, true, die), null);
      for (let die = 1; die <= 6; die++) {
        // Act
        const actual1 = resolveCheckCommand(character, true, die);

        // Assert
        assert.deepEqual(actual1, {
          kind: 'resolveCheck',
          characterId: secondId,
          success: true,
          d6: die,
        });
      }
    }
  });
  test('Current-schema infected characters have a timed recovery countdown; legacy rest-only projections remain readable', () => {
    // Arrange
    const state = fixture();
    state.snapshot.moduleSchemaVersion = 2;
    state.moduleView.characters[1].nextCheck = { kind: 'recovery', minute: 1440, pending: false };

    // Act
    const infected = readBlightView(state)[1];

    // Assert
    assert.equal(infected.nextCheck.kind, 'recovery');
    assert.equal(infected.nextCheck.remainingMinutes, 360);

    // Act
    const actual1 = resolveCheckCommand(infected, true, 6);

    // Assert
    assert.equal(actual1, null);

    // Act
    const actual2 = resolveCheckCommand(infected, false, null);

    // Assert
    assert.equal(actual2, null);
    // Arrange
    state.moduleView.characters[1].nextCheck = null;

    // Act
    const actual3 = readBlightView(state);

    // Assert
    assert.equal(actual3, null);
    // Arrange
    state.snapshot.moduleSchemaVersion = 1;

    // Act
    const actual4 = readBlightView(state)[1].nextCheck;

    // Assert
    assert.equal(actual4, null);
    // Arrange
    state.moduleView.characters[1].nextCheck = { kind: 'recovery', minute: 1440, pending: false };

    // Act
    const actual5 = readBlightView(state);

    // Assert
    assert.equal(actual5, null);
  });
  test('Timed recovery failure omits the die and a rest at the same minute requires a fresh selection', () => {
    // Arrange
    const state = fixture();
    state.snapshot.moduleSchemaVersion = 2;
    state.moduleView.characters[1].nextCheck.kind = 'recovery';

    // Act
    const recovery = readBlightView(state)[1];
    // Arrange
    const selection = { characterId: secondId, kind: 'recovery', minute: 1080, die: 3 };

    // Act
    const actual1 = selectedCheckDie(recovery, selection);

    // Assert
    assert.equal(actual1, 3);

    // Act
    const actual2 = resolveCheckCommand(recovery, false, 3);

    // Assert
    assert.deepEqual(actual2, {
      kind: 'resolveCheck',
      characterId: secondId,
      success: false,
    });
    // Arrange
    state.moduleView.characters[1].nextCheck.kind = 'rest';

    // Act
    const rest = readBlightView(state)[1];
    const actual3 = selectedCheckDie(rest, selection);

    // Assert
    assert.equal(actual3, null);

    // Act
    const actual4 = resolveCheckCommand(rest, true, selectedCheckDie(rest, selection));

    // Assert
    assert.equal(actual4, null);
  });
  test('Exposure and failed recovery commands omit any previously selected die', () => {
    // Act
    const [healthy, infected] = readBlightView(fixture());
    for (const success of [true, false])
      assert.deepEqual(resolveCheckCommand(healthy, success, 6), {
        kind: 'resolveCheck',
        characterId: firstId,
        success,
      });
    const actual1 = resolveCheckCommand(infected, false, 6);

    // Assert
    assert.deepEqual(actual1, {
      kind: 'resolveCheck',
      characterId: secondId,
      success: false,
    });
  });
  test('Commands are unavailable for future checks and characters with no scheduled check', () => {
    // Arrange
    const state = fixture();
    state.moduleView.characters[0].nextCheck = { kind: 'exposure', minute: 1440, pending: false };
    state.moduleView.characters[1].nextCheck = null;
    for (const character of readBlightView(state)) {
      // Act
      const actual1 = resolveCheckCommand(character, true, 6);

      // Assert
      assert.equal(actual1, null);

      // Act
      const actual2 = resolveCheckCommand(character, false, null);

      // Assert
      assert.equal(actual2, null);
    }
  });
  test('An uncertain write keeps its die while retry success requires a new selection for the next rest', () => {
    // Act
    const character = readBlightView(fixture())[1];
    // Arrange
    const selection = { characterId: character.id, kind: 'rest', minute: 1080, die: 6 };

    // Act
    const actual1 = selectedCheckDie(structuredClone(character), selection);

    // Assert
    assert.equal(actual1, 6);
    // Arrange
    const nextRest = { ...character, nextCheck: { kind: 'rest', minute: 1560, pending: true } };

    // Act
    const actual2 = selectedCheckDie(nextRest, selection);

    // Assert
    assert.equal(actual2, null);

    // Act
    const actual3 = resolveCheckCommand(nextRest, true, selectedCheckDie(nextRest, selection));

    // Assert
    assert.equal(actual3, null);

    // Act
    const actual4 = selectedCheckDie(nextRest, { ...selection, minute: 1560, die: 2 });

    // Assert
    assert.equal(actual4, 2);

    // Act
    const actual5 = selectedCheckDie({ ...character, id: firstId }, selection);

    // Assert
    assert.equal(actual5, null);

    // Act
    const actual6 = selectedCheckDie(
      { ...character, nextCheck: { ...character.nextCheck, kind: 'exposure' } },
      selection,
    );

    // Assert
    assert.equal(actual6, null);

    // Act
    const actual7 = selectedCheckDie({ ...character, nextCheck: null }, selection);

    // Assert
    assert.equal(actual7, null);
  });
});
