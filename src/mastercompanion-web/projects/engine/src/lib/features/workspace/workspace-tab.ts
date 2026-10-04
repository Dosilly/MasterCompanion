import { Component, computed, input, output } from '@angular/core';

/** One campaign tab with a consistent selection, close and middle-click contract. */
@Component({
  selector: 'mc-workspace-tab',
  templateUrl: './workspace-tab.html',
  styleUrl: './workspace-tab.scss',
  host: {
    class: 'material-tab',
    '[class.is-active]': 'selected()',
    '(mousedown)': 'preventMiddleScroll($event)',
    '(auxclick)': 'closeWithMiddleButton($event)',
  },
})
export class WorkspaceTab {
  readonly key = input.required<string>();
  readonly label = input.required<string>();
  readonly closeLabel = input.required<string>();
  readonly closeHint = input<string | null>(null);
  readonly selected = input(false);
  readonly dirty = input(false);
  readonly closing = input(false);
  readonly activate = output<void>();
  readonly close = output<void>();
  // Reserved engine tabs start with @; material tabs retain their stable campaign ID.
  readonly domKey = computed(() => (this.key().startsWith('@') ? this.key().slice(1) : this.key()));

  preventMiddleScroll(event: MouseEvent): void {
    if (event.button === 1) {
      event.preventDefault();
    }
  }

  closeWithMiddleButton(event: MouseEvent): void {
    if (event.button === 1) {
      event.preventDefault();
      if (!this.closing()) {
        this.close.emit();
      }
    }
  }
}
