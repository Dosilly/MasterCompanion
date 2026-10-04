import { signal } from '@angular/core';
import { uiMessages } from '../../i18n/messages';
import { workspaceRouteUrl } from '../workspace/workspace-route-codec';
import type { WorkspaceContextMenuActionItem } from './workspace-context-menu-action-item';
import type { WorkspaceContextMenuPresentation } from './workspace-context-menu-presentation';

interface MenuTarget {
  kind: 'folder' | 'material' | 'tab';
  id: string;
  trigger: HTMLElement;
}

/** Owns context target, presentation, opening gestures, and clipboard feedback. */
export class WorkspaceContextMenuState {
  readonly presentation = signal<WorkspaceContextMenuPresentation | null>(null);
  readonly feedback = signal<'copied' | 'copyFailed' | null>(null);
  private currentTarget: MenuTarget | null = null;

  constructor(
    private readonly folderLocked: () => boolean,
    private readonly closing: (id: string) => boolean,
  ) {}

  open(event: MouseEvent | KeyboardEvent, kind: MenuTarget['kind'], id: string): void {
    if (
      event instanceof KeyboardEvent &&
      event.key !== 'ContextMenu' &&
      !(event.shiftKey && event.key === 'F10')
    ) {
      return;
    }
    if (!(event.currentTarget instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const owner = event.currentTarget;
    const nestedTrigger =
      kind === 'tab' && event.target instanceof Element
        ? event.target.closest<HTMLElement>('button')
        : null;
    const trigger = nestedTrigger && owner.contains(nestedTrigger) ? nestedTrigger : owner;
    const bounds = trigger.getBoundingClientRect();
    this.currentTarget = { kind, id, trigger };
    const labels = uiMessages.contextMenu;
    let actions: WorkspaceContextMenuActionItem[];
    if (kind === 'folder') {
      actions = [{ id: 'new-note', label: labels.newNote }];
      if (id !== '@unfiled') {
        actions.push(
          { id: 'rename', label: labels.rename, disabled: this.folderLocked() },
          { id: 'move', label: labels.move, disabled: this.folderLocked() },
        );
      }
    } else {
      actions =
        kind === 'material'
          ? [{ id: 'open', label: labels.open }]
          : [
              { id: 'close', label: labels.close, disabled: this.closing(id) },
              { id: 'close-others', label: labels.closeOthers },
            ];
      if (!id.startsWith('@')) {
        actions.push(
          { id: 'reveal', label: labels.reveal },
          { id: 'copy-link', label: labels.copyLink },
        );
      }
    }
    const pointer = event instanceof MouseEvent && event.type === 'contextmenu';
    this.presentation.set({
      anchor: pointer
        ? { x: event.clientX, y: event.clientY }
        : { x: bounds.left, y: bounds.bottom },
      trigger,
      label: labels.label,
      actions,
    });
  }

  takeTarget(): MenuTarget | null {
    this.presentation.set(null);
    const target = this.currentTarget;
    this.currentTarget = null;
    return target;
  }

  async copyMaterialLink(id: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        new URL(workspaceRouteUrl({ kind: 'material', materialId: id }), window.location.origin)
          .href,
      );
      this.feedback.set('copied');
    } catch {
      this.feedback.set('copyFailed');
    }
  }
}
