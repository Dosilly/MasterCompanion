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
import { folderPath } from '../workspace/navigation';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-folder-management-dialog',
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
    const names = new Map(folders.map((folder) => [folder.id, folder.title]));
    return folders
      .filter((folder) => canMoveFolder(folders, this.folderId(), folder.id))
      .map((folder) => ({
        ...folder,
        label: folderPath(folders, folder.id)
          .map((id) => names.get(id))
          .join(' / '),
      }));
  });
  readonly siblingOptions = computed(() =>
    this.management()
      .snapshot()
      .folders.filter(
        (folder) => folder.id !== this.folderId() && folder.parentId === this.parentId(),
      ),
  );

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
        this.dialog()
          .nativeElement.querySelector<HTMLInputElement | HTMLSelectElement>(
            mode === 'rename' ? 'input' : 'select',
          )
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  updateTitle(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.title.set(event.target.value);
    }
  }

  updateParent(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.parentId.set(event.target.value || null);
      this.beforeId.set(null);
    }
  }

  updatePosition(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.beforeId.set(event.target.value || null);
    }
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
