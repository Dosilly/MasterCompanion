import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CAMPAIGN_GAME, GameAction } from '@mastercompanion/contracts';
import { uiMessages } from '../i18n/messages';
import {
  buildingAction,
  encounterAction,
  encounterMaterials,
  encounterPreview,
  EncounterRollSelection,
  expeditionMaterials,
  explorationAction,
  Faction,
  readExpeditionView,
  selectedEncounterRoll,
} from './expedition-view';
import { ActionRequired } from './action-required';

@Component({
  selector: 'mc-ythryn-expedition',
  imports: [ActionRequired],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expedition-tool.html',
  styleUrl: './expedition-tool.scss',
})
export class ExpeditionTool {
  readonly game = inject(CAMPAIGN_GAME);
  readonly text = uiMessages.expedition;
  readonly ui = uiMessages;
  readonly factions: readonly Faction[] = ['avarice', 'auril'];
  readonly materials = encounterMaterials;
  readonly view = computed(() => {
    const state = this.game.state();
    return state ? readExpeditionView(state) : null;
  });
  readonly minutes = signal('60');
  readonly unnumbered = signal(true);
  readonly newBuilding = signal(true);
  readonly arrivalDraft = signal<Partial<Record<Faction, string>>>({});
  readonly error = signal(false);
  private readonly rollDraft = signal<EncounterRollSelection | null>(null);
  readonly preview = computed(() => {
    const view = this.view();
    return view ? encounterPreview(view, this.rollDraft()) : null;
  });

  format(minute: number) {
    return `${Math.floor(minute / 60)} ${uiMessages.hour} ${minute % 60} ${uiMessages.minute}`;
  }
  open(target: keyof typeof expeditionMaterials) {
    this.game.openMaterial(expeditionMaterials[target]);
  }
  openResult(outcome: keyof typeof encounterMaterials) {
    const id = encounterMaterials[outcome];
    if (id) {
      this.game.openMaterial({ id });
    }
  }
  setMinutes(event: Event) {
    if (event.target instanceof HTMLInputElement) {
      this.minutes.set(event.target.value);
    }
  }
  setUnnumbered(event: Event) {
    if (event.target instanceof HTMLInputElement) {
      this.unnumbered.set(event.target.checked);
    }
  }
  setNewBuilding(event: Event) {
    if (event.target instanceof HTMLInputElement) {
      this.newBuilding.set(event.target.checked);
    }
  }
  setArrival(faction: Faction, event: Event) {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.arrivalDraft.update((value) => ({ ...value, [faction]: input.value }));
    }
  }
  setRoll(id: number, event: Event) {
    const check = this.view()?.pending[0];
    if (this.game.canOperate() && check?.id === id && event.target instanceof HTMLInputElement) {
      this.rollDraft.set({ check, value: event.target.value });
    }
  }
  roll(id: number) {
    const check = this.view()?.pending[0];
    if (this.game.canOperate() && check?.id === id) {
      this.rollDraft.set({ check, value: String(Math.floor(Math.random() * 100) + 1) });
    }
  }
  selectedRoll(id: number) {
    const view = this.view();
    return view?.pending[0]?.id === id ? selectedEncounterRoll(view, this.rollDraft()) : '';
  }
  async run(action: GameAction | null): Promise<boolean> {
    this.error.set(action === null);
    return action !== null && this.game.canOperate() ? this.game.execute(action) : false;
  }
  explore(event: Event) {
    event.preventDefault();
    void this.run(explorationAction(Number(this.minutes())));
  }
  search() {
    void this.run(buildingAction(this.unnumbered(), this.newBuilding()));
  }
  async confirm(event: Event, faction: Faction) {
    event.preventDefault();
    const now = this.game.state()?.snapshot.timeMinutes ?? 0;
    const raw = this.arrivalDraft()[faction];
    const minute = raw === undefined ? now : raw.trim() === '' ? NaN : Number(raw);
    const action: GameAction | null =
      Number.isSafeInteger(minute) && minute >= 0 && minute <= now
        ? { kind: 'module', command: { kind: 'confirmArrival', faction, minute } }
        : null;
    if (await this.run(action)) {
      this.arrivalDraft.update((value) => ({ ...value, [faction]: undefined }));
    }
  }
  toggleAuril() {
    const current = this.view();
    if (current) {
      void this.run({
        kind: 'module',
        command: { kind: 'configureExpedition', aurilEnabled: !current.aurilEnabled },
      });
    }
  }
  async resolve(event: Event, id: number) {
    event.preventDefault();
    const current = this.view();
    if (current && (await this.run(encounterAction(current, id, Number(this.selectedRoll(id)))))) {
      this.rollDraft.set(null);
    }
  }
}
