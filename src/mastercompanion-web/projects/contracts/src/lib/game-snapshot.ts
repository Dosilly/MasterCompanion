import type { GameCharacter } from './game-character';

export interface GameSnapshot {
  timeMinutes: number;
  party: GameCharacter[];
  restEnds: number[];
  moduleSchemaVersion: number;
  moduleState: unknown;
}
