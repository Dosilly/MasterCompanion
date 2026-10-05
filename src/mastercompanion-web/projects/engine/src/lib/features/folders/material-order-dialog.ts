import { Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';
import type { MaterialSummary } from '@mastercompanion/contracts';
import { SearchableChoiceComponent } from '@mastercompanion/ui';
import { materialChoices } from '../choices/campaign-choices';
import { FolderManagement } from './folder-management';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-material-order-dialog',
  imports: [SearchableChoiceComponent],
  templateUrl: './material-order-dialog.html',
  styleUrl: './material-order-dialog.scss',
})
export class MaterialOrderDialog {
  readonly management = input.required<FolderManagement>();
  readonly materials = input.required<readonly MaterialSummary[]>();
  readonly ui = uiMessages;
  readonly materialId = signal('');
  readonly folderId = signal<string | null>(null);
  readonly position = signal<'first' | 'last' | 'before' | 'after'>('first');
  readonly siblingId = signal('');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private opener: HTMLElement | null = null;

  siblings(): readonly MaterialSummary[] {
    return this.materials().filter(
      (item) => item.folderId === this.folderId() && item.id !== this.materialId(),
    );
  }

  readonly siblingOptions = computed(() =>
    materialChoices(
      this.siblings(),
      this.management().snapshot().folders,
      this.ui.workspace.unfiledMaterials,
    ),
  );

  open(material: MaterialSummary, opener: HTMLElement): void {
    if (this.management().locked()) {
      return;
    }
    this.materialId.set(material.id);
    this.folderId.set(material.folderId);
    this.position.set('first');
    this.siblingId.set(this.siblings()[0]?.id ?? '');
    this.opener = opener;
    this.dialog().nativeElement.showModal();
  }

  choosePosition(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      if (value === 'first' || value === 'last' || value === 'before' || value === 'after') {
        this.position.set(value);
      }
    }
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
    const siblings = this.management()
      .snapshot()
      .materialOrder.filter(
        (item) => item.folderId === this.folderId() && item.id !== this.materialId(),
      );
    const selected = siblings.findIndex((item) => item.id === this.siblingId());
    let beforeId: string | null;
    switch (this.position()) {
      case 'first':
        beforeId = siblings[0]?.id ?? null;
        break;
      case 'last':
        beforeId = null;
        break;
      case 'before':
        if (selected < 0) {
          return;
        }
        beforeId = this.siblingId();
        break;
      case 'after':
        if (selected < 0) {
          return;
        }
        beforeId = siblings[selected + 1]?.id ?? null;
        break;
    }
    if (
      await this.management().execute({
        kind: 'reorderMaterial',
        materialId: this.materialId(),
        folderId: this.folderId(),
        beforeId,
      })
    ) {
      this.close();
    }
  }

  async retry(): Promise<void> {
    if (await this.management().retry()) {
      this.close();
    }
  }
}
