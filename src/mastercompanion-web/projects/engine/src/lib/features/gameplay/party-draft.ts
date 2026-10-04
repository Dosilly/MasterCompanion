import { signal } from '@angular/core';
import type { GameCharacter, GameStateDto } from '@mastercompanion/contracts';

export class PartyDraft {
  readonly members = signal<GameCharacter[]>([]);
  readonly editing = signal(false);
  readonly dirty = signal(false);
  readonly baselineRevision = signal<number | null>(null);

  begin(state: GameStateDto): void {
    this.members.set(state.snapshot.party.map((member) => ({ ...member })));
    if (state.revision === 0 && !state.snapshot.party.length) {
      this.members.set([{ id: crypto.randomUUID(), name: '' }]);
    }
    this.baselineRevision.set(state.revision);
    this.dirty.set(false);
    this.editing.set(true);
  }

  add(): void {
    if (this.members().length >= 20) {
      return;
    }
    this.members.update((members) => [...members, { id: crypto.randomUUID(), name: '' }]);
    this.dirty.set(true);
  }

  remove(id: string): void {
    if (!this.members().some((member) => member.id === id)) {
      return;
    }
    this.members.update((members) => members.filter((member) => member.id !== id));
    this.dirty.set(true);
  }

  rename(id: string, name: string): void {
    if (!this.members().some((member) => member.id === id && member.name !== name)) {
      return;
    }
    this.members.update((members) =>
      members.map((member) => (member.id === id ? { ...member, name } : member)),
    );
    this.dirty.set(true);
  }

  isStale(revision: number): boolean {
    return this.editing() && this.baselineRevision() !== revision;
  }

  acceptRevision(revision: number): void {
    this.baselineRevision.set(revision);
  }

  validatedMembers(initial: boolean): GameCharacter[] | null {
    const members = this.members().map((member) => ({ ...member, name: member.name.trim() }));
    return (initial && members.length === 0) ||
      members.length > 20 ||
      members.some(
        (member) =>
          !member.name || member.name.length > 100 || /[\u0000-\u001f\u007f]/.test(member.name),
      )
      ? null
      : members;
  }

  finish(): void {
    this.editing.set(false);
    this.dirty.set(false);
    this.baselineRevision.set(null);
  }
}
