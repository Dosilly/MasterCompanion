import type { FolderOperation } from './folder-operation';

export interface FolderOperationRequest {
  requestId: string;
  expectedRevision: number;
  operation: FolderOperation;
}
