import { Component, computed, input, output, signal } from '@angular/core';
import type { CampaignFolder, MaterialSummary, SessionRecord } from '@mastercompanion/contracts';
import { SearchableChoiceComponent } from '@mastercompanion/ui';
import { materialChoices } from '../choices/campaign-choices';
import { uiMessages } from '../../i18n/messages';
import { MeetingRecords } from './meeting-records';
import { SessionDrafts } from './session-drafts';

@Component({
  selector: 'mc-session-view',
  imports: [SearchableChoiceComponent],
  templateUrl: './session-view.html',
  styleUrl: './session-view.scss',
})
export class SessionView {
  readonly meetings = input.required<MeetingRecords>();
  readonly drafts = input.required<SessionDrafts>();
  readonly materials = input<readonly MaterialSummary[]>([]);
  readonly folders = input<readonly CampaignFolder[]>([]);
  readonly choiceText = uiMessages.choices;
  readonly pinOptions = computed(() => [
    { id: '', label: this.text.chooseMaterial },
    ...materialChoices(this.availablePins(), this.folders(), uiMessages.workspace.unfiledMaterials),
  ]);
  readonly materialRequested = output<string>();
  readonly text = uiMessages.meetings;
  readonly selectedId = signal('');
  readonly newTitle = signal('');
  readonly closeBlocked = signal(false);
  private readonly editingIds = signal<ReadonlySet<string>>(new Set());
  readonly editing = computed(() => this.editingIds().has(this.selected()?.id ?? ''));
  readonly pinId = signal('');
  readonly selected = computed(() => {
    const records = this.meetings().snapshot().sessions;
    return (
      records.find((item) => item.id === this.selectedId()) ??
      this.meetings().activeSession() ??
      records.at(-1)
    );
  });
  readonly draft = computed(() => {
    const record = this.selected();
    return record ? this.drafts().value(record) : null;
  });
  readonly availablePins = computed(() => {
    const pins = this.selected()?.pinnedMaterialIds ?? [];
    return this.materials().filter((item) => !pins.includes(item.id));
  });

  select(record: SessionRecord): void {
    this.selectedId.set(record.id);
    this.pinId.set('');
  }

  beginEditing(): void {
    const record = this.selected();
    if (record && !this.meetings().locked()) {
      this.editingIds.update((ids) => new Set([...ids, record.id]));
    }
  }

  discardEditing(): void {
    const record = this.selected();
    if (record) {
      this.drafts().discard(record);
      this.finishEditing(record.id);
    }
  }

  private finishEditing(id: string): void {
    this.editingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  updateNewTitle(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.newTitle.set(event.target.value);
      this.closeBlocked.set(false);
    }
  }

  async prepareToClose(): Promise<boolean> {
    if (this.newTitle().trim()) {
      this.closeBlocked.set(true);
      return false;
    }
    return this.drafts().saveAll(this.meetings());
  }

  edit(field: 'title' | 'summary' | 'followUp', event: Event): void {
    const record = this.selected();
    if (
      record &&
      !this.meetings().locked() &&
      (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    ) {
      this.drafts().edit(record, field, event.target.value);
    }
  }

  async create(event: Event): Promise<void> {
    event.preventDefault();
    const title = this.newTitle().trim();
    if (!title || this.meetings().locked()) {
      return;
    }
    const sessionId = crypto.randomUUID();
    const created = await this.meetings().execute({
      kind: 'create',
      sessionId,
      title,
      preparationTitle: this.text.preparationDocument.replace('{title}', title),
      notesTitle: this.text.notesDocument.replace('{title}', title),
    });
    if (created) {
      this.newTitle.set('');
      this.selectedId.set(sessionId);
    }
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const record = this.selected();
    if (record) {
      if (await this.drafts().save(record, this.meetings())) {
        this.finishEditing(record.id);
      }
    }
  }

  async retry(): Promise<void> {
    const operation = this.meetings().request()?.operation;
    if ((await this.meetings().retry()) && operation?.kind === 'create') {
      if (this.newTitle().trim() === operation.title.trim()) {
        this.newTitle.set('');
      }
      this.selectedId.set(operation.sessionId);
    }
    this.drafts().acceptConfirmed(this.meetings().snapshot().sessions);
    if (operation?.kind === 'update') {
      const record = this.meetings()
        .snapshot()
        .sessions.find((item) => item.id === operation.sessionId);
      if (record && !this.drafts().hasChanges(record)) {
        this.finishEditing(record.id);
      }
    }
  }

  async transition(kind: 'start' | 'complete'): Promise<void> {
    const record = this.selected();
    if (record && (await this.drafts().save(record, this.meetings()))) {
      await this.meetings().execute({ kind, sessionId: record.id });
    }
  }

  changePin(id: string): void {
    this.pinId.set(id);
  }

  async pin(event: Event): Promise<void> {
    event.preventDefault();
    const record = this.selected();
    const materialId = this.pinId();
    if (
      record &&
      this.availablePins().some((item) => item.id === materialId) &&
      (await this.meetings().execute({ kind: 'pin', sessionId: record.id, materialId }))
    ) {
      this.pinId.set('');
    }
  }

  unpin(record: SessionRecord, materialId: string): void {
    void this.meetings().execute({ kind: 'unpin', sessionId: record.id, materialId });
  }

  materialTitle(id: string): string {
    return this.materials().find((item) => item.id === id)?.title ?? this.text.missingMaterial;
  }
}
