import {
  AfterRenderRef,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@mastercompanion/ui';
import { uiMessages } from '../../i18n/messages';
import { MaterialDeletion } from './material-deletion';

/** Both material entry points use this confirmation without unmounting the editor. */
@Component({
  selector: 'mc-material-deletion-dialog',
  imports: [IconComponent],
  templateUrl: './material-deletion-dialog.html',
  styleUrl: './material-deletion-dialog.scss',
})
export class MaterialDeletionDialog {
  readonly deletion = input.required<MaterialDeletion>();
  readonly confirmed = output<string>();
  readonly ui = uiMessages.deletion;
  readonly acknowledged = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');
  private opener?: HTMLElement;
  private readonly injector = inject(Injector);
  private focusReturn?: AfterRenderRef;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.focusReturn?.destroy());
  }

  open(trigger: HTMLElement): void {
    this.focusReturn?.destroy();
    this.opener = trigger;
    this.acknowledged.set(false);
    this.dialog().nativeElement.showModal();
    this.cancelButton().nativeElement.focus();
  }

  cancel(event?: Event): void {
    event?.preventDefault();
    if (!this.deletion().submitting()) {
      this.deletion().cancel();
      this.dialog().nativeElement.close();
      this.focusReturn = afterNextRender(() => this.opener?.focus(), { injector: this.injector });
    }
  }

  acknowledge(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.acknowledged.set(event.target.checked);
    }
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    const id = await this.deletion().confirm(this.acknowledged());
    if (id) {
      this.dialog().nativeElement.close();
      this.confirmed.emit(id);
    }
  }
}
