import { AfterViewInit, Component, ElementRef, Injector, OnDestroy, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { Editor } from '@tiptap/core';
import type { MaterialSummary } from '@mastercompanion/contracts';
import { createMaterialEditor } from './material-editor';
import { MaterialSession } from './material-session';
import { uiMessages } from '../../i18n/messages';
import { InsertionError, InsertionSelection, insertMarkdown, insertMaterialLink } from './editor-insertion';

@Component({
  selector: 'mc-material-view',
  template: `
    <div class="material-scroll" (click)="followLink($event)">
      <div class="reading-bar">
        <span class="breadcrumb">{{ session().material.group }}</span>
        <div class="actions">
          <span class="save-state" role="status" aria-live="polite">{{ statusLabel() }}</span>
          <button (click)="toggleEdit()">{{ session().editing() ? ui.material.finishEditing : ui.material.edit }}</button>
        </div>
      </div>
      @if (session().error(); as error) {
        <div class="save-error" role="alert">
          <p>{{ ui.material.errors[error] }}</p>
          <button (click)="copyDraft()">{{ ui.material.copyDraft }}</button>
          @if (session().status() !== 'conflict') { <button (click)="session().flush()">{{ ui.material.retrySave }}</button> }
        </div>
      }
      @if (session().editing()) {
        <div class="editor-toolbar" [attr.aria-label]="ui.material.formattingLabel">
          <button [attr.aria-label]="ui.material.bold" (mousedown)="$event.preventDefault()" (click)="editor?.chain().focus().toggleBold().run()"><b>B</b></button>
          <button [attr.aria-label]="ui.material.italic" (mousedown)="$event.preventDefault()" (click)="editor?.chain().focus().toggleItalic().run()"><i>I</i></button>
          <button (mousedown)="$event.preventDefault()" (click)="editor?.chain().focus().toggleHeading({level: 2}).run()">{{ ui.material.heading }}</button>
          <button (mousedown)="$event.preventDefault()" (click)="editor?.chain().focus().toggleBulletList().run()">{{ ui.material.list }}</button>
          <button (mousedown)="$event.preventDefault()" (click)="editor?.chain().focus().toggleBlockquote().run()">{{ ui.material.quote }}</button>
          <button (mousedown)="$event.preventDefault()" (click)="editor?.chain().focus().undo().run()">{{ ui.material.undo }}</button>
          <button (mousedown)="$event.preventDefault()" (click)="editor?.chain().focus().redo().run()">{{ ui.material.redo }}</button>
          <button (mousedown)="$event.preventDefault()" (click)="openInsertion('markdown', $event)">{{ ui.material.insertMarkdown }}</button>
          <button (mousedown)="$event.preventDefault()" (click)="openInsertion('link', $event)">{{ ui.material.insertMaterialLink }}</button>
        </div>
      }
      <article class="reading-paper" [class.is-editing]="session().editing()">
        <h1>{{ session().material.title }}</h1>
        <div #editorElement class="document-body"></div>
      </article>
    </div>
    <dialog #insertionDialog class="editor-insertion-dialog" [attr.aria-labelledby]="insertionId('title')" (cancel)="cancelInsertion($event)">
      <h2 [id]="insertionId('title')">{{ insertionMode() === 'markdown' ? ui.material.insertMarkdown : ui.material.insertMaterialLink }}</h2>
      <div [hidden]="insertionMode() !== 'markdown'">
        <label [attr.for]="insertionId('source')">{{ ui.material.markdownSource }}</label>
        <p [id]="insertionId('help')">{{ ui.material.markdownHelp }}</p>
        <textarea #markdownSource [id]="insertionId('source')" [attr.aria-describedby]="insertionId('help')" [value]="markdownDraft()"
          (input)="updateMarkdown($event)" rows="12"></textarea>
      </div>
      <div [hidden]="insertionMode() !== 'link'">
        <label [attr.for]="insertionId('filter')">{{ ui.material.linkFilter }}</label>
        <input #materialFilter [id]="insertionId('filter')" type="search" [value]="linkFilter()" (input)="updateLinkFilter($event)">
        <label [attr.for]="insertionId('target')">{{ ui.material.linkTarget }}</label>
        <select [id]="insertionId('target')" [value]="linkTarget()" (change)="updateLinkTarget($event)">
          <option value="">{{ ui.material.chooseMaterial }}</option>
          @for (material of filteredMaterials(); track material.id) {
            <option [value]="material.id">{{ material.title }} — {{ material.group }}</option>
          }
        </select>
        @if (filteredMaterials().length === 0) { <p role="status">{{ ui.material.noLinkResults }}</p> }
        <p>{{ ui.material.linkHelp }}</p>
      </div>
      @if (insertionError(); as error) { <p role="alert">{{ ui.material.insertionErrors[error] }}</p> }
      <div class="dialog-actions">
        <button (click)="closeInsertion()">{{ ui.material.cancelInsertion }}</button>
        <button (click)="confirmInsertion()" [disabled]="insertionMode() === 'link' && !linkTarget()">{{ ui.material.confirmInsertion }}</button>
      </div>
    </dialog>
  `,
})
export class MaterialView implements AfterViewInit, OnDestroy {
  readonly ui = uiMessages;
  readonly session = input.required<MaterialSession>();
  readonly materials = input<readonly MaterialSummary[]>([]);
  readonly openMaterial = output<{ id: string; anchor?: string }>();
  readonly editorElement = viewChild.required<ElementRef<HTMLElement>>('editorElement');
  readonly insertionDialog = viewChild.required<ElementRef<HTMLDialogElement>>('insertionDialog');
  readonly markdownSource = viewChild.required<ElementRef<HTMLTextAreaElement>>('markdownSource');
  readonly materialFilter = viewChild.required<ElementRef<HTMLInputElement>>('materialFilter');
  readonly insertionMode = signal<'markdown' | 'link' | null>(null);
  readonly markdownDraft = signal('');
  readonly linkFilter = signal('');
  readonly linkTarget = signal('');
  readonly insertionError = signal<InsertionError | null>(null);
  private readonly injector = inject(Injector);
  private selection?: InsertionSelection;
  private insertionOpener?: HTMLElement;
  editor?: Editor;

  ngAfterViewInit() {
    this.editor = createMaterialEditor(this.editorElement().nativeElement, this.session(), this.ui.material.contentLabel);
  }
  async toggleEdit() {
    if (this.session().editing()) {
      if (!await this.session().flush()) return;
      this.session().editing.set(false);
      this.editor?.setEditable(false, false);
    } else {
      this.session().editing.set(true);
      this.editor?.setEditable(true, false);
      // Make nested blocks reachable in the editor, without changing the stored document.
      this.editorElement().nativeElement.querySelectorAll('details').forEach(item => item.open = true);
    }
  }
  openInsertion(mode: 'markdown' | 'link', event: Event) {
    if (!this.editor || !this.session().editing() || !this.editor.isEditable) return;
    const { from, to } = this.editor.state.selection;
    this.selection = { from, to };
    this.insertionOpener = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.insertionMode.set(mode);
    this.insertionError.set(null);
    afterNextRender(() => {
      if (this.insertionMode() !== mode) return;
      this.insertionDialog().nativeElement.showModal();
      (mode === 'markdown' ? this.markdownSource().nativeElement : this.materialFilter().nativeElement).focus();
    }, { injector: this.injector });
  }
  cancelInsertion(event: Event) {
    event.preventDefault();
    this.closeInsertion();
  }
  closeInsertion() {
    this.insertionDialog().nativeElement.close();
    this.insertionMode.set(null);
    if (this.editor && this.selection) this.editor.commands.setTextSelection(this.selection);
    this.insertionOpener?.focus();
  }
  updateMarkdown(event: Event) {
    if (event.target instanceof HTMLTextAreaElement) this.markdownDraft.set(event.target.value);
    this.insertionError.set(null);
  }
  updateLinkFilter(event: Event) {
    if (event.target instanceof HTMLInputElement) this.linkFilter.set(event.target.value);
    if (!this.filteredMaterials().some(item => item.id === this.linkTarget())) this.linkTarget.set('');
    this.insertionError.set(null);
  }
  updateLinkTarget(event: Event) {
    if (event.target instanceof HTMLSelectElement) this.linkTarget.set(event.target.value);
    this.insertionError.set(null);
  }
  filteredMaterials() {
    const filter = this.linkFilter().trim().toLocaleLowerCase();
    return this.materials().filter(item => `${item.title} ${item.group}`.toLocaleLowerCase().includes(filter));
  }
  confirmInsertion() {
    if (!this.editor || !this.selection) return;
    const mode = this.insertionMode();
    if (!mode) return;
    const error = mode === 'markdown'
      ? insertMarkdown(this.editor, this.session().editing(), this.selection, this.markdownDraft(), this.materials())
      : insertMaterialLink(this.editor, this.session().editing(), this.selection, this.linkTarget(), this.materials());
    this.insertionError.set(error);
    if (error) return;
    if (mode === 'markdown') this.markdownDraft.set('');
    this.insertionDialog().nativeElement.close();
    this.insertionMode.set(null);
    this.editor.view.focus();
  }
  statusLabel() {
    return this.ui.material.status[this.session().status()];
  }
  insertionId(part: string) { return `material-${this.session().material.id}-insertion-${part}`; }
  followLink(event: MouseEvent) {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a') : null;
    if (!link) return;
    event.preventDefault();
    if (this.session().editing()) return;
    const match = link.getAttribute('href')?.match(/^#material\/([^/]+)(?:\/(.+))?$/);
    if (match) this.openMaterial.emit({ id: match[1], anchor: match[2] });
  }
  async copyDraft() {
    try { await navigator.clipboard.writeText(this.editor?.getText() ?? ''); }
    catch { this.session().error.set('clipboardUnavailable'); }
  }
  scrollToAnchor(id: string) {
    const element = Array.from(this.editorElement().nativeElement.querySelectorAll<HTMLElement>('[id]')).find(item => item.id === id);
    if (!element) return;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    element.scrollIntoView({ block: 'start' });
  }
  ngOnDestroy() { this.editor?.destroy(); }
}
