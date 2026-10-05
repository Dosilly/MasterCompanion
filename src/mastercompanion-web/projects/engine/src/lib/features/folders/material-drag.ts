import { signal } from '@angular/core';
import type { FolderSnapshot, FolderOperation } from '@mastercompanion/contracts';
import { canReorderMaterial } from './folder-rules';

/** Owns only within-folder pointer intent; confirmed ordering belongs to organization. */
export class MaterialDrag {
  private readonly source = signal<string | null>(null);
  private readonly destination = signal<{
    id: string;
    placement: 'before' | 'after';
    operation: FolderOperation;
  } | null>(null);
  private readonly rejectedState = signal<string | null>(null);
  readonly rejected = this.rejectedState.asReadonly();
  readonly dragging = this.source.asReadonly();
  readonly target = this.destination.asReadonly();

  start(event: DragEvent, id: string, locked: boolean): void {
    event.stopPropagation();
    if (locked || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    this.source.set(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-mastercompanion-material', id);
  }

  over(event: DragEvent, snapshot: FolderSnapshot, targetId: string): void {
    event.stopPropagation();
    this.destination.set(null);
    this.rejectedState.set(null);
    const source = snapshot.materialOrder.find((item) => item.id === this.source());
    const target = snapshot.materialOrder.find((item) => item.id === targetId);
    if (
      !source ||
      !target ||
      source.id === target.id ||
      !(event.currentTarget instanceof HTMLElement)
    ) {
      return;
    }
    if (source.folderId !== target.folderId) {
      this.rejectedState.set(target.id);
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'none';
      }
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    const siblings = snapshot.materialOrder.filter(
      (item) => item.folderId === target.folderId && item.id !== source.id,
    );
    const beforeId =
      placement === 'before'
        ? target.id
        : (siblings[siblings.findIndex((item) => item.id === target.id) + 1]?.id ?? null);
    if (!canReorderMaterial(snapshot, source.id, target.folderId, beforeId)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.destination.set({
      id: target.id,
      placement,
      operation: {
        kind: 'reorderMaterial',
        materialId: source.id,
        folderId: target.folderId,
        beforeId,
      },
    });
  }

  drop(event: DragEvent): FolderOperation | null {
    event.stopPropagation();
    event.preventDefault();
    const operation = this.destination()?.operation ?? null;
    this.end();
    return operation;
  }

  end(): void {
    this.rejectedState.set(null);
    this.source.set(null);
    this.destination.set(null);
  }

  leave(): void {
    this.rejectedState.set(null);
    this.destination.set(null);
  }
}
