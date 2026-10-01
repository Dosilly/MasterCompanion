import { Component, computed, effect, ElementRef, input, signal, viewChild } from '@angular/core';
import { GameSession } from './game-session';
import { PartyDraft } from './party-draft';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-party-view',
  template: `
    <section class="party-view" [attr.aria-label]="text.partyTitle">
      <div class="game-heading"><h1>{{ text.partyTitle }}</h1><button type="button" [disabled]="session().pending()" (click)="session().load()">{{ text.refresh }}</button></div>
      <p class="game-hint">{{ text.partyResourceHint }}</p>
      @if (session().pending()) { <p role="status">{{ text.working }}</p> }
      @if (session().error(); as error) {
        <div class="game-error" role="alert"><p>{{ text.errors[error] }}</p>
          @if (session().hasRecovery()) { <button type="button" [disabled]="session().pending()" (click)="retry()">{{ text.retryOperation }}</button> }
          @if (session().invalidPending() && state()) { <button type="button" [disabled]="session().pending()" (click)="session().discardUnreadable()">{{ text.discardUnreadable }}</button> }
        </div>
      }
      @if (state(); as current) {
        @if (draft.editing()) {
          @if (stale()) {
            <div class="game-error" role="alert"><p>{{ text.partyDraftConflict }}</p>
              <p>{{ text.currentParty }}: {{ currentNames() || text.noCharacters }}</p>
              <button type="button" [disabled]="!session().canOperate()" (click)="openConfirmation('rebase', $event)">{{ text.rebaseParty }}</button>
            </div>
          }
          <form class="party-editor" (submit)="save($event)"><fieldset [disabled]="session().pending() || session().hasRecovery() || session().invalidPending()">
            <legend>{{ current.revision === 0 ? text.partySetup : text.editParty }}</legend>
            <p class="game-hint">{{ text.partyEditHint }}</p>
            @for (member of draft.members(); track member.id; let index = $index) {
              <div class="party-row"><label [for]="'party-name-' + member.id">{{ text.characterName }} {{ index + 1 }}</label>
                <input [id]="'party-name-' + member.id" [value]="member.name" maxlength="100" required (input)="rename(member.id, $event)">
                <button type="button" [disabled]="current.revision === 0 && draft.members().length === 1" [attr.aria-label]="text.removeCharacter + ' ' + (member.name || (index + 1))" (click)="draft.remove(member.id)">{{ text.removeCharacter }}</button>
              </div>
            }
            @if (!draft.members().length) { <p>{{ text.noCharacters }}</p> }
            <div class="game-actions"><button type="button" [disabled]="draft.members().length >= 20" (click)="draft.add()">{{ text.addCharacter }}</button>
              <button type="submit" [disabled]="!session().canOperate() || stale()">{{ current.revision === 0 ? text.start : text.saveParty }}</button>
              <button type="button" (click)="cancel($event)">{{ text.cancel }}</button></div>
          </fieldset></form>
          @if (validationError()) { <p class="game-error" role="alert">{{ text.invalidParty }}</p> }
          @if (dirty()) { <p role="status">{{ text.partyDraftPreserved }}</p> }
        } @else {
          @if (current.snapshot.party.length) {
            <ol class="party-summary">@for (member of current.snapshot.party; track member.id) { <li>{{ member.name }}</li> }</ol>
          } @else { <p>{{ text.noCharacters }}</p> }
          <button type="button" [disabled]="!session().canOperate()" (click)="edit()">{{ text.editParty }}</button>
        }
      }
    </section>
    <dialog #confirmationDialog class="game-undo-dialog" [attr.aria-label]="confirmation() === 'rebase' ? text.rebasePartyTitle : text.discardPartyTitle" (cancel)="closeConfirmation()">
      <h2>{{ confirmation() === 'rebase' ? text.rebasePartyTitle : text.discardPartyTitle }}</h2>
      <p>{{ confirmation() === 'rebase' ? text.rebasePartyHint : text.discardPartyHint }}</p>
      <div class="game-actions"><button type="button" (click)="closeConfirmation()">{{ text.cancel }}</button>
        <button type="button" (click)="confirm()">{{ confirmation() === 'rebase' ? text.confirmRebaseParty : text.confirmDiscardParty }}</button></div>
    </dialog>
  `,
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
  readonly currentNames = computed(() => this.state()?.snapshot.party.map(member => member.name).join(', ') ?? '');
  readonly validationError = signal(false);
  readonly confirmation = signal<'rebase' | 'discard'>('discard');
  private readonly confirmationDialog = viewChild.required<ElementRef<HTMLDialogElement>>('confirmationDialog');
  private opener: HTMLElement | null = null;
  private confirmedRevision = -1;
  private initialized = false;

  constructor() {
    effect(() => {
      const state = this.state();
      if (!state) return;
      if (!this.initialized) {
        this.initialized = true;
        if (state.revision === 0) this.draft.begin(state);
      } else if (this.draft.editing() && !this.dirty() && this.draft.isStale(state.revision)) {
        // A recovered operation may finish initial setup after this view was opened.
        this.draft.finish();
      }
    });
  }

  edit(): void {
    const state = this.state();
    if (!state || !this.session().canOperate()) return;
    this.validationError.set(false);
    this.draft.begin(state);
  }

  rename(id: string, event: Event): void {
    if (event.target instanceof HTMLInputElement) this.draft.rename(id, event.target.value);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const state = this.state();
    if (!state || !this.session().canOperate() || this.stale()) return;
    const party = this.draft.validatedMembers(state.revision === 0);
    this.validationError.set(party === null);
    if (party === null) return;
    if (await this.session().execute({ kind: state.revision === 0 ? 'configureParty' : 'updateParty', party })) this.draft.finish();
  }

  async retry(): Promise<void> {
    if (await this.session().retry()) {
      const state = this.state();
      const party = this.draft.validatedMembers(false);
      if (state && party && JSON.stringify(state.snapshot.party) === JSON.stringify(party)) this.draft.finish();
    }
  }

  cancel(event: Event): void {
    if (this.dirty()) this.openConfirmation('discard', event);
    else this.discard();
  }

  openConfirmation(kind: 'rebase' | 'discard', event: Event): void {
    const state = this.state();
    if (!state || (kind === 'rebase' && !this.session().canOperate())) return;
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
    if (this.confirmation() === 'discard') this.discard();
    else if (this.session().canOperate() && this.state()?.revision === this.confirmedRevision) {
      this.draft.acceptRevision(this.confirmedRevision);
    }
  }

  private discard(): void {
    const state = this.state();
    this.validationError.set(false);
    if (state?.revision === 0) this.draft.begin(state);
    else this.draft.finish();
  }
}
