export interface CharacterChange {
  readonly id: string;
  readonly name: string;
  readonly kind: 'player' | 'npc';
  readonly inParty: boolean;
  readonly backstoryTitle: string;
  readonly notesTitle: string;
}
