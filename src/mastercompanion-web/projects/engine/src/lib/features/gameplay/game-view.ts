import { Component, computed, ElementRef, forwardRef, input, OnDestroy, OnInit, signal, Type, viewChild } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { CAMPAIGN_GAME, CampaignModuleFrontend, GameAction, GameToolContext, ToolRegistration } from '@mastercompanion/contracts';
import { GameSession } from './game-session';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-game-view', imports: [NgComponentOutlet],
  providers: [{ provide: CAMPAIGN_GAME, useExisting: forwardRef(() => GameView) }],
  template: `
    <section class="game-view" [attr.aria-label]="text.title">
      <div class="game-heading"><h1>{{ text.title }}</h1><button type="button" [disabled]="pending()" (click)="session().load()">{{ text.refresh }}</button></div>
      @if (pending()) { <p role="status">{{ text.working }}</p> }
      @if (session().error(); as error) {
        <div class="game-error" role="alert"><p>{{ text.errors[error] }}</p>
          @if (session().hasRecovery()) { <button [disabled]="pending()" (click)="session().retry()">{{ text.retryOperation }}</button> }
          @if (session().invalidPending() && state()) { <button [disabled]="pending()" (click)="session().discardUnreadable()">{{ text.discardUnreadable }}</button> }
        </div>
      }
      @if (state(); as current) {
        @if (!current.snapshot.party.length) {
          <form (submit)="configure($event)"><fieldset [disabled]="!canOperate()">
            <legend>{{ text.partySetup }}</legend><p>{{ text.partyHint }}</p>
            @for (member of partyDraft(); track member.id; let index = $index) {
              <div class="party-row"><label [for]="'party-name-' + member.id">{{ text.characterName }} {{ index + 1 }}</label>
                <input [id]="'party-name-' + member.id" [value]="member.name" maxlength="100" required (input)="rename(member.id, $event)">
                <button type="button" [disabled]="partyDraft().length === 1" [attr.aria-label]="text.removeCharacter + ' ' + (member.name || (index + 1))" (click)="remove(member.id)">{{ text.removeCharacter }}</button>
              </div>
            }
            <div class="game-actions"><button type="button" [disabled]="partyDraft().length >= 20" (click)="add()">{{ text.addCharacter }}</button>
              <button type="submit">{{ text.start }}</button></div>
          </fieldset></form>
        } @else {
          <section class="game-time" [attr.aria-label]="text.timeControls"><h2>{{ text.elapsedTime }}: {{ formatTime(current.snapshot.timeMinutes) }}</h2>
            <fieldset [disabled]="!canOperate()"><legend>{{ text.timeControls }}</legend>
              <div class="game-actions">
                <button type="button" (click)="advance(10)">+10 {{ text.minute }}</button>
                <button type="button" (click)="advance(60)">+1 {{ text.hour }}</button>
                <button type="button" (click)="advance(480)">+8 {{ text.hour }}</button>
                <button type="button" (click)="execute({kind: 'longRest'})">{{ text.longRest }}</button>
              </div>
              <form class="custom-time" (submit)="customAdvance($event)"><label for="game-minutes">{{ text.customMinutes }}</label>
                <input id="game-minutes" type="number" min="1" max="525600" step="1" required [value]="minutes()" (input)="updateMinutes($event)">
                <button type="submit">{{ text.advance }}</button></form>
            </fieldset><p class="game-hint">{{ text.restHint }}</p>
          </section>
          @if (module().tools.length) {
            <div class="tool-selector" [attr.aria-label]="text.tools">
              @for (tool of module().tools; track tool.id) {
                <button type="button" [attr.aria-pressed]="selectedTool() === tool.id" (click)="selectTool(tool)">{{ tool.label }}</button>
              }
            </div>
            @if (toolLoading()) { <p role="status">{{ text.loadingTool }}</p> }
            @if (toolError()) { <div role="alert"><p>{{ text.toolFailed }}</p><button (click)="retryTool()">{{ text.retryTool }}</button></div> }
            @if (toolComponent(); as component) { <ng-container *ngComponentOutlet="component" /> }
          } @else { <p>{{ text.noTools }}</p> }
        }
        <section class="game-history"><h2>{{ text.history }}</h2>
          @if (current.lastOperation; as last) {
            <p>{{ text.lastOperation }}: {{ operationLabel(last.kind) }}</p>
            <button type="button" [disabled]="!canOperate()" (click)="openUndo($event)">{{ text.undo }}</button>
          } @else { <p>{{ text.noHistory }}</p> }
        </section>
      }
      @if (validationError(); as error) { <p class="game-error" role="alert">{{ text[error] }}</p> }
    </section>
    <dialog #undoDialog class="game-undo-dialog" [attr.aria-label]="text.undoTitle" (cancel)="closeUndo()">
      <h2>{{ text.undoTitle }}</h2><p>{{ text.undoHint }}</p><p>{{ operationLabel(undoKind()) }}</p>
      <div class="game-actions"><button type="button" (click)="closeUndo()">{{ text.cancel }}</button><button type="button" (click)="confirmUndo()">{{ text.confirmUndo }}</button></div>
    </dialog>
  `,
})
export class GameView implements OnInit, OnDestroy, GameToolContext {
  readonly session = input.required<GameSession>();
  readonly module = input.required<CampaignModuleFrontend>();
  readonly text = uiMessages.game;
  readonly state = computed(() => this.session().state());
  readonly pending = computed(() => this.session().pending());
  readonly canOperate = computed(() => this.session().canOperate());
  readonly partyDraft = signal([{ id: crypto.randomUUID(), name: '' }]);
  readonly minutes = signal('60');
  readonly validationError = signal<'invalidParty' | 'invalidMinutes' | null>(null);
  readonly selectedTool = signal<string | null>(null);
  readonly toolComponent = signal<Type<unknown> | null>(null);
  readonly toolLoading = signal(false);
  readonly toolError = signal(false);
  readonly undoKind = signal('');
  private readonly undoDialog = viewChild.required<ElementRef<HTMLDialogElement>>('undoDialog');
  private opener: HTMLElement | null = null;
  private undoRevision = -1;
  private generation = 0;
  private destroyed = false;

