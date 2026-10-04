import { Component, input, output } from '@angular/core';
import { ContextMenuComponent } from '@mastercompanion/ui';
import type { WorkspaceContextMenuAction } from './workspace-context-menu-action';
import type { WorkspaceContextMenuPresentation } from './workspace-context-menu-presentation';

@Component({
  selector: 'mc-workspace-context-menu',
  imports: [ContextMenuComponent],
  template: `
    @if (presentation(); as menu) {
      <mc-context-menu
        [presentation]="menu"
        (actionSelected)="selectAction($event)"
        (dismissed)="dismissed.emit()"
      />
    }
  `,
})
export class WorkspaceContextMenuComponent {
  readonly presentation = input<WorkspaceContextMenuPresentation | null>(null);
  readonly actionSelected = output<WorkspaceContextMenuAction>();
  readonly dismissed = output<void>();

  protected selectAction(id: string): void {
    const action = this.presentation()?.actions.find((item) => item.id === id);
    if (action && !action.disabled) {
      this.actionSelected.emit(action.id);
    }
  }
}
