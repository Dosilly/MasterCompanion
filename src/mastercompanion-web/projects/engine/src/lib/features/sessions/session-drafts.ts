import { computed, signal } from '@angular/core';
import type { SessionRecord } from '@mastercompanion/contracts';
import { MeetingRecords } from './meeting-records';
import type { SessionTextDraft } from './session-text-draft';

function sameText(
  first: Pick<SessionRecord, 'title' | 'summary' | 'followUp'>,
  second: Pick<SessionRecord, 'title' | 'summary' | 'followUp'>,
): boolean {
  return (
    first.title === second.title &&
    first.summary === second.summary &&
    first.followUp === second.followUp
  );
}

/** Keeps per-meeting text drafts through navigation and rejects implicit rebasing. */
export class SessionDrafts {
  private readonly drafts = signal<ReadonlyMap<string, SessionTextDraft>>(new Map());
  readonly conflict = signal(false);
  readonly dirty = computed(() =>
    [...this.drafts().values()].some((draft) => !sameText(draft, draft.original)),
  );

  value(record: SessionRecord): SessionTextDraft {
    const draft = this.drafts().get(record.id);
    return (
      (draft && !sameText(draft, draft.original) ? draft : undefined) ?? {
        original: record,
        title: record.title,
        summary: record.summary,
        followUp: record.followUp,
      }
    );
  }

  edit(record: SessionRecord, field: 'title' | 'summary' | 'followUp', value: string): void {
    this.drafts.update((drafts) =>
      new Map(drafts).set(record.id, { ...this.value(record), [field]: value }),
    );
  }

  hasChanges(record: SessionRecord): boolean {
    const draft = this.drafts().get(record.id);
    return !!draft && !sameText(draft, draft.original);
  }

  discard(record: SessionRecord): void {
    this.drafts.update((drafts) => {
      const next = new Map(drafts);
      next.delete(record.id);
      return next;
    });
    this.conflict.set(false);
  }

  async save(record: SessionRecord, meetings: MeetingRecords): Promise<boolean> {
    const draft = this.value(record);
    if (!this.hasChanges(record)) {
      return true;
    }
    const current = meetings.snapshot().sessions.find((item) => item.id === record.id);
    if (current && sameText({ ...draft, title: draft.title.trim() }, current)) {
      this.discard(record);
      return true;
    }
    if (!current || !sameText(draft.original, current)) {
      this.conflict.set(true);
      return false;
    }
    const saved = await meetings.execute({
      kind: 'update',
      sessionId: record.id,
      title: draft.title,
      summary: draft.summary,
      followUp: draft.followUp,
    });
    if (saved) {
      this.discard(record);
    }
    return saved;
  }

  async saveAll(meetings: MeetingRecords): Promise<boolean> {
    for (const draft of this.drafts().values()) {
      if (!(await this.save(draft.original, meetings))) {
        return false;
      }
    }
    return true;
  }

  acceptConfirmed(records: readonly SessionRecord[]): void {
    for (const record of records) {
      const draft = this.drafts().get(record.id);
      if (draft && sameText({ ...draft, title: draft.title.trim() }, record)) {
        this.discard(record);
      }
    }
  }
}
