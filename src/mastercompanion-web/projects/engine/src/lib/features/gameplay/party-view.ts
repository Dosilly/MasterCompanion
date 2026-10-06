import { IconComponent } from '@mastercompanion/ui';
import { Component, computed, effect, ElementRef, input, signal, viewChild } from '@angular/core';
import { GameSession } from './game-session';
import { PartyDraft } from './party-draft';
import { uiMessages } from '../../i18n/messages';

@Component({
  imports: [IconComponent],
  selector: 'mc-party-view',
  templateUrl: './party-view.html',
  styleUrl: './party-view.scss',
})
export class PartyView {
  readonly session = input.required<GameSession>();
  readonly text = uiMessages.game;
  readonly draft = new PartyDraft();
  readonly dirty = this.draft.dirty;
  readonly state = computed(() => this.session().state());
  readonly stale = computed(() => {
    const state = this.state();
    return state !== null && this.draft.isStale(state.revision);
  });
  readonly currentNames = computed(
    () =>
      this.state()
        ?.snapshot.party.map((member) => member.name)
        .join(', ') ?? '',
  );
  readonly validationError = signal(false);
  readonly confirmation = signal<'rebase' | 'discard'>('discard');
  private readonly confirmationDialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('confirmationDialog');
  private opener: HTMLElement | null = null;
  private confirmedRevision = -1;
  private initialized = false;

  constructor() {
    effect(() => {
      const state = this.state();
      if (!state) {
        return;
      }
      if (!this.initialized) {
        this.initialized = true;
        if (state.revision === 0) {
          this.draft.begin(state);
        }
      } else if (this.draft.editing() && !this.dirty() && this.draft.isStale(state.revision)) {
        // A recovered operation may finish initial setup after this view was opened.
        this.draft.finish();
      }
    });
  }

  edit(): void {
    const state = this.state();
    if (!state || !this.session().canOperate()) {
      return;
    }
    this.validationError.set(false);
    this.draft.begin(state);
  }

  rename(id: string, event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.draft.rename(id, event.target.value);
    }
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const state = this.state();
    if (!state || !this.session().canOperate() || this.stale()) {
      return;
    }
    const party = this.draft.validatedMembers(state.revision === 0);
    this.validationError.set(party === null);
    if (party === null) {
      return;
    }
    if (
      await this.session().execute({
        kind: state.revision === 0 ? 'configureParty' : 'updateParty',
        party,
      })
    ) {
      this.draft.finish();
    }
  }

  async retry(): Promise<void> {
    if (await this.session().retry()) {
      const state = this.state();
      const party = this.draft.validatedMembers(false);
      if (state && party && JSON.stringify(state.snapshot.party) === JSON.stringify(party)) {
        this.draft.finish();
      }
    }
  }

  cancel(event: Event): void {
    if (this.dirty()) {
      this.openConfirmation('discard', event);
    } else {
      this.discard();
    }
  }

  openConfirmation(kind: 'rebase' | 'discard', event: Event): void {
    const state = this.state();
    if (!state || (kind === 'rebase' && !this.session().canOperate())) {
      return;
    }
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.confirmedRevision = state.revision;
    this.confirmation.set(kind);
    this.confirmationDialog().nativeElement.showModal();
  }

  closeConfirmation(): void {
    this.confirmationDialog().nativeElement.close();
    this.opener?.focus({ preventScroll: true });
  }

  confirm(): void {
    this.closeConfirmation();
    if (this.confirmation() === 'discard') {
      this.discard();
    } else if (this.session().canOperate() && this.state()?.revision === this.confirmedRevision) {
      this.draft.acceptRevision(this.confirmedRevision);
    }
  }

  private discard(): void {
    const state = this.state();
    this.validationError.set(false);
    if (state?.revision === 0) {
      this.draft.begin(state);
    } else {
      this.draft.finish();
    }
  }
}