  ngOnInit() { const tool = this.module().tools[0]; if (tool) void this.selectTool(tool); }
  ngOnDestroy() { this.destroyed = true; this.generation++; }
  async execute(action: GameAction) { this.validationError.set(null); return this.session().execute(action); }
  add() { if (this.canOperate() && this.partyDraft().length < 20) this.partyDraft.update(members => [...members, { id: crypto.randomUUID(), name: '' }]); }
  remove(id: string) { if (this.canOperate() && this.partyDraft().length > 1) this.partyDraft.update(members => members.filter(member => member.id !== id)); }
  rename(id: string, event: Event) {
    if (event.target instanceof HTMLInputElement) {
      const name = event.target.value;
      this.partyDraft.update(members => members.map(member => member.id === id ? { ...member, name } : member));
    }
  }
  async configure(event: Event) {
    event.preventDefault();
    const party = this.partyDraft().map(member => ({ ...member, name: member.name.trim() }));
    if (party.some(member => !member.name || member.name.length > 100 || /[\u0000-\u001f\u007f]/.test(member.name))) {
      this.validationError.set('invalidParty'); return;
    }
    await this.execute({ kind: 'configureParty', party });
  }
  updateMinutes(event: Event) { if (event.target instanceof HTMLInputElement) this.minutes.set(event.target.value); }
  customAdvance(event: Event) {
    event.preventDefault();
    const minutes = Number(this.minutes());
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 525_600) { this.validationError.set('invalidMinutes'); return; }
    void this.advance(minutes);
  }
  advance(minutes: number) { return this.execute({ kind: 'advanceTime', minutes }); }
  formatTime(minutes: number) { return `${Math.floor(minutes / 60)} ${this.text.hour} ${minutes % 60} ${this.text.minute}`; }
  operationLabel(kind: string) {
    switch (kind) {
      case 'configureParty': return this.text.operations.configureParty;
      case 'advanceTime': return this.text.operations.advanceTime;
      case 'longRest': return this.text.operations.longRest;
      case 'module': return this.text.operations.module;
      default: return this.text.noHistory;
    }
  }
  async selectTool(tool: ToolRegistration) {
    if (this.selectedTool() === tool.id && this.toolComponent()) return;
    const generation = ++this.generation;
    this.selectedTool.set(tool.id); this.toolLoading.set(true); this.toolError.set(false);
    this.toolComponent.set(null);
    try { const component = await tool.loadComponent(); if (!this.destroyed && generation === this.generation) this.toolComponent.set(component); }
    catch { if (!this.destroyed && generation === this.generation) this.toolError.set(true); }
    finally { if (!this.destroyed && generation === this.generation) this.toolLoading.set(false); }
  }
  retryTool() { const tool = this.module().tools.find(tool => tool.id === this.selectedTool()); if (tool) void this.selectTool(tool); }
  openUndo(event: Event) {
    const state = this.state();
    if (!this.canOperate() || !state?.lastOperation) return;
    this.opener = event.target instanceof HTMLElement ? event.target : null;
    this.undoRevision = state.revision; this.undoKind.set(state.lastOperation.kind);
    this.undoDialog().nativeElement.showModal();
  }
  closeUndo() { this.undoDialog().nativeElement.close(); this.opener?.focus({ preventScroll: true }); }
  async confirmUndo() {
    this.closeUndo();
    if (this.state()?.revision === this.undoRevision) await this.execute({ kind: 'undo' });
  }
}
