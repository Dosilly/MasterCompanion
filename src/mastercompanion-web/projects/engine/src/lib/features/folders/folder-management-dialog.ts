import {
  AfterRenderRef,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { CampaignFolder } from '@mastercompanion/contracts';
import { FolderManagement } from './folder-management';
import { canMoveFolder } from './folder-rules';
import { SearchableChoiceComponent } from '@mastercompanion/ui';
import { folderChoices } from '../choices/campaign-choices';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-folder-management-dialog',
  imports: [SearchableChoiceComponent],
  templateUrl: './folder-management-dialog.html',
  styleUrl: './folder-management-dialog.scss',
})
export class FolderManagementDialog {
  readonly ui = uiMessages;
  readonly management = input.required<FolderManagement>();
  readonly mode = signal<'rename' | 'move'>('rename');
  readonly folderId = signal('');
  readonly title = signal('');
  readonly parentId = signal<string | null>(null);
  readonly beforeId = signal<string | null>(null);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private render?: AfterRenderRef;
  private opener?: HTMLElement;
  private navigation?: HTMLElement;
  readonly parentOptions = computed(() => {
    const folders = this.management().snapshot().folders;
    const allowed = new Set(
      folders
        .filter((folder) => canMoveFolder(folders, this.folderId(), folder.id))
        .map((folder) => folder.id),
    );
    return [
      { id: '', label: this.ui.folders.root },
      ...folderChoices(folders).filter((folder) => allowed.has(folder.id)),
    ];
  });
  readonly siblingOptions = computed(() => [
    { id: '', label: this.ui.folders.atEnd },
    ...folderChoices(this.management().snapshot().folders)
      .filter((option) =>
        this.management()
          .snapshot()
          .folders.some(
            (folder) =>
              folder.id === option.id &&
              folder.id !== this.folderId() &&
              folder.parentId === this.parentId(),
          ),
      )
      .map((option) => ({ ...option, label: this.ui.folders.before + ' ' + option.label })),
  ]);
  private readonly parentChoice = viewChild<SearchableChoiceComponent>('parentChoice');

  constructor() {
    this.destroyRef.onDestroy(() => this.render?.destroy());
  }

  open(mode: 'rename' | 'move', folder: CampaignFolder, opener: HTMLElement): void {
    if (this.management().locked()) {
      return;
    }
    this.mode.set(mode);
    this.folderId.set(folder.id);
    this.title.set(folder.title);
    this.parentId.set(folder.parentId);
    const siblings = this.management()
      .snapshot()
      .folders.filter((item) => item.parentId === folder.parentId);
    this.beforeId.set(
      siblings[siblings.findIndex((item) => item.id === folder.id) + 1]?.id ?? null,
    );
    this.opener = opener;
    this.navigation = opener.closest('nav') ?? undefined;
    this.render?.destroy();
    this.render = afterNextRender(
      () => {
        this.dialog().nativeElement.showModal();
        if (mode === 'rename') {
          this.dialog().nativeElement.querySelector<HTMLInputElement>('input')?.focus();
        } else {
          this.parentChoice()?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  updateTitle(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.title.set(event.target.value);
    }
  }

  updateParent(id: string): void {
    this.parentId.set(id || null);
    this.beforeId.set(null);
  }

  updatePosition(id: string): void {
    this.beforeId.set(id || null);
  }

  cancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  close(): void {
    if (!this.management().pending()) {
      this.dialog().nativeElement.close();
      this.render?.destroy();
      this.render = afterNextRender(
        () => {
          const movedFolder = Array.from(
            this.navigation?.querySelectorAll<HTMLElement>('[data-folder-id]') ?? [],
          ).find((folder) => folder.dataset['folderId'] === this.folderId());
          const target = this.opener?.isConnected
            ? this.opener
            : movedFolder?.querySelector<HTMLElement>('summary');
          target?.focus({ preventScroll: true });
        },
        { injector: this.injector },
      );
    }
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    const confirmed = await this.management().execute(
      this.mode() === 'rename'
        ? { kind: 'rename', folderId: this.folderId(), title: this.title().trim() }
        : {
            kind: 'move',
            folderId: this.folderId(),
            parentId: this.parentId(),
            beforeId: this.beforeId(),
          },
    );
    if (confirmed) {
      this.close();
    }
  }

  async retry(): Promise<void> {
    if (await this.management().retry()) {
      this.close();
    }
  }
}
