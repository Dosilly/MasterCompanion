import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CAMPAIGN_GAME } from '@mastercompanion/contracts';
import { uiMessages } from '../i18n/messages';
import { BlightCharacterView, CheckDieSelection, readBlightView, resolveCheckCommand, selectedCheckDie } from './blight-view';
import { ActionRequired } from './action-required';

@Component({
  selector: 'mc-ythryn-blight',
  imports: [ActionRequired],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="blight-tool" aria-labelledby="blight-title">
      <h2 id="blight-title">{{ text.toolTitle }}</h2>
      <p class="description">{{ text.toolDescription }}</p>
      <p><a href="#material/sac11d9beb0d8/sa401a28def19" (click)="openRules($event)">{{ text.rulesLink }}</a></p>
      <p class="description">{{ text.checkScheduleHint }}</p>
      @if (!game.state()) {
        <p role="status">{{ text.loading }}</p>
      } @else if (game.state()?.snapshot?.party?.length === 0) {
        <p>{{ text.configureParty }}</p>
      } @else if (characters(); as party) {
        <div class="characters">
          @for (character of party; track character.id) {
            <section class="character" [class.needs-action]="character.nextCheck?.pending" [id]="'blight-character-' + character.id" [attr.aria-labelledby]="'blight-name-' + character.id">
              <h3 [id]="'blight-name-' + character.id">{{ character.name }}</h3>
              <dl>
                <div><dt>{{ text.status }}</dt><dd>{{ text.statuses[character.status] }}</dd></div>
                <div><dt>{{ text.dc }}</dt><dd>{{ character.dc }}</dd></div>
                <div><dt>{{ text.failures }}</dt><dd>{{ character.failures }}</dd></div>
              </dl>
              @if (character.nextCheck; as check) {
                <p class="check" [class.is-pending]="check.pending">
                  <strong>{{ text.checks[check.kind] }}</strong>
                  @if (check.pending) { <mc-action-required>{{ text.pending }}</mc-action-required> }
                  @else { <span>{{ text.timeUntilCheck }}: {{ formatMinute(check.remainingMinutes) }} · {{ text.upcoming }}</span> }
                </p>
                @if (check.pending) {
                  <fieldset [disabled]="!game.canOperate() || game.pending()">
                    <legend>{{ text.checks[check.kind] }} — {{ character.name }}</legend>
                    @if (check.kind === 'rest' || check.kind === 'recovery') {
                      <label [for]="'blight-die-' + character.id">{{ text.dieResult }}</label>
                      <select [id]="'blight-die-' + character.id" [value]="selectedDie(character) ?? ''"
                        (change)="selectDie(character.id, $event)">
                        <option value="">{{ text.chooseDie }}</option>
                        @for (die of dice; track die) { <option [value]="die">{{ die }}</option> }
                      </select>
                    }
                    <div class="outcomes">
                      <button type="button" [disabled]="!canResolve(character, true)"
                        [attr.aria-label]="text.success + ' — ' + character.name" (click)="resolve(character.id, true)">{{ text.success }}</button>
                      <button type="button" [attr.aria-label]="text.failure + ' — ' + character.name"
                        (click)="resolve(character.id, false)">{{ text.failure }}</button>
                    </div>
                  </fieldset>
                }
              } @else { <p class="no-check">{{ text.noCheck }}</p> }
              @if (character.status === 'infected') {
                <div class="healing">
                  <button type="button" [disabled]="!game.canOperate() || game.pending()"
                    [attr.aria-label]="text.heal + ' — ' + character.name" (click)="heal(character.id)">{{ text.heal }}</button>
                  <p>{{ text.healingHint }}</p>
                </div>
              }
            </section>
          }
        </div>
      } @else { <p class="projection-error" role="alert">{{ text.invalidState }}</p> }
    </section>
  `,
  styleUrl: './blight-tool.css',
})
export class BlightTool {
  readonly game = inject(CAMPAIGN_GAME);
  readonly text = uiMessages;
  readonly dice = [1, 2, 3, 4, 5, 6];
  readonly characters = computed(() => {
    const state = this.game.state();
    return state ? readBlightView(state) : null;
  });
  private readonly selectedDice = signal<ReadonlyMap<string, CheckDieSelection>>(new Map());

  openRules(event: Event): void {
    event.preventDefault();
    this.game.openMaterial({ id: 'sac11d9beb0d8', anchor: 'sa401a28def19' });
  }

  selectedDie(character: BlightCharacterView): number | null {
    return selectedCheckDie(character, this.selectedDice().get(character.id));
  }

  selectDie(id: string, event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || this.game.pending()) return;
    const character = this.characters()?.find(candidate => candidate.id === id);
    const check = character?.nextCheck;
    if (!check || !check.pending || (check.kind !== 'rest' && check.kind !== 'recovery')) return;
    const die = Number(select.value);
    const updated = new Map(this.selectedDice());
    if (Number.isInteger(die) && die >= 1 && die <= 6) {
      updated.set(id, { characterId: id, kind: check.kind, minute: check.minute, die });
    }
    else updated.delete(id);
    this.selectedDice.set(updated);
  }

  canResolve(character: BlightCharacterView, success: boolean): boolean {
    return resolveCheckCommand(character, success, this.selectedDie(character)) !== null;
  }

  async resolve(id: string, success: boolean): Promise<void> {
    if (!this.game.canOperate() || this.game.pending()) return;
    const character = this.characters()?.find(candidate => candidate.id === id);
    if (!character) return;
    const command = resolveCheckCommand(character, success, this.selectedDie(character));
    if (command && await this.game.execute({ kind: 'module', command })) this.clearDie(id);
  }

  async heal(id: string): Promise<void> {
    if (!this.game.canOperate() || this.game.pending()) return;
    const character = this.characters()?.find(candidate => candidate.id === id);
    if (character?.status === 'infected' && await this.game.execute({
      kind: 'module', command: { kind: 'healCharacter', characterId: id },
    })) this.clearDie(id);
  }

  formatMinute(minute: number): string {
    return `${Math.floor(minute / 60)} ${this.text.hour} ${minute % 60} ${this.text.minute}`;
  }

  private clearDie(id: string): void {
    const updated = new Map(this.selectedDice());
    updated.delete(id);
    this.selectedDice.set(updated);
  }
}
