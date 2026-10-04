import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CampaignMap } from '@mastercompanion/contracts';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-map-view',
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss',
})
export class MapView implements AfterViewInit, OnDestroy {
  readonly ui = uiMessages;
  readonly map = input.required<CampaignMap>();
  readonly openMaterial = output<string>();
  readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  readonly scale = signal(1);
  readonly x = signal(0);
  readonly y = signal(0);
  readonly fittedWidth = signal(800);
  private observer?: ResizeObserver;
  private drag?: { id: number; x: number; y: number; initialX: number; initialY: number };
  transform() {
    return `translate(${this.x()}px, ${this.y()}px) scale(${this.scale()})`;
  }
  ngAfterViewInit() {
    this.observer = new ResizeObserver(() => {
      const viewport = this.viewport().nativeElement;
      if (viewport.clientWidth && viewport.clientHeight) {
        this.fittedWidth.set(
          Math.min(
            viewport.clientWidth,
            (viewport.clientHeight * this.map().width) / this.map().height,
          ),
        );
      }
    });
    this.observer.observe(this.viewport().nativeElement);
  }
  reset() {
    this.scale.set(1);
    this.x.set(0);
    this.y.set(0);
  }
  zoom(factor: number) {
    this.scale.set(Math.max(0.5, Math.min(4, this.scale() * factor)));
  }
  startPan(event: PointerEvent) {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) {
      return;
    }
    this.drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      initialX: this.x(),
      initialY: this.y(),
    };
    this.viewport().nativeElement.setPointerCapture(event.pointerId);
  }
  pan(event: PointerEvent) {
    if (this.drag?.id !== event.pointerId) {
      return;
    }
    this.x.set(this.drag.initialX + event.clientX - this.drag.x);
    this.y.set(this.drag.initialY + event.clientY - this.drag.y);
  }
  endPan(event: PointerEvent) {
    if (this.drag?.id !== event.pointerId) {
      return;
    }
    this.viewport().nativeElement.releasePointerCapture(event.pointerId);
    this.drag = undefined;
  }
  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
