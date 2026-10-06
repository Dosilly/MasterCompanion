import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ContextMenuInteraction } from './context-menu-interaction';
import type { ContextMenuPresentation } from './context-menu-presentation';

@Component({
  selector: 'mc-context-menu',
  templateUrl: './context-menu.html',
  styleUrl: './context-menu.scss',
})
export class ContextMenuComponent {
  readonly presentation = input.required<ContextMenuPresentation>();
  readonly actionSelected = output<string>();
  readonly dismissed = output<void>();
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');
  private interaction: ContextMenuInteraction | null = null;

  constructor() {
    afterRenderEffect(() => {
      const presentation = this.presentation();
      const menu = this.menu().nativeElement;
      this.interaction?.destroy();
      this.interaction = new ContextMenuInteraction(
        menu,
        presentation,
        (id) => this.actionSelected.emit(id),
        () => this.dismissed.emit(),
      );
    });
    inject(DestroyRef).onDestroy(() => this.interaction?.destroy());
  }
}
