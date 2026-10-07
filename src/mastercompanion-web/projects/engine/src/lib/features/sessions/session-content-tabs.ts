import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { uiMessages } from '../../i18n/messages';
import type { SessionSection } from './session-section';

/** Meeting reading destinations with automatic activation and roving keyboard focus. */
@Component({
  selector: 'mc-session-content-tabs',
  templateUrl: './session-content-tabs.html',
  styleUrl: './session-content-tabs.scss',
})
export class SessionContentTabs {
  readonly selected = input.required<SessionSection>();
  readonly sectionSelected = output<SessionSection>();
  readonly text = uiMessages.meetings;
  private readonly tabs = viewChild.required<ElementRef<HTMLElement>>('tabs');

  key(event: KeyboardEvent): void {
    if (
      !(event.target instanceof HTMLButtonElement) ||
      event.target.getAttribute('role') !== 'tab'
    ) {
      return;
    }
    const buttons = Array.from(
      this.tabs().nativeElement.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const index = buttons.indexOf(event.target);
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % buttons.length;
        break;
      case 'ArrowLeft':
        next = (index + buttons.length - 1) % buttons.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons[next]?.click();
    buttons[next]?.focus();
  }
}
