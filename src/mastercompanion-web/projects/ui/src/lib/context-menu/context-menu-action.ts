import type { IconName } from '../icon/icon-name';

export interface ContextMenuAction {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly icon?: IconName;
  readonly destructive?: boolean;
}
