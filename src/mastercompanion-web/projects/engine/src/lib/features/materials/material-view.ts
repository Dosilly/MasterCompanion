import {
  AfterViewInit,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import type { MaterialSummary } from '@mastercompanion/contracts';
import { createMaterialEditor } from './material-editor';
import { MaterialSession } from './material-session';
import { uiMessages } from '../../i18n/messages';
import {
  InsertionError,
  InsertionSelection,
  insertMarkdown,
  insertMaterialLink,
} from './editor-insertion';

@Component({
  selector: 'mc-material-view',
  templateUrl: './material-view.html',
  styleUrl: './material-view.scss',
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
    this.editor = createMaterialEditor(
      this.editorElement().nativeElement,
      this.session(),
      this.ui.material.contentLabel,
    );
  }
  async toggleEdit() {
    if (this.session().editing()) {
      if (!(await this.session().flush())) {
        return;
      }
      this.session().editing.set(false);
      this.editor?.setEditable(false, false);
    } else {
      this.session().editing.set(true);
      this.editor?.setEditable(true, false);
      // Make nested blocks reachable in the editor, without changing the stored document.
      this.editorElement()
        .nativeElement.querySelectorAll('details')
        .forEach((item) => (item.open = true));
    }
  }
  openInsertion(mode: 'markdown' | 'link', event: Event) {
    if (!this.editor || !this.session().editing() || !this.editor.isEditable) {
      return;
    }
    const { from, to } = this.editor.state.selection;
    this.selection = { from, to };
    this.insertionOpener =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.insertionMode.set(mode);
    this.insertionError.set(null);
    afterNextRender(
      () => {
        if (this.insertionMode() !== mode) {
          return;
        }
        this.insertionDialog().nativeElement.showModal();
        (mode === 'markdown'
          ? this.markdownSource().nativeElement
          : this.materialFilter().nativeElement
        ).focus();
      },
      { injector: this.injector },
    );
  }
  cancelInsertion(event: Event) {
    event.preventDefault();
    this.closeInsertion();
  }
  closeInsertion() {
    this.insertionDialog().nativeElement.close();
    this.insertionMode.set(null);
    if (this.editor && this.selection) {
      this.editor.commands.setTextSelection(this.selection);
    }
    this.insertionOpener?.focus();
  }
  updateMarkdown(event: Event) {
    if (event.target instanceof HTMLTextAreaElement) {
      this.markdownDraft.set(event.target.value);
    }
    this.insertionError.set(null);
  }
  updateLinkFilter(event: Event) {
    if (event.target instanceof HTMLInputElement) {
      this.linkFilter.set(event.target.value);
    }
    if (!this.filteredMaterials().some((item) => item.id === this.linkTarget())) {
      this.linkTarget.set('');
    }
    this.insertionError.set(null);
  }
  updateLinkTarget(event: Event) {
    if (event.target instanceof HTMLSelectElement) {
      this.linkTarget.set(event.target.value);
    }
    this.insertionError.set(null);
  }
  filteredMaterials() {
    const filter = this.linkFilter().trim().toLocaleLowerCase();
    return this.materials().filter((item) =>
      `${item.title} ${item.group}`.toLocaleLowerCase().includes(filter),
    );
  }
  confirmInsertion() {
    if (!this.editor || !this.selection) {
      return;
    }
    const mode = this.insertionMode();
    if (!mode) {
      return;
    }
    const error =
      mode === 'markdown'
        ? insertMarkdown(
            this.editor,
            this.session().editing(),
            this.selection,
            this.markdownDraft(),
            this.materials(),
          )
        : insertMaterialLink(
            this.editor,
            this.session().editing(),
            this.selection,
            this.linkTarget(),
            this.materials(),
          );
    this.insertionError.set(error);
    if (error) {
      return;
    }
    if (mode === 'markdown') {
      this.markdownDraft.set('');
    }
    this.insertionDialog().nativeElement.close();
    this.insertionMode.set(null);
    this.editor.view.focus();
  }
  statusLabel() {
    return this.ui.material.status[this.session().status()];
  }
  insertionId(part: string) {
    return `material-${this.session().material.id}-insertion-${part}`;
  }
  followLink(event: MouseEvent) {
    const link =
      event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a') : null;
    if (!link) {
      return;
    }
    event.preventDefault();
    if (this.session().editing()) {
      return;
    }
    const match = link.getAttribute('href')?.match(/^#material\/([^/]+)(?:\/(.+))?$/);
    if (match) {
      this.openMaterial.emit({ id: match[1], anchor: match[2] });
    }
  }
  async copyDraft() {
    try {
      await navigator.clipboard.writeText(this.editor?.getText() ?? '');
    } catch {
      this.session().error.set('clipboardUnavailable');
    }
  }
  scrollToAnchor(id: string) {
    const element = Array.from(
      this.editorElement().nativeElement.querySelectorAll<HTMLElement>('[id]'),
    ).find((item) => item.id === id);
    if (!element) {
      return;
    }
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) {
        parent.open = true;
      }
    }
    element.scrollIntoView({ block: 'start' });
  }
  ngOnDestroy() {
    this.editor?.destroy();
  }
}
