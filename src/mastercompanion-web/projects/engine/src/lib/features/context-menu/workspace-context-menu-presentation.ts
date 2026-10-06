import type { ContextMenuPresentation } from '@mastercompanion/ui';
import type { WorkspaceContextMenuActionItem } from './workspace-context-menu-action-item';

export interface WorkspaceContextMenuPresentation extends ContextMenuPresentation {
  readonly actions: readonly WorkspaceContextMenuActionItem[];
}
