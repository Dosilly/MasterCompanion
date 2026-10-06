import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  ContextMenuComponent,
  IconComponent,
  SearchableChoiceComponent,
  type ChoiceOption,
  type ContextMenuPresentation,
} from '@mastercompanion/ui';

@Component({
  selector: 'mc-ui-catalog',
  imports: [ContextMenuComponent, IconComponent, SearchableChoiceComponent],
  templateUrl: './catalog.html',
})
class UiCatalog {
  readonly choice = signal('');
  readonly choices: readonly ChoiceOption[] = [
    { id: '', label: 'Unfiled' },
    { id: 'first', label: 'Shared title', detail: 'Campaign / Locations / Northern district' },
    {
      id: 'second',
      label: 'Shared title',
      detail: 'Campaign / Rules / A long path that wraps without hiding the selected destination',
    },
  ];
  readonly menu = signal<ContextMenuPresentation | null>(null);
  readonly dark = signal(false);
  readonly lastAction = signal('No action selected');

  toggleTheme(): void {
    this.dark.update((value) => !value);
    document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light';
  }

  open(event: MouseEvent, trigger: HTMLElement, disabled: boolean): void {
    event.preventDefault();
    this.present(trigger, { x: event.clientX, y: event.clientY }, disabled);
  }

  openFromButton(trigger: HTMLElement, disabled: boolean): void {
    const bounds = trigger.getBoundingClientRect();
    this.present(trigger, { x: bounds.left, y: bounds.bottom }, disabled);
  }

  keyboard(event: KeyboardEvent, trigger: HTMLElement, disabled: boolean): void {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      this.openFromButton(trigger, disabled);
    }
  }

  select(id: string): void {
    this.lastAction.set(id);
    this.menu.set(null);
  }

  private present(trigger: HTMLElement, anchor: { x: number; y: number }, disabled: boolean): void {
    this.menu.set({
      trigger,
      anchor,
      label: disabled ? 'Unavailable actions' : 'Example actions',
      actions: [
        { id: 'open', label: 'Open item', disabled },
        { id: 'rename', label: 'Rename item', disabled: true },
        {
          id: 'copy',
          label: 'Copy a long item link without truncating its accessible label',
          disabled,
        },
      ],
    });
  }
}

bootstrapApplication(UiCatalog).catch((error: unknown) => console.error(error));
