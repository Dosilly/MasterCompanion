import {
  Component,
  computed,
  ElementRef,
  forwardRef,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  Type,
  viewChild,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import {
  CAMPAIGN_GAME,
  CampaignModuleFrontend,
  GameAction,
  GameToolContext,
  MaterialTarget,
  ToolRegistration,
} from '@mastercompanion/contracts';
import { GameSession } from './game-session';
import { uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-game-view',
  imports: [NgComponentOutlet],
  providers: [{ provide: CAMPAIGN_GAME, useExisting: forwardRef(() => GameView) }],
  templateUrl: './game-view.html',
  styleUrl: './game-view.scss',
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

  ngOnInit() {
    const tool = this.module().tools[0];
    if (tool) {
      void this.selectTool(tool);
    }
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.generation++;
  }
  async execute(action: GameAction) {
    this.validationError.set(null);
    return this.session().execute(action);
  }
  openMaterial(target: MaterialTarget): void {
    this.materialRequested.emit(target);
  }
  updateMinutes(event: Event) {
    if (event.target instanceof HTMLInputElement) {
      this.minutes.set(event.target.value);
    }
  }
  customAdvance(event: Event) {
    event.preventDefault();
    const minutes = Number(this.minutes());
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 525_600) {
      this.validationError.set('invalidMinutes');
      return;
    }
    void this.advance(minutes);
  }
  advance(minutes: number) {
    return this.execute({ kind: 'advanceTime', minutes });
  }
  formatTime(minutes: number) {
    return `${Math.floor(minutes / 60)} ${this.text.hour} ${minutes % 60} ${this.text.minute}`;
  }
  operationLabel(kind: string) {
    switch (kind) {
      case 'configureParty':
        return this.text.operations.configureParty;
      case 'updateParty':
        return this.text.operations.updateParty;
      case 'advanceTime':
        return this.text.operations.advanceTime;
      case 'shortRest':
        return this.text.operations.shortRest;
      case 'longRest':
        return this.text.operations.longRest;
      case 'module':
        return this.text.operations.module;
      default:
        return this.text.noHistory;
    }
  }
  async selectTool(tool: ToolRegistration) {
    if (this.selectedTool() === tool.id && this.toolComponent()) {
      return;
    }
    const generation = ++this.generation;
    this.selectedTool.set(tool.id);
    this.toolLoading.set(true);
    this.toolError.set(false);
    this.toolComponent.set(null);
    try {
      const component = await tool.loadComponent();
      if (!this.destroyed && generation === this.generation) {
        this.toolComponent.set(component);
      }
    } catch {
      if (!this.destroyed && generation === this.generation) {
        this.toolError.set(true);
      }
    } finally {
      if (!this.destroyed && generation === this.generation) {
        this.toolLoading.set(false);
      }
    }
  }
  retryTool() {
    const tool = this.module().tools.find((tool) => tool.id === this.selectedTool());
    if (tool) {
      void this.selectTool(tool);
    }
  }
  openUndo(event: Event) {
    const state = this.state();
    if (!this.canOperate() || !state?.lastOperation) {
      return;
    }
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.undoRevision = state.revision;
    this.undoKind.set(state.lastOperation.kind);
    this.undoDialog().nativeElement.showModal();
  }
  closeUndo() {
    this.undoDialog().nativeElement.close();
    this.opener?.focus({ preventScroll: true });
  }
  async confirmUndo() {
    this.closeUndo();
    if (this.state()?.revision === this.undoRevision) {
      await this.execute({ kind: 'undo' });
    }
  }
}
