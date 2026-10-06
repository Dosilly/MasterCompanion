export type SessionOperation =
  | {
      kind: 'create';
      sessionId: string;
      title: string;
      preparationTitle: string;
      notesTitle: string;
    }
  | { kind: 'update'; sessionId: string; title: string; summary: string; followUp: string }
  | { kind: 'start' | 'complete' | 'delete'; sessionId: string }
  | { kind: 'pin' | 'unpin'; sessionId: string; materialId: string };
