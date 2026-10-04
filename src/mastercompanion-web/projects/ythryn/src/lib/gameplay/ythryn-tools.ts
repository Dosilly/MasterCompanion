import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CAMPAIGN_GAME } from '@mastercompanion/contracts';
import { uiMessages } from '../i18n/messages';
import { ActionRequired } from './action-required';
import { BlightTool } from './blight-tool';
import { readBlightView } from './blight-view';
import { ExpeditionTool } from './expedition-tool';
import { readExpeditionView } from './expedition-view';

@Component({
  selector: 'mc-ythryn-tools',
  imports: [ActionRequired, BlightTool, ExpeditionTool],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pendingActions().length > 0) {
      <nav class="pending-actions" [attr.aria-label]="text.actionRequired">
        <p role="status">
          <mc-action-required
            >{{ text.actionRequired }}: {{ pendingActions().length }}</mc-action-required
          >
        </p>
        <ul>
          @for (action of pendingActions(); track action.target) {
            <li>
              <a [href]="'#' + action.target">{{ action.label }}</a>
            </li>
          }
        </ul>
      </nav>
    }
    <mc-ythryn-expedition /><mc-ythryn-blight />
  `,
  styles: `
    .pending-actions {
      margin-bottom: 1.5rem;
      padding: 1rem;
      border: 1px solid var(--error-line);
      border-left-width: 4px;
      border-radius: 0.6rem;
      background: var(--error-bg);
    }
    p {
      margin: 0;
    }
    ul {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;
      margin-bottom: 0;
      padding-left: 1.5rem;
    }
    a {
      color: var(--ink);
      text-underline-offset: 3px;
    }
    a:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
    }
  `,
})
export class YthrynTools {
  readonly text = uiMessages;
  private readonly game = inject(CAMPAIGN_GAME);
  readonly pendingActions = computed(() => {
    const state = this.game.state();
    const expedition = state ? readExpeditionView(state) : null;
    const actions: { target: string; label: string }[] = [];
    if (expedition) {
      if (expedition.pending.length > 0) {
        actions.push({
          target: 'encounter-queue',
          label: `${this.text.expedition.queueTitle}: ${expedition.pending.length}`,
        });
      }
      for (const faction of ['avarice', 'auril'] as const) {
        if (expedition[faction].pending) {
          actions.push({
            target: `${faction}-arrival`,
            label: this.text.expedition.factions[faction],
          });
        }
      }
    }
    const characters = state && state.snapshot.party.length > 0 ? readBlightView(state) : null;
    for (const character of characters ?? []) {
      if (character.nextCheck?.pending) {
        actions.push({
          target: `blight-character-${character.id}`,
          label: `${character.name} · ${this.text.checks[character.nextCheck.kind]}`,
        });
      }
    }
    return actions;
  });
}
