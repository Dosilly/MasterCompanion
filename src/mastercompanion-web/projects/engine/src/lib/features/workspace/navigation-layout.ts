import { signal } from '@angular/core';

const minimumWidth = 228;
const maximumWidth = 420;

/** Workspace-only presentation state; resizing never changes campaign organization. */
export class NavigationLayout {
  private readonly widthState = signal(260);
  private readonly collapsedState = signal(false);
  readonly width = this.widthState.asReadonly();
  readonly collapsed = this.collapsedState.asReadonly();
  readonly minimumWidth = minimumWidth;
  readonly maximumWidth = maximumWidth;
  private drag?: { id: number; start: number; width: number };

  toggle(): void {
    this.collapsedState.update((value) => !value);
  }
  key(event: KeyboardEvent): void {
    const widths: Record<string, number> = {
      ArrowLeft: this.width() - 20,
      ArrowRight: this.width() + 20,
      Home: minimumWidth,
      End: maximumWidth,
    };
    const width = widths[event.key];
    if (width !== undefined) {
      event.preventDefault();
      this.resize(width);
    }
  }
  start(event: PointerEvent): void {
    if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) {
      return;
    }
    this.drag = { id: event.pointerId, start: event.clientX, width: this.width() };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  move(event: PointerEvent): void {
    if (this.drag?.id === event.pointerId) {
      this.resize(this.drag.width + event.clientX - this.drag.start);
    }
  }
  end(event: PointerEvent): void {
    if (this.drag?.id === event.pointerId && event.currentTarget instanceof HTMLElement) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      this.drag = undefined;
    }
  }
  private resize(width: number): void {
    this.widthState.set(Math.max(minimumWidth, Math.min(maximumWidth, width)));
  }
}
