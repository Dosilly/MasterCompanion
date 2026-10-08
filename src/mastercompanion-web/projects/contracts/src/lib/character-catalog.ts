import type { CharacterProfile } from './character-profile';

export interface CharacterCatalog {
  readonly revision: number;
  readonly characters: readonly CharacterProfile[];
}
