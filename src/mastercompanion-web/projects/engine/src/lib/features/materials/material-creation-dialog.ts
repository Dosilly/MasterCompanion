import { AfterRenderRef, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, input, output, viewChild } from '@angular/core';
import type { CampaignFolder, MaterialDto } from '@mastercompanion/contracts';
import { MaterialCreation } from './material-creation';
import { folderPath } from '../workspace/navigation';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-material-creation-dialog',
  template: `
    <dialog #dialog class="material-creation-dialog" aria-labelledby="material-creation-title" (cancel)="cancel($event)">
      <h2 id="material-creation-title">{{ ui.notes.newNote }}</h2>
      <form (submit)="submit($event)">
        <label for="note-title">{{ ui.notes.title }}</label>
        <input #titleInput id="note-title" type="text" maxlength="300" required [value]="creation().title()"
          [disabled]="creation().locked()" (input)="updateTitle($event)">
        <label for="note-folder">{{ ui.notes.folder }}</label>
        <select id="note-folder" [value]="creation().folderId() ?? ''" [disabled]="creation().locked()" (change)="updateFolder($event)">
          <option value="">{{ ui.workspace.unfiledMaterials }}</option>
          @for (folder of folderOptions(); track folder.id) { <option [value]="folder.id">{{ folder.label }}</option> }
        </select>
        <p class="creation-hint">{{ ui.notes.readModeHint }}</p>
        @if (creation().pending()) { <p role="status">{{ ui.notes.creating }}</p> }
        @if (creation().error(); as error) { <p class="creation-error" role="alert">{{ ui.notes.errors[error] }}</p> }
        @if (creation().invalidPending()) {
          <p>{{ ui.notes.discardWarning }}</p>
          <button type="button" [disabled]="creation().pending()" (click)="creation().discardUnreadable()">{{ ui.notes.discardUnreadable }}</button>
        }
        <div class="dialog-actions">
          <button type="button" [disabled]="creation().pending()" (click)="close()">{{ ui.notes.cancel }}</button>
          @if (creation().request()) {
            <button type="button" [disabled]="creation().pending()" (click)="retry()">{{ ui.notes.retry }}</button>
          } @else {
            <button type="submit" [disabled]="creation().locked() || !creation().title().trim()">{{ ui.notes.create }}</button>
          }
        </div>
      </form>
    </dialog>
  `,
})
export class MaterialCreationDialog {
  readonly ui = uiMessages;
  readonly creation = input.required<MaterialCreation>();
  readonly folders = input<readonly CampaignFolder[]>([]);
  readonly created = output<MaterialDto>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly titleInput = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private opener?: HTMLElement;
  private render?: AfterRenderRef;
  readonly folderOptions = computed(() => {
    const folders = this.folders();
    const names = new Map(folders.map(folder => [folder.id, folder.title]));
    return folders.map(folder => ({ id: folder.id, label: folderPath([...folders], folder.id).map(id => names.get(id)).join(' / ') }));
  });
  constructor() { this.destroyRef.onDestroy(() => this.render?.destroy()); }
  open(event: Event, defaultFolderId: string | null) {
    this.creation().setDefaultFolder(defaultFolderId);
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.render?.destroy();
    this.render = afterNextRender(() => {
      if (!this.dialog().nativeElement.open) this.dialog().nativeElement.showModal();
      if (!this.creation().locked()) this.titleInput().nativeElement.focus();
    }, { injector: this.injector });
  }
  cancel(event: Event) { event.preventDefault(); this.close(); }
  close(restoreFocus = true) {
    if (this.creation().pending()) return;
    this.dialog().nativeElement.close();
    if (restoreFocus) this.opener?.focus();
  }
  updateTitle(event: Event) { if (event.target instanceof HTMLInputElement) this.creation().setTitle(event.target.value); }
  updateFolder(event: Event) { if (event.target instanceof HTMLSelectElement) this.creation().setFolder(event.target.value || null); }
  async submit(event: Event) {
    event.preventDefault();
    const material = await this.creation().create(this.folders().map(folder => folder.id));
    if (material) { this.close(false); this.created.emit(material); }
  }
  async retry() {
    const material = await this.creation().retry();
    if (material) { this.close(false); this.created.emit(material); }
  }
}
