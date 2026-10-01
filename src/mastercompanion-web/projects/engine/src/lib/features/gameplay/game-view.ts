import { Component, computed, ElementRef, forwardRef, input, OnDestroy, OnInit, output, signal, Type, viewChild } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { CAMPAIGN_GAME, CampaignModuleFrontend, GameAction, GameToolContext, MaterialTarget, ToolRegistration } from '@mastercompanion/contracts';
import { GameSession } from './game-session';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-game-view', imports: [NgComponentOutlet],
  providers: [{ provide: CAMPAIGN_GAME, useExisting: forwardRef(() => GameView) }],
  template: `
    <section class="game-view" [attr.aria-label]="text.title">
      <div class="game-heading"><h1>{{ text.title }}</h1><div class="game-heading-actions">
        <button type="button" class="game-undo" [disabled]="!canOperate() || !state()?.lastOperation" [attr.aria-label]="text.undo" [title]="text.undo" (click)="openUndo($event)"><span aria-hidden="true">↶</span></button>
        <button type="button" [disabled]="pending()" (click)="session().load()">{{ text.refresh }}</button>
      </div></div>
      @if (pending()) { <p role="status">{{ text.working }}</p> }
      @if (session().error(); as error) {
        <div class="game-error" role="alert"><p>{{ text.errors[error] }}</p>
          @if (session().hasRecovery()) { <button [disabled]="pending()" (click)="session().retry()">{{ text.retryOperation }}</button> }
          @if (session().invalidPending() && state()) { <button [disabled]="pending()" (click)="session().discardUnreadable()">{{ text.discardUnreadable }}</button> }
        </div>
      }
      @if (state(); as current) {
        @if (!current.snapshot.party.length) {
          <p>{{ text.emptyParty }}</p><button type="button" (click)="openParty.emit()">{{ text.manageParty }}</button>
        } @else {
          <section class="game-time" [attr.aria-label]="text.timeControls"><h2>{{ text.elapsedTime }}: {{ formatTime(current.snapshot.timeMinutes) }}</h2>
            <fieldset [disabled]="!canOperate()"><legend>{{ text.timeControls }}</legend>
              <div class="game-actions">
                <button type="button" (click)="advance(30)">{{ text.searchBuilding }}</button>
                <button type="button" (click)="execute({kind: 'shortRest'})">{{ text.shortRest }}</button>
                <button type="button" (click)="execute({kind: 'longRest'})">{{ text.longRest }}</button>
              </div>
              <form class="custom-time" (submit)="customAdvance($event)"><label for="game-minutes">{{ text.customMinutes }}</label>
                <input id="game-minutes" type="number" min="1" max="525600" step="1" required [value]="minutes()" (input)="updateMinutes($event)">
                <button type="submit">{{ text.advance }}</button></form>
            </fieldset><p class="game-hint">{{ text.restHint }}</p>
          </section>
          @if (module().tools.length) {
            @if (module().tools.length > 1) { <div class="tool-selector" [attr.aria-label]="text.tools">
              @for (tool of module().tools; track tool.id) {
                <button type="button" [attr.aria-pressed]="selectedTool() === tool.id" (click)="selectTool(tool)">{{ tool.label }}</button>
              }
            </div> }
            @if (toolLoading()) { <p role="status">{{ text.loadingTool }}</p> }
            @if (toolError()) { <div role="alert"><p>{{ text.toolFailed }}</p><button (click)="retryTool()">{{ text.retryTool }}</button></div> }
            @if (toolComponent(); as component) { <ng-container *ngComponentOutlet="component" /> }
          } @else { <p>{{ text.noTools }}</p> }
        }
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
  readonly openParty = output<void>();
  readonly materialRequested = output<MaterialTarget>();
  readonly text = uiMessages.game;
  readonly state = computed(() => this.session().state());
  readonly pending = computed(() => this.session().pending());
  readonly canOperate = computed(() => this.session().canOperate());
  readonly minutes = signal('60');
  readonly validationError = signal<'invalidMinutes' | null>(null);
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
  openMaterial(target: MaterialTarget): void { this.materialRequested.emit(target); }
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
      case 'updateParty': return this.text.operations.updateParty;
      case 'advanceTime': return this.text.operations.advanceTime;
      case 'shortRest': return this.text.operations.shortRest;
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
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.undoRevision = state.revision; this.undoKind.set(state.lastOperation.kind);
    this.undoDialog().nativeElement.showModal();
  }
  closeUndo() { this.undoDialog().nativeElement.close(); this.opener?.focus({ preventScroll: true }); }
  async confirmUndo() {
    this.closeUndo();
    if (this.state()?.revision === this.undoRevision) await this.execute({ kind: 'undo' });
  }
}
