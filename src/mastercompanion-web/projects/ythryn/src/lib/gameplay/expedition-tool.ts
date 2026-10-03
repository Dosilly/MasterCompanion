import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CAMPAIGN_GAME, GameAction } from '@mastercompanion/contracts';
import { uiMessages } from '../i18n/messages';
import { buildingAction, encounterAction, encounterMaterials, expeditionMaterials, explorationAction, Faction, readExpeditionView } from './expedition-view';

@Component({
  selector: 'mc-ythryn-expedition', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="expedition-tool" aria-labelledby="expedition-title">
      <h2 id="expedition-title">{{ text.title }}</h2>
      <p>{{ text.scheduleHint }}</p>
      @if (view(); as current) {
        <div class="tool-grid">
          <section class="tool-card" aria-labelledby="hourly-title">
            <h3 id="hourly-title">{{ text.hourlyTitle }}</h3>
            <p>{{ text.explorationHint }}</p>
            <p>{{ text.trackedExploration }}: {{ format(current.explorationMinutes) }}</p>
            <p>{{ text.nextHourly }}: {{ format(current.nextHourlyIn) }}</p>
            <form (submit)="explore($event)"><fieldset [disabled]="!game.canOperate()">
              <legend>{{ text.addExploration }}</legend>
              <label for="exploration-minutes">{{ text.minutes }}</label>
              <input id="exploration-minutes" type="number" min="1" max="1440" step="1" required [value]="minutes()" (input)="setMinutes($event)">
              <button type="submit">{{ text.explore }}</button>
            </fieldset></form>
            <button type="button" (click)="open('rules')">{{ text.rules }}</button>
          </section>
          <section class="tool-card" aria-labelledby="building-title">
            <h3 id="building-title">{{ text.buildingTitle }}</h3><p>{{ text.buildingHint }}</p>
            <fieldset [disabled]="!game.canOperate()"><legend>{{ text.searchOptions }}</legend>
              <label class="choice"><input type="checkbox" [checked]="unnumbered()" (change)="setUnnumbered($event)">{{ text.unnumbered }}</label>
              <label class="choice"><input type="checkbox" [checked]="newBuilding()" (change)="setNewBuilding($event)">{{ text.newBuilding }}</label>
              <button type="button" (click)="search()">{{ text.search }}</button>
            </fieldset><p>{{ text.patrolHint }}</p>
          </section>
          @for (faction of factions; track faction) {
            <section class="tool-card" [attr.aria-labelledby]="faction + '-title'">
              <h3 [id]="faction + '-title'">{{ text.factions[faction] }}</h3>
              <p>{{ faction === 'avarice' ? text.avariceHint : text.aurilHint }}</p>
              @if (current[faction].arrivedAt; as at) { <p>{{ text.arrived }}: {{ format(at) }}</p> }
              @else if (current[faction].arrivedAt === 0) { <p>{{ text.arrived }}: {{ format(0) }}</p> }
              @else if (!current[faction].enabled) { <p>{{ text.disabled }}</p> }
              @else {
                @if (current[faction].deadline === null) { <p>{{ text.waitingRest }}</p> }
                @else { <p [class.due]="current[faction].pending" role="status">{{ current[faction].pending ? text.arrivalDue : text.untilArrival + ': ' + format(current[faction].remainingMinutes ?? 0) }}</p> }
                <form (submit)="confirm($event, faction)"><fieldset [disabled]="!game.canOperate()">
                  <legend>{{ text.confirmArrival }}</legend>
                  <label [for]="faction + '-minute'">{{ text.arrivalMinute }}</label>
                  <input [id]="faction + '-minute'" type="number" min="0" [max]="game.state()?.snapshot?.timeMinutes ?? 0" step="1" required
                    [value]="arrivalDraft()[faction] ?? game.state()?.snapshot?.timeMinutes ?? 0" (input)="setArrival(faction, $event)">
                  <button type="submit">{{ text.confirmArrival }}</button>
                </fieldset></form>
              }
              @if (faction === 'auril' && current.auril.arrivedAt === null) {
                <button type="button" [disabled]="!game.canOperate()" (click)="toggleAuril()">{{ current.aurilEnabled ? text.disableAuril : text.enableAuril }}</button>
              }
              <button type="button" (click)="open(faction)">{{ text.rules }}</button>
            </section>
          }
        </div>
        <section class="tool-card encounter-queue" aria-labelledby="encounter-queue-title">
          <h3 id="encounter-queue-title">{{ text.queueTitle }}: {{ current.pending.length }}</h3>
          <p>{{ text.queueHint }}</p>
          @if (current.pending.length >= 216) { <p role="status">{{ text.queueLimitHint }}</p> }
          @if (current.pending[0]; as check) {
            <p><strong>{{ text.kinds[check.kind] }}</strong> · {{ text.gameTime }}: {{ format(check.minute) }}</p>
            <form (submit)="resolve($event, check.id)"><fieldset [disabled]="!game.canOperate()">
              <legend>{{ text.resolve }}</legend><label for="encounter-roll">{{ text.roll }}</label>
              <input id="encounter-roll" type="number" min="1" max="100" step="1" required [value]="selectedRoll(check.id)" (input)="setRoll(check.id, $event)">
              <button type="submit">{{ text.resolve }}</button>
            </fieldset></form>
          } @else { <p>{{ text.noPending }}</p> }
          <button type="button" (click)="open('table')">{{ text.table }}</button>
          @if (current.lastResult; as result) {
            <div class="last-result" role="status"><h4>{{ text.lastResult }}</h4>
              <p>{{ text.kinds[result.check.kind] }} · {{ format(result.check.minute) }} · {{ text.dieName }}: {{ result.roll }}</p>
              <p>{{ text.outcomes[result.outcome] }}</p>
              @if (materials[result.outcome]) { <button type="button" (click)="openResult(result.outcome)">{{ text.openEncounter }}</button> }
            </div>
          }
        </section>
      } @else { <p role="alert">{{ text.invalidState }}</p> }
      @if (error()) { <p role="alert">{{ text.invalidInput }}</p> }
    </section>
  `,
  styleUrl: './expedition-tool.css',
})
export class ExpeditionTool {
  readonly game = inject(CAMPAIGN_GAME);
  readonly text = uiMessages.expedition;
  readonly factions: readonly Faction[] = ['avarice', 'auril'];
  readonly materials = encounterMaterials;
  readonly view = computed(() => { const state = this.game.state(); return state ? readExpeditionView(state) : null; });
  readonly minutes = signal('60');
  readonly unnumbered = signal(true);
  readonly newBuilding = signal(true);
  readonly arrivalDraft = signal<Partial<Record<Faction, string>>>({});
  readonly error = signal(false);
  private readonly rollDraft = signal<{ id: number; value: string } | null>(null);

  format(minute: number) { return `${Math.floor(minute / 60)} ${uiMessages.hour} ${minute % 60} ${uiMessages.minute}`; }
  open(target: keyof typeof expeditionMaterials) { this.game.openMaterial(expeditionMaterials[target]); }
  openResult(outcome: keyof typeof encounterMaterials) { const id = encounterMaterials[outcome]; if (id) this.game.openMaterial({ id }); }
  setMinutes(event: Event) { if (event.target instanceof HTMLInputElement) this.minutes.set(event.target.value); }
  setUnnumbered(event: Event) { if (event.target instanceof HTMLInputElement) this.unnumbered.set(event.target.checked); }
  setNewBuilding(event: Event) { if (event.target instanceof HTMLInputElement) this.newBuilding.set(event.target.checked); }
  setArrival(faction: Faction, event: Event) { const input = event.target; if (input instanceof HTMLInputElement) this.arrivalDraft.update(value => ({ ...value, [faction]: input.value })); }
  setRoll(id: number, event: Event) { if (event.target instanceof HTMLInputElement) this.rollDraft.set({ id, value: event.target.value }); }
  selectedRoll(id: number) { const draft = this.rollDraft(); return draft?.id === id ? draft.value : ''; }
  async run(action: GameAction | null): Promise<boolean> {
    this.error.set(action === null);
    return action !== null && this.game.canOperate() ? this.game.execute(action) : false;
  }
  explore(event: Event) { event.preventDefault(); void this.run(explorationAction(Number(this.minutes()))); }
  search() { void this.run(buildingAction(this.unnumbered(), this.newBuilding())); }
  async confirm(event: Event, faction: Faction) {
    event.preventDefault();
    const now = this.game.state()?.snapshot.timeMinutes ?? 0;
    const raw = this.arrivalDraft()[faction];
    const minute = raw === undefined ? now : raw.trim() === '' ? NaN : Number(raw);
    const action: GameAction | null = Number.isSafeInteger(minute) && minute >= 0 && minute <= now
      ? { kind: 'module', command: { kind: 'confirmArrival', faction, minute } } : null;
    if (await this.run(action)) this.arrivalDraft.update(value => ({ ...value, [faction]: undefined }));
  }
  toggleAuril() { const current = this.view(); if (current) void this.run({ kind: 'module', command: { kind: 'configureExpedition', aurilEnabled: !current.aurilEnabled } }); }
  async resolve(event: Event, id: number) {
    event.preventDefault();
    const current = this.view();
    if (current && await this.run(encounterAction(current, id, Number(this.selectedRoll(id))))) this.rollDraft.set(null);
  }
}
