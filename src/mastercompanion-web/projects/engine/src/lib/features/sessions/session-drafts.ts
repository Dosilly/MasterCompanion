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
  private readonly inspected = signal<
    ReadonlyMap<string, { readonly record: SessionRecord; readonly revision: number }>
  >(new Map());
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

  missingRecords(records: readonly SessionRecord[]): readonly SessionRecord[] {
    const ids = new Set(records.map((record) => record.id));
    return [...this.drafts().values()]
      .filter((draft) => !ids.has(draft.original.id) && !sameText(draft, draft.original))
      .map((draft) => draft.original);
  }

  discard(record: SessionRecord): void {
    this.drafts.update((drafts) => {
      const next = new Map(drafts);
      next.delete(record.id);
      return next;
    });
    this.conflict.set(false);
    this.inspected.update((items) => {
      const next = new Map(items);
      next.delete(record.id);
      return next;
    });
  }

  inspectedRecord(id: string): SessionRecord | undefined {
    return this.inspected().get(id)?.record;
  }
  adopt(record: SessionRecord, meetings: MeetingRecords): boolean {
    const inspected = this.inspected().get(record.id);
    if (!inspected || meetings.locked() || inspected.revision !== meetings.snapshot().revision) {
      return false;
    }
    this.discard(record);
    return true;
  }

  async inspect(record: SessionRecord, meetings: MeetingRecords): Promise<boolean> {
    this.inspected.update((items) => {
      const next = new Map(items);
      next.delete(record.id);
      return next;
    });
    if (!(await meetings.refresh())) {
      return false;
    }
    const current = meetings.snapshot().sessions.find((item) => item.id === record.id);
    if (!current) {
      return false;
    }
    this.inspected.update((items) =>
      new Map(items).set(record.id, { record: current, revision: meetings.snapshot().revision }),
    );
    return true;
  }

  async reapply(record: SessionRecord, meetings: MeetingRecords): Promise<boolean> {
    const inspected = this.inspected().get(record.id);
    if (!inspected || meetings.locked()) {
      return false;
    }
    const draft = this.value(record);
    const saved = await meetings.execute(
      {
        kind: 'update',
        sessionId: record.id,
        title: draft.title,
        summary: draft.summary,
        followUp: draft.followUp,
      },
      inspected.revision,
    );
    if (saved) {
      this.discard(record);
    } else {
      this.conflict.set(true);
      this.inspected.update((items) => {
        const next = new Map(items);
        next.delete(record.id);
        return next;
      });
    }
    return saved;
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
