import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SessionRecord } from '@mastercompanion/contracts';
import { SessionContentSelection } from '../../projects/engine/src/lib/features/sessions/session-content-selection';

function record(id: string, status: SessionRecord['status']): SessionRecord {
  return {
    id,
    status,
    title: id,
    preparationMaterialId: id + '-prep',
    notesMaterialId: id + '-notes',
    summary: '',
    followUp: '',
    pinnedMaterialIds: [],
  };
}

describe('Session reading destination', () => {
  for (const [status, expected] of [
    ['planned', 'preparation'],
    ['active', 'notes'],
    ['completed', 'summary'],
  ] as const) {
    it(`First opening of ${status} selects ${expected}`, () => {
      const selection = new SessionContentSelection();
      const meeting = record('meeting', status);

      selection.initialize(meeting);

      assert.equal(selection.selected(meeting), expected);
    });
  }

  it('Changing lifecycle preserves the reader-selected section', () => {
    const selection = new SessionContentSelection();
    const meeting = record('meeting', 'planned');
    selection.initialize(meeting);
    selection.select(meeting.id, 'summary');

    selection.initialize({ ...meeting, status: 'active' });

    assert.equal(selection.selected(meeting), 'summary');
  });

  it('Switching records retains an independent reading destination for each', () => {
    const selection = new SessionContentSelection();
    const first = record('first', 'planned');
    const second = record('second', 'active');
    selection.initialize(first);
    selection.select(first.id, 'summary');

    selection.initialize(second);
    selection.select(second.id, 'preparation');
    selection.initialize(first);

    assert.equal(selection.selected(first), 'summary');
    assert.equal(selection.selected(second), 'preparation');
  });
});
