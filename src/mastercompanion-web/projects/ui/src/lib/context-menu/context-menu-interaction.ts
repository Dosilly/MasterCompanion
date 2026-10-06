import { contextMenuPosition } from './context-menu-position';
import type { ContextMenuPresentation } from './context-menu-presentation';

export class ContextMenuInteraction {
  private readonly document: Document;
  private readonly window: Window | null;
  private disposed = false;

  constructor(
    private readonly menu: HTMLElement,
    private readonly presentation: ContextMenuPresentation,
    private readonly selected: (id: string) => void,
    private readonly dismissed: () => void,
  ) {
    this.document = menu.ownerDocument;
    this.window = this.document.defaultView;
    this.position();
    this.document.addEventListener('pointerdown', this.outsidePointer, true);
    this.document.addEventListener('contextmenu', this.outsideContext, true);
    this.window?.addEventListener('resize', this.viewportChanged);
    this.document.addEventListener('scroll', this.scrolled, true);
    menu.addEventListener('keydown', this.keydown);
    menu.addEventListener('click', this.click);
    (this.enabledItems()[0] ?? menu).focus({ preventScroll: true });
  }

  destroy(restoreFocus = true): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const returnFocus = restoreFocus && this.menu.contains(this.document.activeElement);
    this.document.removeEventListener('pointerdown', this.outsidePointer, true);
    this.document.removeEventListener('contextmenu', this.outsideContext, true);
    this.window?.removeEventListener('resize', this.viewportChanged);
    this.document.removeEventListener('scroll', this.scrolled, true);
    this.menu.removeEventListener('keydown', this.keydown);
    this.menu.removeEventListener('click', this.click);
    if (returnFocus && this.presentation.trigger.isConnected) {
      this.presentation.trigger.focus({ preventScroll: true });
    }
  }

  private enabledItems(): HTMLButtonElement[] {
    return Array.from(
      this.menu.querySelectorAll<HTMLButtonElement>('button[data-menu-action]'),
    ).filter((item) => !item.disabled);
  }

  private position(): void {
    const bounds = this.menu.getBoundingClientRect();
    const point = contextMenuPosition(this.presentation.anchor, bounds, {
      width: this.window?.innerWidth ?? this.document.documentElement.clientWidth,
      height: this.window?.innerHeight ?? this.document.documentElement.clientHeight,
    });
    this.menu.style.left = `${point.x}px`;
    this.menu.style.top = `${point.y}px`;
  }

  private dismiss(restoreFocus = true): void {
    this.destroy(restoreFocus);
    this.dismissed();
  }

  private readonly outsidePointer = (event: PointerEvent): void => {
    if (event.composedPath().includes(this.menu)) {
      return;
    }
    // A pointer outside chooses its own focus target.
    this.dismiss(false);
  };

  private readonly outsideContext = (event: MouseEvent): void => {
    if (!event.composedPath().includes(this.menu)) {
      this.dismiss();
    }
  };

  private readonly viewportChanged = (): void => {
    this.dismiss();
  };

  private readonly scrolled = (event: Event): void => {
    if (!event.composedPath().includes(this.menu)) {
      this.dismiss();
    }
  };

  private readonly click = (event: MouseEvent): void => {
    const button = this.enabledItems().find((item) => event.composedPath().includes(item));
    const id = button?.dataset['menuAction'];
    if (id) {
      this.destroy();
      this.selected(id);
    }
  };

  private readonly keydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') {
        event.preventDefault();
      }
      event.stopPropagation();
      this.dismiss();
      return;
    }
    const items = this.enabledItems();
    const current = items.findIndex((item) => item === this.document.activeElement);
    let index: number;
    switch (event.key) {
      case 'ArrowDown':
        index = current < 0 ? 0 : (current + 1) % items.length;
        break;
      case 'ArrowUp':
        index = current <= 0 ? items.length - 1 : current - 1;
        break;
      case 'Home':
        index = 0;
        break;
      case 'End':
        index = items.length - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        event.stopPropagation();
        items[current]?.click();
        return;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    items[index]?.focus({ preventScroll: true });
  };
}
