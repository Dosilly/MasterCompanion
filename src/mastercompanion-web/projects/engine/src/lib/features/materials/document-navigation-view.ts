import { Component, input, signal } from '@angular/core';
import { IconComponent } from '@mastercompanion/ui';
import { DocumentNavigation } from './document-navigation';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-document-navigation',
  imports: [IconComponent],
  templateUrl: './document-navigation-view.html',
  styleUrl: './document-navigation-view.scss',
})
export class DocumentNavigationView {
  readonly navigation = input.required<DocumentNavigation>();
  readonly materialId = input.required<string>();
  readonly ui = uiMessages.readerNavigation;
  readonly activeTool = signal<'outline' | 'find' | null>(null);

  toggle(tool: 'outline' | 'find'): void {
    this.activeTool.update((current) => (current === tool ? null : tool));
  }

  update(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.navigation().search(event.target.value);
    }
  }
  findNext(event: Event): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
      this.navigation().move(event.shiftKey ? -1 : 1);
    }
  }
}
