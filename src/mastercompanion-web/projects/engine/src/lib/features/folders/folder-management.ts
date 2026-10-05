import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import type {
  FolderOperation,
  FolderOperationRequest,
  FolderSnapshot,
} from '@mastercompanion/contracts';
import {
  canMoveFolder,
  canReorderMaterial,
  confirmsFolderOperation,
  isFolderOperation,
  isFolderSnapshot,
} from './folder-rules';

export type FolderError =
  | 'invalid'
  | 'conflict'
  | 'rejected'
  | 'uncertain'
  | 'storageUnavailable'
  | 'invalidRecovery'
  | 'loadFailed';
type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isRequest(value: unknown): value is FolderOperationRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return (
    Object.keys(value).length === 3 &&
    'requestId' in value &&
    typeof value.requestId === 'string' &&
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value.requestId) &&
    value.requestId !== '00000000-0000-0000-0000-000000000000' &&
    'expectedRevision' in value &&
    Number.isSafeInteger(value.expectedRevision) &&
    Number(value.expectedRevision) >= 0 &&
    'operation' in value &&
    isFolderOperation(value.operation)
  );
}

/** Owns confirmed hierarchy and durable receipts independently of document editing. */
export class FolderManagement {
  private readonly confirmed = signal<FolderSnapshot>({
    revision: 0,
    folders: [],
    materialOrder: [],
  });
  readonly snapshot = this.confirmed.asReadonly();
  readonly pending = signal(false);
  readonly error = signal<FolderError | null>(null);
  readonly request = signal<FolderOperationRequest | null>(null);
  readonly invalidRecovery = signal(false);
  readonly locked = computed(
    () => this.pending() || this.request() !== null || this.invalidRecovery(),
  );
  private readonly key: string;
  private readonly stop = new Subject<void>();
  private destroyed = false;
  private initialized = false;

  constructor(
    readonly campaignId: string,
    private readonly http: HttpClient,
    private readonly storage: RecoveryStorage | null,
    private readonly onConfirmed: (snapshot: FolderSnapshot) => void,
  ) {
    this.key = `mastercompanion.folders.pending.${campaignId}`;
    try {
      const stored = storage?.getItem(this.key);
      if (stored) {
        const value: unknown = stored.length <= 8192 ? JSON.parse(stored) : null;
        if (!isRequest(value)) {
          throw new Error('Invalid pending folder operation.');
        }
        this.request.set(value);
        this.error.set('uncertain');
      }
    } catch {
      this.invalidRecovery.set(true);
      this.error.set('invalidRecovery');
    }
  }

  accept(snapshot: FolderSnapshot): boolean {
    if (!isFolderSnapshot(snapshot) || snapshot.revision < this.snapshot().revision) {
      return false;
    }
    const current = this.snapshot();
    if (
      this.initialized &&
      snapshot.revision === current.revision &&
      JSON.stringify(snapshot) !== JSON.stringify(current)
    ) {
      this.error.set('loadFailed');
      return false;
    }
    this.confirmed.set(snapshot);
    this.initialized = true;
    this.onConfirmed(snapshot);
    return true;
  }

  async refresh(): Promise<void> {
    if (this.pending() || this.destroyed) {
      return;
    }
    this.pending.set(true);
    try {
      const value = await firstValueFrom(
        this.http.get<unknown>(this.url).pipe(takeUntil(this.stop)),
      );
      if (!this.destroyed && isFolderSnapshot(value)) {
        const accepted = this.accept(value);
        if (accepted && !this.request() && !this.invalidRecovery()) {
          this.error.set(null);
        }
      } else if (!this.destroyed) {
        this.error.set('loadFailed');
      }
    } catch {
      if (!this.destroyed) {
        this.error.set('loadFailed');
      }
    } finally {
      this.pending.set(false);
    }
  }

