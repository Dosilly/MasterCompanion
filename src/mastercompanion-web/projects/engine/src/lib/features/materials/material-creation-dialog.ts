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
  output,
  viewChild,
} from '@angular/core';
import type { CampaignFolder, MaterialDto } from '@mastercompanion/contracts';
import { MaterialCreation } from './material-creation';
import { folderPath } from '../workspace/navigation';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-material-creation-dialog',
  templateUrl: './material-creation-dialog.html',
  styleUrl: './material-creation-dialog.scss',
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
    const names = new Map(folders.map((folder) => [folder.id, folder.title]));
    return folders.map((folder) => ({
      id: folder.id,
      label: folderPath([...folders], folder.id)
        .map((id) => names.get(id))
        .join(' / '),
    }));
  });
  constructor() {
    this.destroyRef.onDestroy(() => this.render?.destroy());
  }
  open(event: Event, defaultFolderId: string | null) {
    this.creation().setDefaultFolder(defaultFolderId);
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.render?.destroy();
    this.render = afterNextRender(
      () => {
        if (!this.dialog().nativeElement.open) {
          this.dialog().nativeElement.showModal();
        }
        if (!this.creation().locked()) {
          this.titleInput().nativeElement.focus();
        }
      },
      { injector: this.injector },
    );
  }
  cancel(event: Event) {
    event.preventDefault();
    this.close();
  }
  close(restoreFocus = true) {
    if (this.creation().pending()) {
      return;
    }
    this.dialog().nativeElement.close();
    if (restoreFocus) {
      this.opener?.focus();
    }
  }
  updateTitle(event: Event) {
    if (event.target instanceof HTMLInputElement) {
      this.creation().setTitle(event.target.value);
    }
  }
  updateFolder(event: Event) {
    if (event.target instanceof HTMLSelectElement) {
      this.creation().setFolder(event.target.value || null);
    }
  }
  async submit(event: Event) {
    event.preventDefault();
    const material = await this.creation().create(this.folders().map((folder) => folder.id));
    if (material) {
      this.close(false);
      this.created.emit(material);
    }
  }
  async retry() {
    const material = await this.creation().retry();
    if (material) {
      this.close(false);
      this.created.emit(material);
    }
  }
}
