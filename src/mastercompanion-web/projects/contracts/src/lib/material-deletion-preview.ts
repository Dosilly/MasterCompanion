export interface MaterialDeletionPreview {
  readonly id: string;
  readonly title: string;
  readonly revision: number;
  readonly referencesToken: string;
  readonly documentLinks: readonly string[];
  readonly mapMarkers: readonly string[];
  readonly pinnedSessions: readonly string[];
  readonly owningSessions: readonly string[];
}
