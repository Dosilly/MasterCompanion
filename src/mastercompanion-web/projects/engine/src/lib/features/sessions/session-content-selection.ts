import { signal } from '@angular/core';
import type { SessionRecord } from '@mastercompanion/contracts';
import { initialSessionSection, type SessionSection } from './session-section';

/** Retains the reader's destination independently of the meeting lifecycle. */
export class SessionContentSelection {
  private readonly sections = signal<ReadonlyMap<string, SessionSection>>(new Map());

  initialize(record: SessionRecord): void {
    if (!this.sections().has(record.id)) {
      this.select(record.id, initialSessionSection(record.status));
    }
  }

  selected(record: SessionRecord | undefined): SessionSection {
    return record
      ? (this.sections().get(record.id) ?? initialSessionSection(record.status))
      : 'preparation';
  }

  select(id: string, section: SessionSection): void {
    this.sections.update((sections) => new Map([...sections, [id, section]]));
  }
}
