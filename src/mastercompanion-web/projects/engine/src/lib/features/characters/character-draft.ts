import { signal } from '@angular/core';
import type { CharacterChange, CharacterProfile } from '@mastercompanion/contracts';

export class CharacterDraft {
  readonly value = signal<{
    id: string;
    name: string;
    kind: 'player' | 'npc';
    inParty: boolean;
  } | null>(null);
  readonly dirty = signal(false);
  readonly revision = signal(0);
  private membershipSource: 'default' | 'explicit' = 'default';

  begin(revision: number, character?: CharacterProfile): void {
    this.membershipSource = character ? 'explicit' : 'default';
    this.revision.set(revision);
    this.value.set(
      character
        ? {
            id: character.id,
            name: character.name,
            kind: character.kind,
            inParty: character.inParty,
          }
        : { id: crypto.randomUUID(), name: '', kind: 'player', inParty: true },
    );
    this.dirty.set(false);
  }

  name(name: string): void {
    this.value.update((value) => (value ? { ...value, name } : null));
    this.dirty.set(true);
  }

  kind(kind: 'player' | 'npc'): void {
    if (this.value()?.kind === kind) {
      return;
    }
    this.value.update((value) =>
      value
        ? {
            ...value,
            kind,
            inParty: this.membershipSource === 'default' ? kind === 'player' : value.inParty,
          }
        : null,
    );
    this.dirty.set(true);
  }

  membership(inParty: boolean): void {
    this.membershipSource = 'explicit';
    this.value.update((value) => (value ? { ...value, inParty } : null));
    this.dirty.set(true);
  }

  change(backstoryLabel: string, notesLabel: string): CharacterChange | null {
    const value = this.value();
    const name = value?.name.trim() ?? '';
    if (!value || !name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
      return null;
    }
    return {
      ...value,
      name,
      backstoryTitle: `${name} · ${backstoryLabel}`,
      notesTitle: `${name} · ${notesLabel}`,
    };
  }

  finish(): void {
    this.value.set(null);
    this.dirty.set(false);
  }
}
