import type { IconName } from '@mastercompanion/ui';
import type { WorkspaceContextMenuAction } from './workspace-context-menu-action';

export interface WorkspaceContextMenuActionItem {
  readonly id: WorkspaceContextMenuAction;
  readonly label: string;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
  readonly icon?: IconName;
}
