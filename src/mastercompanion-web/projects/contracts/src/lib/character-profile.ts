export interface CharacterProfile {
  readonly id: string;
  readonly name: string;
  readonly kind: 'player' | 'npc';
  readonly inParty: boolean;
  readonly backstoryMaterialId: string;
  readonly notesMaterialId: string;
}
