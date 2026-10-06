import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  OnDestroy,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CampaignMap, MapMarker } from '@mastercompanion/contracts';
import { SearchableChoiceComponent } from '@mastercompanion/ui';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-map-view',
  imports: [SearchableChoiceComponent],
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss',
})
export class MapView implements AfterViewInit, OnDestroy {
  readonly ui = uiMessages;
  readonly map = input.required<CampaignMap>();
  readonly openMaterial = output<string>();
  readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly scaleState = signal(1);
  private readonly xState = signal(0);
  private readonly yState = signal(0);
  private readonly fittedWidthState = signal(800);
  readonly scale = this.scaleState.asReadonly();
  readonly x = this.xState.asReadonly();
  readonly y = this.yState.asReadonly();
  readonly fittedWidth = this.fittedWidthState.asReadonly();
  private readonly selectedCode = signal('');
  readonly selectedMarker = computed(() =>
    this.map().markers.find((marker) => marker.code === this.selectedCode()),
  );
  readonly locationOptions = computed(() => [
    { id: '', label: this.ui.map.chooseLocation },
    ...this.map().markers.map((marker) => ({
      id: marker.code,
      label: marker.title,
      detail: marker.code,
    })),
  ]);
  readonly locationValue = this.selectedCode.asReadonly();
  private observer?: ResizeObserver;
  private drag?: { id: number; x: number; y: number; initialX: number; initialY: number };
  transform() {
    return `translate(${this.x()}px, ${this.y()}px) scale(${this.scale()})`;
  }
  ngAfterViewInit() {
    this.observer = new ResizeObserver(() => {
      const viewport = this.viewport().nativeElement;
      if (viewport.clientWidth && viewport.clientHeight) {
        this.fittedWidthState.set(
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
    this.scaleState.set(1);
    this.xState.set(0);
    this.yState.set(0);
  }
  zoom(factor: number) {
    this.scaleState.set(Math.max(0.5, Math.min(4, this.scale() * factor)));
  }
  selectLocation(code: string): void {
    this.selectedCode.set(code);
    const marker = this.selectedMarker();
    if (marker) {
      this.xState.set((0.5 - marker.x / 100) * this.fittedWidth() * this.scale());
      this.yState.set(
        (((0.5 - marker.y / 100) * this.fittedWidth() * this.map().height) / this.map().width) *
          this.scale(),
      );
    }
  }
  openMarker(marker: MapMarker): void {
    this.selectedCode.set(marker.code);
    this.openMaterial.emit(marker.materialId);
  }
  key(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    switch (event.key) {
      case 'ArrowLeft':
        this.xState.update((value) => value - 40);
        break;
      case 'ArrowRight':
        this.xState.update((value) => value + 40);
        break;
      case 'ArrowUp':
        this.yState.update((value) => value - 40);
        break;
      case 'ArrowDown':
        this.yState.update((value) => value + 40);
        break;
      case '+':
      case '=':
        this.zoom(1.25);
        break;
      case '-':
        this.zoom(1 / 1.25);
        break;
      case 'Home':
        this.reset();
        break;
      default:
        return;
    }
    event.preventDefault();
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
    this.xState.set(this.drag.initialX + event.clientX - this.drag.x);
    this.yState.set(this.drag.initialY + event.clientY - this.drag.y);
  }
  endPan(event: PointerEvent) {
    if (this.drag?.id !== event.pointerId) {
      return;
    }
    this.drag = undefined;
    const viewport = this.viewport().nativeElement;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  }
  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
