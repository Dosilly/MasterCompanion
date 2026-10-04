import { signal } from '@angular/core';
import type { CampaignFolder, FolderOperation } from '@mastercompanion/contracts';
import { canMoveFolder } from './folder-rules';

interface FolderDrop {
  targetId: string | null;
  placement: 'before' | 'inside' | 'after';
  operation: FolderOperation;
}

/** Native drag interaction publishes an operation only after a valid drop. */
export class FolderDrag {
  private readonly draggingState = signal<string | null>(null);
  private readonly targetState = signal<FolderDrop | null>(null);
  readonly dragging = this.draggingState.asReadonly();
  readonly target = this.targetState.asReadonly();

  start(event: DragEvent, folderId: string, locked: boolean): void {
    if (locked || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    this.draggingState.set(folderId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-mastercompanion-folder', folderId);
  }

  over(event: DragEvent, folders: readonly CampaignFolder[], folder: CampaignFolder | null): void {
    event.stopPropagation();
    const source = this.dragging();
    if (!source || folder?.id === source || !(event.currentTarget instanceof HTMLElement)) {
      this.targetState.set(null);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - bounds.top) / bounds.height;
    const placement = folder
      ? ratio < 0.35
        ? 'before'
        : ratio > 0.65
          ? 'after'
          : 'inside'
      : 'inside';
    const parentId = folder ? (placement === 'inside' ? folder.id : folder.parentId) : null;
    const siblings = folders.filter((item) => item.parentId === parentId && item.id !== source);
    const beforeId =
      folder && placement === 'before'
        ? folder.id
        : folder && placement === 'after'
          ? (siblings[siblings.findIndex((item) => item.id === folder.id) + 1]?.id ?? null)
          : null;
    if (!canMoveFolder(folders, source, parentId, beforeId)) {
      this.targetState.set(null);
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.targetState.set({
      targetId: folder?.id ?? null,
      placement,
      operation: { kind: 'move', folderId: source, parentId, beforeId },
    });
  }

  drop(event: DragEvent): FolderOperation | null {
    event.preventDefault();
    event.stopPropagation();
    const operation = this.target()?.operation ?? null;
    this.end();
    return operation;
  }

  end(): void {
    this.draggingState.set(null);
    this.targetState.set(null);
  }

  leave(): void {
    this.targetState.set(null);
  }
}
