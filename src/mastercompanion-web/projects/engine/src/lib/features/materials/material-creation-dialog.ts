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
import { SearchableChoiceComponent } from '@mastercompanion/ui';
import { folderChoices } from '../choices/campaign-choices';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-material-creation-dialog',
  imports: [SearchableChoiceComponent],
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
  readonly folderOptions = computed(() => [
    { id: '', label: this.ui.workspace.unfiledMaterials },
    ...folderChoices(this.folders()),
  ]);
  constructor() {
    this.destroyRef.onDestroy(() => this.render?.destroy());
  }
  open(event: Event | HTMLElement, defaultFolderId: string | null, explicitFolder = false) {
    if (explicitFolder) {
      this.creation().setFolder(defaultFolderId);
    } else {
      this.creation().setDefaultFolder(defaultFolderId);
    }
    this.opener =
      event instanceof HTMLElement
        ? event
        : event.currentTarget instanceof HTMLElement
          ? event.currentTarget
          : undefined;
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
  updateFolder(id: string) {
    this.creation().setFolder(id || null);
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
