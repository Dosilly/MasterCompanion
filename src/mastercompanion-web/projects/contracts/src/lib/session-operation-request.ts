import type { SessionOperation } from './session-operation';

export interface SessionOperationRequest {
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly operation: SessionOperation;
}
