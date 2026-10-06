import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CAMPAIGN_GAME } from '@mastercompanion/contracts';
import { uiMessages } from '../i18n/messages';
import { ActionRequired } from './action-required';
import { BlightTool } from './blight-tool';
import { readBlightView } from './blight-view';
import { ExpeditionTool } from './expedition-tool';
import { RivalForcesTool } from './rival-forces-tool';
import { readExpeditionView } from './expedition-view';

@Component({
  selector: 'mc-ythryn-tools',
  imports: [ActionRequired, BlightTool, ExpeditionTool, RivalForcesTool],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ythryn-tools.html',
  styleUrl: './ythryn-tools.scss',
})
export class YthrynTools {
  readonly text = uiMessages;
  private readonly game = inject(CAMPAIGN_GAME);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly expanded = signal<ReadonlySet<string>>(new Set(['expedition']));

  rememberSection(id: string, event: Event): void {
    if (!(event.target instanceof HTMLDetailsElement)) {
      return;
    }
    const open = event.target.open;
    this.expanded.update((sections) => {
      const next = new Set(sections);
      if (open) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  revealAction(target: string): void {
    const element = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[id]')).find(
      (candidate) => candidate.id === target,
    );
    if (element) {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) {
          parent.open = true;
        }
      }
      element.scrollIntoView({ block: 'start' });
      element.focus({ preventScroll: true });
    }
  }
  sectionCount(section: string): number {
    return this.pendingActions().filter((action) =>
      section === 'blight'
        ? action.target.startsWith('blight-character-')
        : !action.target.startsWith('blight-character-'),
    ).length;
  }
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
