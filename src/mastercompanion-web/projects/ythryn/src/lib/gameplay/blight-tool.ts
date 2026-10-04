import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CAMPAIGN_GAME } from '@mastercompanion/contracts';
import { uiMessages } from '../i18n/messages';
import {
  BlightCharacterView,
  CheckDieSelection,
  readBlightView,
  resolveCheckCommand,
  selectedCheckDie,
} from './blight-view';
import { ActionRequired } from './action-required';

@Component({
  selector: 'mc-ythryn-blight',
  imports: [ActionRequired],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './blight-tool.html',
  styleUrl: './blight-tool.scss',
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
    if (!(select instanceof HTMLSelectElement) || this.game.pending()) {
      return;
    }
    const character = this.characters()?.find((candidate) => candidate.id === id);
    const check = character?.nextCheck;
    if (!check || !check.pending || (check.kind !== 'rest' && check.kind !== 'recovery')) {
      return;
    }
    const die = Number(select.value);
    const updated = new Map(this.selectedDice());
    if (Number.isInteger(die) && die >= 1 && die <= 6) {
      updated.set(id, { characterId: id, kind: check.kind, minute: check.minute, die });
    } else {
      updated.delete(id);
    }
    this.selectedDice.set(updated);
  }

  canResolve(character: BlightCharacterView, success: boolean): boolean {
    return resolveCheckCommand(character, success, this.selectedDie(character)) !== null;
  }

  async resolve(id: string, success: boolean): Promise<void> {
    if (!this.game.canOperate() || this.game.pending()) {
      return;
    }
    const character = this.characters()?.find((candidate) => candidate.id === id);
    if (!character) {
      return;
    }
    const command = resolveCheckCommand(character, success, this.selectedDie(character));
    if (command && (await this.game.execute({ kind: 'module', command }))) {
      this.clearDie(id);
    }
  }

  async heal(id: string): Promise<void> {
    if (!this.game.canOperate() || this.game.pending()) {
      return;
    }
    const character = this.characters()?.find((candidate) => candidate.id === id);
    if (
      character?.status === 'infected' &&
      (await this.game.execute({
        kind: 'module',
        command: { kind: 'healCharacter', characterId: id },
      }))
    ) {
      this.clearDie(id);
    }
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
