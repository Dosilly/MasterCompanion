import type { GameCharacter } from './game-character';

export type GameAction =
  | { kind: 'configureParty' | 'updateParty'; party: GameCharacter[] }
  | { kind: 'advanceTime'; minutes: number }
  | { kind: 'shortRest' | 'longRest' | 'undo' }
  | { kind: 'module'; command: unknown; minutes?: number };
