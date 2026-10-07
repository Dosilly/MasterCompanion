export interface MaterialDeletionRequest {
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly referencesToken: string;
}
