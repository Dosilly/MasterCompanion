import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import type { MaterialSummary } from '@mastercompanion/contracts';
import { SearchableChoiceComponent } from '@mastercompanion/ui';
import { folderChoices } from '../choices/campaign-choices';
import { FolderManagement } from './folder-management';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-material-move-dialog',
  imports: [SearchableChoiceComponent],
  templateUrl: './material-move-dialog.html',
  styleUrl: './material-move-dialog.scss',
})
export class MaterialMoveDialog {
  readonly management = input.required<FolderManagement>();
  readonly ui = uiMessages;
  readonly moved = output<string>();
  readonly material = signal<MaterialSummary | null>(null);
  readonly folderId = signal('');
  readonly folderOptions = computed(() => [
    { id: '', label: this.ui.workspace.unfiledMaterials },
    ...folderChoices(this.management().snapshot().folders),
  ]);
  readonly hint = computed(() =>
    this.ui.materialMove.hint.replace('{title}', this.material()?.title ?? ''),
  );
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private opener: HTMLElement | null = null;

  open(material: MaterialSummary, opener: HTMLElement): void {
    if (this.management().locked()) {
      return;
    }
    this.material.set(material);
    this.folderId.set(material.folderId ?? '');
    this.opener = opener;
    this.dialog().nativeElement.showModal();
  }

  cancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  close(): void {
    if (!this.management().pending()) {
      this.dialog().nativeElement.close();
      this.opener?.focus({ preventScroll: true });
    }
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    const material = this.material();
    if (!material || this.management().locked()) {
      return;
    }
    if (
      await this.management().execute({
        kind: 'moveMaterial',
        materialId: material.id,
        folderId: this.folderId() || null,
        beforeId: null,
      })
    ) {
      this.close();
      this.moved.emit(material.id);
    }
  }

  async retry(): Promise<void> {
    const operation = this.management().request()?.operation;
    if (await this.management().retry()) {
      this.close();
      if (operation?.kind === 'moveMaterial') {
        this.moved.emit(operation.materialId);
      }
    }
  }
}
