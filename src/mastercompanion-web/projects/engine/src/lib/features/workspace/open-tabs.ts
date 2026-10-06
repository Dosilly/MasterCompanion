import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import type { OpenTabItem } from './open-tab-item';
import { uiMessages } from '../../i18n/messages';

/** Lists all workspace tabs while the horizontal strip keeps its existing keyboard behavior. */
@Component({
  selector: 'mc-open-tabs',
  templateUrl: './open-tabs.html',
  styleUrl: './open-tabs.scss',
})
export class OpenTabs {
  readonly items = input.required<readonly OpenTabItem[]>();
  readonly activeId = input.required<string>();
  readonly activate = output<string>();
  readonly close = output<string>();
  readonly ui = uiMessages.workspace;
  private readonly details = viewChild.required<ElementRef<HTMLDetailsElement>>('details');
  select(id: string): void {
    this.details().nativeElement.open = false;
    this.activate.emit(id);
  }
  dismiss(event: Event): void {
    event.preventDefault();
    this.details().nativeElement.open = false;
    this.details().nativeElement.querySelector('summary')?.focus();
  }
  closeItem(id: string): void {
    this.details().nativeElement.querySelector('summary')?.focus();
    this.close.emit(id);
  }
}
