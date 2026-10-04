import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CAMPAIGN_GAME } from '@mastercompanion/contracts';
import { uiMessages } from '../i18n/messages';
import { readExpeditionView } from './expedition-view';
import {
  forceDeaths,
  forceLossAction,
  forceUnits,
  ForceUnit,
  readRivalForcesView,
} from './rival-forces-view';

@Component({
  selector: 'mc-ythryn-rival-forces',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rival-forces-tool.html',
  styleUrl: './rival-forces-tool.scss',
})
export class RivalForcesTool {
  readonly game = inject(CAMPAIGN_GAME);
  readonly text = uiMessages.forces;
  readonly factions = ['avarice', 'auril'] as const;
  readonly units = forceUnits;
  readonly deaths = forceDeaths;
  private readonly lossDraft = signal<Partial<Record<ForceUnit, string>>>({});
  readonly draft = this.lossDraft.asReadonly();
  readonly invalid = signal<ForceUnit | null>(null);
  readonly view = computed(() => {
    const state = this.game.state();
    return state ? readRivalForcesView(state) : null;
  });
  readonly expedition = computed(() => {
    const state = this.game.state();
    return state ? readExpeditionView(state) : null;
  });

  setLoss(unit: ForceUnit, value: string) {
    this.lossDraft.update((draft) => ({ ...draft, [unit]: value }));
    this.invalid.set(null);
  }

  async recordLoss(event: Event, unit: ForceUnit) {
    event.preventDefault();
    if (!this.game.canOperate()) {
      return;
    }
    const view = this.view();
    const action = view ? forceLossAction(view, unit, Number(this.draft()[unit] ?? '')) : null;
    this.invalid.set(action ? null : unit);
    if (action && (await this.game.execute(action))) {
      this.lossDraft.update((draft) => {
        const next = { ...draft };
        delete next[unit];
        return next;
      });
    }
  }
}
