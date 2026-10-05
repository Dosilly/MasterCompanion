import type { SessionRecord } from './session-record';

export interface SessionSnapshot {
  readonly revision: number;
  readonly sessions: readonly SessionRecord[];
}
