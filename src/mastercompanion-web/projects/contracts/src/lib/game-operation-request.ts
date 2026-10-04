import type { GameAction } from './game-action';

export type GameOperationRequest = GameAction & { requestId: string; expectedRevision: number };
