import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSessionTitle } from '../../projects/engine/src/lib/features/sessions/default-session-title';

describe('Default session title', () => {
  test('Uses padded local calendar fields and the localized template', () => {
    assert.equal(
      defaultSessionTitle(new Date(2026, 0, 5, 0, 10), 'Session {date}'),
      'Session 2026-01-05',
    );
  });
});