  async execute(operation: FolderOperation): Promise<boolean> {
    if (this.destroyed || this.locked()) {
      return false;
    }
    const folders = this.snapshot().folders;
    if (
      !isFolderOperation(operation) ||
      (operation.kind !== 'reorderMaterial' &&
        !folders.some((folder) => folder.id === operation.folderId)) ||
      (operation.kind === 'reorderMaterial' &&
        !canReorderMaterial(
          this.snapshot(),
          operation.materialId,
          operation.folderId,
          operation.beforeId,
        )) ||
      (operation.kind === 'move' &&
        !canMoveFolder(folders, operation.folderId, operation.parentId, operation.beforeId))
    ) {
      this.error.set('invalid');
      return false;
    }
    const request: FolderOperationRequest = {
      requestId: crypto.randomUUID(),
      expectedRevision: this.snapshot().revision,
      operation,
    };
    if (!this.persist(request)) {
      return false;
    }
    this.request.set(request);
    return this.send();
  }

  retry(): Promise<boolean> {
    return this.pending() || !this.request() || this.destroyed
      ? Promise.resolve(false)
      : this.retryAndRefresh();
  }

  private async retryAndRefresh(): Promise<boolean> {
    const confirmed = await this.send();
    if (confirmed) {
      await this.refresh();
    }
    return confirmed;
  }

  discardUnreadable(): void {
    if (!this.pending() && this.invalidRecovery() && this.clear()) {
      this.invalidRecovery.set(false);
      this.error.set(null);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop.next();
    this.stop.complete();
  }

  private get url(): string {
    return `/api/campaigns/${this.campaignId}/folders`;
  }

  private persist(request: FolderOperationRequest): boolean {
    try {
      if (!this.storage) {
        throw new Error('Folder recovery storage is unavailable.');
      }
      this.storage.setItem(this.key, JSON.stringify(request));
      return true;
    } catch {
      this.error.set('storageUnavailable');
      return false;
    }
  }

  private clear(): boolean {
    try {
      if (!this.storage) {
        throw new Error('Folder recovery storage is unavailable.');
      }
      this.storage.removeItem(this.key);
      this.request.set(null);
      return true;
    } catch {
      this.error.set('storageUnavailable');
      return false;
    }
  }

  private async send(): Promise<boolean> {
    const request = this.request();
    if (!request || !this.persist(request)) {
      return false;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      const value = await firstValueFrom(
        this.http.post<unknown>(this.url, request).pipe(takeUntil(this.stop)),
      );
      if (this.destroyed) {
        return false;
      }
      if (
        !isFolderSnapshot(value) ||
        value.revision !== request.expectedRevision + 1 ||
        !confirmsFolderOperation(value, request.operation)
      ) {
        this.error.set('uncertain');
        return false;
      }
      const accepted = this.accept(value);
      if (!accepted && value.revision >= this.snapshot().revision) {
        this.error.set('uncertain');
        return false;
      }
      return this.clear();
    } catch (error) {
      if (this.destroyed) {
        return false;
      }
      if (this.isExpectedRejection(error)) {
        if (this.clear()) {
          this.error.set(error.status === 409 ? 'conflict' : 'rejected');
        }
      } else {
        this.error.set('uncertain');
      }
      return false;
    } finally {
      this.pending.set(false);
    }
  }

  private isExpectedRejection(error: unknown): error is HttpErrorResponse {
    if (
      !(error instanceof HttpErrorResponse) ||
      typeof error.error !== 'object' ||
      error.error === null ||
      !('code' in error.error)
    ) {
      return false;
    }
    const code: unknown = error.error.code;
    return (
      typeof code === 'string' &&
      [
        'invalid_folder_operation',
        'folder_not_found',
        'folder_parent_not_found',
        'folder_target_not_found',
        'folder_cycle',
        'material_not_found',
        'material_folder_conflict',
        'material_order_target_invalid',
        'folder_revision_conflict',
        'folder_request_conflict',
        'folder_revision_limit',
        'campaign_not_found',
        'folder_json_required',
        'folder_request_too_large',
      ].includes(code) &&
      [400, 404, 409, 413, 415].includes(error.status)
    );
  }
}
