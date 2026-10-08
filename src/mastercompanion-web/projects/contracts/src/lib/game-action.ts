import type { GameCharacter } from './game-character';
import type { CharacterChange } from './character-change';

export type GameAction =
  | { kind: 'configureParty' | 'updateParty'; party: GameCharacter[] }
  | { kind: 'updateCharacter'; character: CharacterChange }
  | { kind: 'advanceTime'; minutes: number }
  | { kind: 'shortRest' | 'longRest' | 'undo' }
  | { kind: 'module'; command: unknown; minutes?: number };
