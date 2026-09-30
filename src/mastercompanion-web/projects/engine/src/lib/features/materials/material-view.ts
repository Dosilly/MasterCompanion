import { AfterViewInit, Component, ElementRef, OnDestroy, input, output, viewChild } from '@angular/core';
import { Editor } from '@tiptap/core';
import { createMaterialEditor } from './material-editor';
import { MaterialSession } from './material-session';
import { uiMessages } from '../../i18n/messages';

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
        </div>
      }
      <article class="reading-paper" [class.is-editing]="session().editing()">
        <h1>{{ session().material.title }}</h1>
        <div #editorElement class="document-body"></div>
      </article>
    </div>
  `,
})
export class MaterialView implements AfterViewInit, OnDestroy {
  readonly ui = uiMessages;
  readonly session = input.required<MaterialSession>();
  readonly openMaterial = output<{ id: string; anchor?: string }>();
  readonly editorElement = viewChild.required<ElementRef<HTMLElement>>('editorElement');
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
  statusLabel() {
    return this.ui.material.status[this.session().status()];
  }
  followLink(event: MouseEvent) {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a');
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
