import type { ContextMenuAction } from './context-menu-action';

export interface ContextMenuPresentation {
  readonly anchor: { readonly x: number; readonly y: number };
  readonly trigger: HTMLElement;
  readonly label: string;
  readonly actions: readonly ContextMenuAction[];
}
