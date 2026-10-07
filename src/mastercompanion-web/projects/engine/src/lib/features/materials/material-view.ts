import {
  AfterViewInit,
  Component,
  computed,
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
import { DocumentNavigation } from './document-navigation';
import { DocumentNavigationView } from './document-navigation-view';
import { Editor } from '@tiptap/core';
import type { CampaignFolder, MaterialSummary } from '@mastercompanion/contracts';
import { IconComponent, SearchableChoiceComponent } from '@mastercompanion/ui';
import { materialChoices } from '../choices/campaign-choices';
import { createMaterialEditor } from './material-editor';
import { MaterialSession } from './material-session';
import { RichDocumentPreview } from './rich-document-preview';
import { uiMessages } from '../../i18n/messages';
import {
  InsertionError,
  InsertionSelection,
  insertMarkdown,
  insertMaterialLink,
} from './editor-insertion';

@Component({
  selector: 'mc-material-view',
  imports: [IconComponent, SearchableChoiceComponent, RichDocumentPreview, DocumentNavigationView],
  templateUrl: './material-view.html',
  styleUrl: './material-view.scss',
})
export class MaterialView implements AfterViewInit, OnDestroy {
  readonly ui = uiMessages;
  readonly session = input.required<MaterialSession>();
  readonly materials = input<readonly MaterialSummary[]>([]);
  readonly folders = input<readonly CampaignFolder[]>([]);
  readonly linkOptions = computed(() => [
    { id: '', label: this.ui.material.chooseMaterial },
    ...materialChoices(this.materials(), this.folders(), this.ui.workspace.unfiledMaterials),
  ]);
  readonly deletionLocked = input(false);
  readonly deleteRequested = output<Event>();
  readonly openMaterial = output<{ id: string; anchor?: string }>();
  readonly editorElement = viewChild.required<ElementRef<HTMLElement>>('editorElement');
  readonly insertionDialog = viewChild.required<ElementRef<HTMLDialogElement>>('insertionDialog');
  readonly markdownSource = viewChild.required<ElementRef<HTMLTextAreaElement>>('markdownSource');
  readonly materialChoice = viewChild.required<SearchableChoiceComponent>('materialChoice');
  readonly insertionMode = signal<'markdown' | 'link' | null>(null);
  readonly markdownDraft = signal('');
  readonly linkTarget = signal('');
  readonly insertionError = signal<InsertionError | null>(null);
  readonly copyState = signal<'idle' | 'copied' | 'failed'>('idle');
  readonly copiedText = signal('');
  readonly savedMaterial = computed(() => {
    const version = this.session().savedVersion();
    return version.kind === 'ready' ? version.material : null;
  });
  private readonly recoveryDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('recoveryDialog');
  private recoveryOpener?: HTMLElement;
  private readonly injector = inject(Injector);
  private selection?: InsertionSelection;
  private insertionOpener?: HTMLElement;
  editor?: Editor;
  readonly documentNavigation = signal<DocumentNavigation | null>(null);
  readonly commandState = signal({
    bold: false,
    italic: false,
    heading: false,
    list: false,
    quote: false,
    canUndo: false,
    canRedo: false,
  });
  private readonly updateCommandState = (): void => {
    const editor = this.editor;
    if (!editor) {
      return;
    }
    this.commandState.set({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      heading: editor.isActive('heading', { level: 2 }),
      list: editor.isActive('bulletList'),
      quote: editor.isActive('blockquote'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    });
  };

  ngAfterViewInit() {
    this.mountEditor();
  }
  private mountEditor(): void {
    this.editor = createMaterialEditor(
      this.editorElement().nativeElement,
      this.session(),
      this.ui.material.contentLabel,
    );
    this.documentNavigation.set(new DocumentNavigation(this.editor));
    this.editor.on('transaction', this.updateCommandState);
    this.updateCommandState();
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
        if (mode === 'markdown') {
          this.markdownSource().nativeElement.focus();
        } else {
          this.materialChoice().focus();
        }
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
  updateLinkTarget(id: string) {
    this.linkTarget.set(id);
    this.insertionError.set(null);
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
    const text = this.editor?.getText() ?? '';
    this.copiedText.set(text);
    try {
      await navigator.clipboard.writeText(text);
      this.copyState.set('copied');
    } catch {
      this.copyState.set('failed');
    }
  }
  inspectSaved(event: Event): void {
    this.recoveryOpener =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.recoveryDialog().nativeElement.showModal();
    void this.session().inspectSavedVersion();
  }
  closeRecovery(event?: Event): void {
    event?.preventDefault();
    this.recoveryDialog().nativeElement.close();
    this.recoveryOpener?.focus();
  }
  adoptSaved(): void {
    if (!this.session().adoptSavedVersion()) {
      return;
    }
    this.documentNavigation()?.destroy();
    this.editor?.off('transaction', this.updateCommandState);
    this.editor?.destroy();
    this.session().editing.set(false);
    this.mountEditor();
    this.closeRecovery();
    this.copyState.set('idle');
  }
  async reapplyDraft(): Promise<void> {
    this.closeRecovery();
    await this.session().reapplyDraft();
  }
  scrollToAnchor(id: string): boolean {
    const element = Array.from(
      this.editorElement().nativeElement.querySelectorAll<HTMLElement>('[id]'),
    ).find((item) => item.id === id);
    if (!element) {
      return false;
    }
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) {
        parent.open = true;
      }
    }
    element.scrollIntoView({ block: 'start' });
    return true;
  }
  ngOnDestroy() {
    this.editor?.off('transaction', this.updateCommandState);
    this.editor?.destroy();
  }
}
