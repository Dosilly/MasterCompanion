import type { SessionRecord } from '@mastercompanion/contracts';

export type SessionSection = 'preparation' | 'notes' | 'summary';

export function initialSessionSection(status: SessionRecord['status']): SessionSection {
  switch (status) {
    case 'planned':
      return 'preparation';
    case 'active':
      return 'notes';
    case 'completed':
      return 'summary';
  }
}
