import { IconComponent, SearchableChoiceComponent } from '@mastercompanion/ui';
import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import type { CampaignFolder, MaterialSummary, SessionRecord } from '@mastercompanion/contracts';
import { materialChoices } from '../choices/campaign-choices';
import { uiMessages } from '../../i18n/messages';
import { MeetingRecords } from './meeting-records';
import { SessionDrafts } from './session-drafts';
import { SessionDeletionDialog } from './session-deletion-dialog';

@Component({
  selector: 'mc-session-view',
  imports: [IconComponent, SearchableChoiceComponent, SessionDeletionDialog],
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
  readonly selectedRecordMissing = computed(
    () =>
      !!this.selectedId() &&
      this.meetings().loaded() &&
      !this.meetings()
        .snapshot()
        .sessions.some((record) => record.id === this.selectedId()),
  );
  readonly newTitle = signal('');
  readonly closeBlocked = signal(false);
  readonly deletionTarget = signal<SessionRecord | null>(null);
  readonly deletionConflict = signal(false);
  readonly deletionDirty = computed(() => {
    const record = this.deletionTarget();
    return record ? this.drafts().hasChanges(record) : false;
  });
  readonly missingDraftRecords = computed(() =>
    this.drafts().missingRecords(this.meetings().snapshot().sessions),
  );
  readonly deletionError = computed(() => {
    const error = this.meetings().error();
    return this.deletionConflict()
      ? this.text.deleteChanged
      : error
        ? this.text.errors[error]
        : null;
  });
  private deletionRevision = 0;
  private readonly deletionDialog = viewChild.required(SessionDeletionDialog);
  private readonly pageTitle = viewChild.required<ElementRef<HTMLHeadingElement>>('pageTitle');
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
    if (this.deletionTarget()) {
      return false;
    }
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
    const confirmed = await this.meetings().retry();
    if (confirmed && operation?.kind === 'delete') {
      this.finishDeletion(operation.sessionId);
    }
    if (confirmed && operation?.kind === 'create') {
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

  requestDeletion(event: Event): void {
    const record = this.selected();
    if (!record || this.meetings().locked()) {
      return;
    }
    this.deletionTarget.set(record);
    this.deletionRevision = this.meetings().snapshot().revision;
    this.deletionConflict.set(false);
    this.deletionDialog().open(event);
  }

  cancelDeletion(): void {
    this.deletionTarget.set(null);
    this.deletionConflict.set(false);
  }

  async confirmDeletion(): Promise<void> {
    const record = this.deletionTarget();
    if (!record || this.meetings().locked()) {
      return;
    }
    if (this.deletionRevision !== this.meetings().snapshot().revision) {
      this.deletionConflict.set(true);
      return;
    }
    if (await this.meetings().execute({ kind: 'delete', sessionId: record.id })) {
      this.finishDeletion(record.id);
    }
  }

  private finishDeletion(id: string): void {
    const record = this.deletionTarget();
    if (record?.id === id) {
      this.drafts().discard(record);
    } else {
      const missing = this.missingDraftRecords().find((item) => item.id === id);
      if (missing) {
        this.drafts().discard(missing);
      }
    }
    this.finishEditing(id);
    this.pinId.set('');
    this.selectedId.set(
      this.meetings().activeSession()?.id ?? this.meetings().snapshot().sessions.at(-1)?.id ?? '',
    );
    this.deletionDialog().close(false);
    this.cancelDeletion();
    this.pageTitle().nativeElement.focus();
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
