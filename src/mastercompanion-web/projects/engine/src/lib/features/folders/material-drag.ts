import { computed, signal } from '@angular/core';
import type { FolderSnapshot, FolderOperation } from '@mastercompanion/contracts';
import { canMoveMaterial } from './folder-rules';

/** Owns pointer placement intent; confirmed folders/order belong to organization. */
export class MaterialDrag {
  private readonly source = signal<string | null>(null);
  private readonly destination = signal<{
    id: string | null;
    placement: 'before' | 'after' | 'inside';
    operation: FolderOperation;
  } | null>(null);
  readonly dragging = this.source.asReadonly();
  readonly target = this.destination.asReadonly();
  readonly folderTarget = computed(() =>
    this.destination()?.placement === 'inside' ? this.destination() : null,
  );

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
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    const siblings = snapshot.materialOrder.filter(
      (item) => item.folderId === target.folderId && item.id !== source.id,
    );
    const beforeId =
      placement === 'before'
        ? target.id
        : (siblings[siblings.findIndex((item) => item.id === target.id) + 1]?.id ?? null);
    if (!canMoveMaterial(snapshot, source.id, target.folderId, beforeId)) {
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
        kind: source.folderId === target.folderId ? 'reorderMaterial' : 'moveMaterial',
        materialId: source.id,
        folderId: target.folderId,
        beforeId,
      },
    });
  }

  overFolder(event: DragEvent, snapshot: FolderSnapshot, folderId: string | null): void {
    event.stopPropagation();
    this.destination.set(null);
    const sourceId = this.source();
    if (!sourceId || !canMoveMaterial(snapshot, sourceId, folderId, null)) {
      return;
    }
    const source = snapshot.materialOrder.find((item) => item.id === sourceId);
    if (source?.folderId === folderId) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.destination.set({
      id: folderId,
      placement: 'inside',
      operation: { kind: 'moveMaterial', materialId: sourceId, folderId, beforeId: null },
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
    this.source.set(null);
    this.destination.set(null);
  }

  leave(): void {
    this.destination.set(null);
  }
}
