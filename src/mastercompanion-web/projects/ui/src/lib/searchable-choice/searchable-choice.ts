import {
  Component,
  ElementRef,
  HostListener,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ChoiceOption } from './choice-option';
import { filterChoices } from './choice-filter';

@Component({
  selector: 'mc-searchable-choice',
  templateUrl: './searchable-choice.html',
  styleUrl: './searchable-choice.scss',
})
export class SearchableChoiceComponent {
  readonly options = input.required<readonly ChoiceOption[]>();
  readonly value = input('');
  readonly label = input.required<string>();
  readonly searchLabel = input.required<string>();
  readonly noResultsLabel = input.required<string>();
  readonly loadingLabel = input.required<string>();
  readonly controlId = input.required<string>();
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly selectionChanged = output<string>();
  readonly expanded = signal(false);
  readonly query = signal('');
  readonly activeIndex = signal(0);
  readonly filtered = computed(() => filterChoices(this.options(), this.query()));
  readonly selected = computed(() => this.options().find((option) => option.id === this.value()));
  readonly activeId = computed(() =>
    this.filtered()[this.activeIndex()] ? this.optionId(this.activeIndex()) : null,
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');

  constructor() {
    afterRenderEffect(() => {
      if (this.expanded()) {
        this.search()?.nativeElement.focus({ preventScroll: true });
        const activeId = this.activeId();
        if (activeId) {
          this.host.nativeElement
            .querySelector<HTMLElement>(`[id="${activeId}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        }
      }
    });
  }

  focus(): void {
    this.trigger().nativeElement.focus();
  }

  toggle(): void {
    if (this.disabled() || this.loading()) {
      return;
    }
    if (this.expanded()) {
      this.close();
      return;
    }
    this.query.set('');
    this.activeIndex.set(
      Math.max(
        0,
        this.options().findIndex((option) => option.id === this.value()),
      ),
    );
    this.expanded.set(true);
  }

  updateQuery(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.query.set(event.target.value);
      this.activeIndex.set(0);
    }
  }

  choose(option: ChoiceOption): void {
    if (this.disabled() || this.loading()) {
      return;
    }
    this.selectionChanged.emit(option.id);
    this.close();
  }

  close(restoreFocus = true): void {
    this.expanded.set(false);
    if (restoreFocus) {
      this.focus();
    }
  }

  optionId(index: number): string {
    return `${this.controlId()}-option-${index}`;
  }

  @HostListener('document:pointerdown', ['$event'])
  outsidePointer(event: PointerEvent): void {
    if (
      this.expanded() &&
      event.target instanceof Node &&
      !this.host.nativeElement.contains(event.target)
    ) {
      this.close(false);
    }
  }

  @HostListener('focusout', ['$event'])
  leave(event: FocusEvent): void {
    if (
      this.expanded() &&
      event.relatedTarget instanceof Node &&
      !this.host.nativeElement.contains(event.relatedTarget)
    ) {
      this.close(false);
    }
  }

  @HostListener('keydown', ['$event'])
  key(event: KeyboardEvent): void {
    if (!this.expanded()) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.toggle();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    const count = this.filtered().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(
        count ? (this.activeIndex() + (event.key === 'ArrowDown' ? 1 : -1) + count) % count : 0,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = this.filtered()[this.activeIndex()];
      if (option) {
        this.choose(option);
      }
    }
  }
}
