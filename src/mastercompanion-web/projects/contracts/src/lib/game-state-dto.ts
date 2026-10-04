import type { GameSnapshot } from './game-snapshot';
import type { GameOperationSummary } from './game-operation-summary';

export interface GameStateDto {
  revision: number;
  snapshot: GameSnapshot;
  moduleView: unknown;
  lastOperation: GameOperationSummary | null;
}
