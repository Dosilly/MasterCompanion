import type { SessionRecord } from '@mastercompanion/contracts';

export interface SessionTextDraft {
  readonly original: SessionRecord;
  readonly title: string;
  readonly summary: string;
  readonly followUp: string;
}
