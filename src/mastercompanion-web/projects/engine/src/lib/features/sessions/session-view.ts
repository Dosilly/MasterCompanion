import {
  ContextMenuComponent,
  IconComponent,
  SearchableChoiceComponent,
} from '@mastercompanion/ui';
import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { CampaignFolder, MaterialSummary, SessionRecord } from '@mastercompanion/contracts';
import type { ContextMenuPresentation } from '@mastercompanion/ui';
import { MaterialViewHost } from '../materials/material-view-host';
import { materialChoices } from '../choices/campaign-choices';
import { uiMessages } from '../../i18n/messages';
import { MeetingRecords } from './meeting-records';
import { SessionDrafts } from './session-drafts';
import { SessionDeletionDialog } from './session-deletion-dialog';
import type { SessionSection } from './session-section';
import { SessionContentSelection } from './session-content-selection';
import { SessionContentTabs } from './session-content-tabs';
import { defaultSessionTitle } from './default-session-title';

@Component({
  selector: 'mc-session-view',
  imports: [
    ContextMenuComponent,
    IconComponent,
    SearchableChoiceComponent,
    SessionDeletionDialog,
    MaterialViewHost,
    SessionContentTabs,
  ],
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
  readonly recordRequested = output<string>();
  readonly materialsCreated = output<void>();
  readonly text = uiMessages.meetings;
  readonly recoveryText = uiMessages.recovery;
  readonly recoveryError = signal(false);
  readonly copyState = signal<'idle' | 'copied' | 'failed'>('idle');
  readonly copiedText = signal('');
  readonly selectedId = input('');
  readonly creating = signal(false);
  readonly selectedRecordMissing = computed(
    () =>
      !!this.selectedId() &&
      this.meetings().loaded() &&
      !this.meetings()
        .snapshot()
        .sessions.some((record) => record.id === this.selectedId()),
  );
  private suggestedTitle = defaultSessionTitle(new Date(), this.text.defaultTitle);
  readonly newTitle = signal(this.suggestedTitle);
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
  readonly addingPin = signal(false);
  readonly recordMenu = signal<ContextMenuPresentation | null>(null);
  readonly renameTitle = signal('');
  readonly renameBlocked = signal(false);
  readonly renaming = signal(false);
  readonly finishing = signal(false);
  readonly documentHost = viewChild.required(MaterialViewHost);
  private readonly creationDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('creationDialog');
  private readonly renameDialog = viewChild.required<ElementRef<HTMLDialogElement>>('renameDialog');
  private readonly finishDialog = viewChild.required<ElementRef<HTMLDialogElement>>('finishDialog');
  private readonly newButton = viewChild.required<ElementRef<HTMLButtonElement>>('newButton');
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly contentSelection = new SessionContentSelection();
  readonly section = computed(() => this.contentSelection.selected(this.selected()));
  readonly documentId = computed(() => {
    const record = this.selected();
    if (!record || this.section() === 'summary') {
      return null;
    }
    return this.section() === 'preparation' ? record.preparationMaterialId : record.notesMaterialId;
  });
  readonly contentLoading = input(false);
  readonly contentError = input(false);
  readonly closeFailureId = input<string | null>(null);
  readonly contentRetried = output<void>();

  constructor() {
    effect(() => {
      const record = this.selected();
      if (record) {
        this.contentSelection.initialize(record);
      }
    });
  }

  showSection(section: SessionSection): void {
    const record = this.selected();
    if (record) {
      this.contentSelection.select(record.id, section);
    }
  }

  openCreation(): void {
    this.creating.set(true);
    this.creationDialog().nativeElement.showModal();
  }

  openRecordMenu(event: Event): void {
    const trigger = event.currentTarget;
    if (!(trigger instanceof HTMLElement)) {
      return;
    }
    const bounds = trigger.getBoundingClientRect();
    this.recordMenu.set({
      trigger,
      anchor: { x: bounds.left, y: bounds.bottom },
      label: this.text.recordActions,
      actions: [
        { id: 'rename', label: this.text.rename, disabled: this.meetings().locked() },
        { id: 'delete', label: this.text.delete, disabled: this.meetings().locked() },
      ],
    });
  }

  selectRecordAction(action: string): void {
    this.recordMenu.set(null);
    if (action === 'rename') {
      const record = this.selected();
      if (record) {
        if (this.drafts().hasChanges(record)) {
          this.renameBlocked.set(true);
          this.showSection('summary');
          this.beginEditing();
          return;
        }
        this.renameBlocked.set(false);
        this.renameTitle.set(record.title);
        this.renaming.set(true);
        this.renameDialog().nativeElement.showModal();
      }
    } else if (action === 'delete') {
      this.requestDeletion(new Event('click'));
    }
  }

  updateRenameTitle(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.renameTitle.set(event.target.value);
    }
  }

  cancelRename(event?: Event): void {
    event?.preventDefault();
    if (!this.meetings().locked()) {
      this.renameDialog().nativeElement.close();
      this.renaming.set(false);
      this.menuButton()?.nativeElement.focus();
    }
  }

  async rename(event: Event): Promise<void> {
    event.preventDefault();
    const record = this.selected();
    if (!record || !this.renameTitle().trim() || this.meetings().locked()) {
      return;
    }
    if (this.drafts().hasChanges(record)) {
      this.renameBlocked.set(true);
      return;
    }
    if (
      await this.meetings().execute({
        kind: 'update',
        sessionId: record.id,
        title: this.renameTitle().trim(),
        summary: record.summary,
        followUp: record.followUp,
      })
    ) {
      this.cancelRename();
    }
  }

  requestCompletion(): void {
    this.finishing.set(true);
    this.finishDialog().nativeElement.showModal();
  }

  cancelCompletion(event?: Event): void {
    event?.preventDefault();
    if (!this.meetings().locked()) {
      this.finishDialog().nativeElement.close();
      this.finishing.set(false);
    }
  }

  async confirmCompletion(): Promise<void> {
    if (await this.transition('complete')) {
      this.showSection('summary');
      this.cancelCompletion();
    }
  }

  readonly selected = computed(() => {
    const records = this.meetings().snapshot().sessions;
    if (this.selectedId()) {
      return records.find((item) => item.id === this.selectedId());
    }
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
    this.recordRequested.emit(record.id);
    this.pinId.set('');
    this.addingPin.set(false);
    this.copyState.set('idle');
    this.recoveryError.set(false);
  }
  cancelCreation(event?: Event): void {
    event?.preventDefault();
    if (!this.meetings().locked()) {
      this.resetSuggestedTitle();
      this.creating.set(false);
      this.creationDialog().nativeElement.close();
      this.newButton().nativeElement.focus();
      this.closeBlocked.set(false);
    }
  }

  async copyDraft(record: SessionRecord): Promise<void> {
    const draft = this.drafts().value(record);
    const text = `${draft.title}\n\n${this.text.summary}\n${draft.summary}\n\n${this.text.followUp}\n${draft.followUp}`;
    this.copiedText.set(text);
    try {
      await navigator.clipboard.writeText(text);
      this.copyState.set('copied');
    } catch {
      this.copyState.set('failed');
    }
  }

  async inspectSaved(record: SessionRecord): Promise<void> {
    this.recoveryError.set(!(await this.drafts().inspect(record, this.meetings())));
  }

  async reapplyDraft(record: SessionRecord): Promise<void> {
    if (await this.drafts().reapply(record, this.meetings())) {
      this.finishEditing(record.id);
    }
  }
  adoptSaved(record: SessionRecord): void {
    if (this.drafts().adopt(record, this.meetings())) {
      this.finishEditing(record.id);
    } else {
      this.recoveryError.set(true);
    }
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
    this.renameBlocked.set(false);
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
    if (this.deletionTarget() || this.renaming() || this.finishing() || this.meetings().locked()) {
      return false;
    }
    if (this.hasCreationDraft()) {
      this.closeBlocked.set(true);
      return false;
    }
    return this.drafts().saveAll(this.meetings());
  }
  hasRenameDraft(): boolean {
    const record = this.selected();
    return this.renaming() && !!record && this.renameTitle().trim() !== record.title;
  }
  hasCreationDraft(): boolean {
    return !!this.newTitle().trim() && this.newTitle().trim() !== this.suggestedTitle;
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
      this.resetSuggestedTitle();
      this.creating.set(false);
      this.creationDialog().nativeElement.close();
      this.recordRequested.emit(sessionId);
      this.materialsCreated.emit();
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
        this.resetSuggestedTitle();
      }
      this.creating.set(false);
      this.creationDialog().nativeElement.close();
      this.recordRequested.emit(operation.sessionId);
      this.materialsCreated.emit();
    }
    if (confirmed && operation?.kind === 'complete' && this.finishing()) {
      this.showSection('summary');
      this.cancelCompletion();
    }
    if (confirmed && operation?.kind === 'update' && this.renaming()) {
      this.cancelRename();
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

  private resetSuggestedTitle(): void {
    this.suggestedTitle = defaultSessionTitle(new Date(), this.text.defaultTitle);
    this.newTitle.set(this.suggestedTitle);
  }

  cancelDeletion(): void {
    this.deletionTarget.set(null);
    this.deletionConflict.set(false);
    this.menuButton()?.nativeElement.focus();
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
    this.recordRequested.emit(
      this.meetings().activeSession()?.id ?? this.meetings().snapshot().sessions.at(-1)?.id ?? '',
    );
    this.deletionDialog().close(false);
    this.cancelDeletion();
    this.pageTitle().nativeElement.focus();
  }

  async transition(kind: 'start' | 'complete'): Promise<boolean> {
    const record = this.selected();
    if (record && (await this.drafts().save(record, this.meetings()))) {
      return this.meetings().execute({ kind, sessionId: record.id });
    }
    return false;
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
      this.addingPin.set(false);
    }
  }

  unpin(record: SessionRecord, materialId: string): void {
    void this.meetings().execute({ kind: 'unpin', sessionId: record.id, materialId });
  }

  materialTitle(id: string): string {
    return this.materials().find((item) => item.id === id)?.title ?? this.text.missingMaterial;
  }
}
