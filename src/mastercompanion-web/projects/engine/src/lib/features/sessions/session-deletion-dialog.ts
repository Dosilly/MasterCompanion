import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import type { SessionRecord } from '@mastercompanion/contracts';
import { uiMessages } from '../../i18n/messages';

/** Presents deletion consequences; the session use case owns persistence and drafts. */
@Component({
  selector: 'mc-session-deletion-dialog',
  templateUrl: './session-deletion-dialog.html',
  styleUrl: './session-deletion-dialog.scss',
})
export class SessionDeletionDialog {
  readonly record = input<SessionRecord | null>(null);
  readonly dirty = input(false);
  readonly pending = input(false);
  readonly locked = input(false);
  readonly error = input<string | null>(null);
  readonly retryAvailable = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  readonly retried = output<void>();
  readonly text = uiMessages.meetings;
  readonly discardAcknowledged = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');
  private opener?: HTMLElement;

  open(event: Event): void {
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.discardAcknowledged.set(false);
    this.dialog().nativeElement.showModal();
    this.cancelButton().nativeElement.focus();
  }

  close(restoreFocus = true): void {
    this.dialog().nativeElement.close();
    if (restoreFocus) {
      this.opener?.focus();
    }
  }

  cancel(event?: Event): void {
    event?.preventDefault();
    if (!this.pending()) {
      this.close();
      this.cancelled.emit();
    }
  }

  acknowledge(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.discardAcknowledged.set(event.target.checked);
    }
  }

  submit(event: Event): void {
    event.preventDefault();
    if (!this.locked() && (!this.dirty() || this.discardAcknowledged())) {
      this.confirmed.emit();
    }
  }
}
