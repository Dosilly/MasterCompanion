import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { getSchema } from '@tiptap/core';
import type { CreateMaterialRequest, MaterialDto, RichDocument } from '@mastercompanion/contracts';
import { documentExtensions } from '../../editor-schema.mjs';

export type CreationError =
  | 'invalidTitle'
  | 'invalidFolder'
  | 'campaignMissing'
  | 'rejected'
  | 'identityConflict'
  | 'uncertain'
  | 'storageUnavailable'
  | 'invalidPending'
  | 'invalidResponse';
export type CreationStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function validTitle(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 300 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(value)
  );
}
function validFolder(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length > 0 && value.length <= 80);
}
export function isCreationRequest(value: unknown): value is CreateMaterialRequest {
  return (
    record(value) &&
    Object.keys(value).length === 3 &&
    typeof value['id'] === 'string' &&
    uuid.test(value['id']) &&
    value['id'] !== '00000000-0000-0000-0000-000000000000' &&
    validTitle(value['title']) &&
    validFolder(value['folderId'])
  );
}
function richDocument(value: unknown, depth = 0): value is RichDocument {
  if (depth > 64 || !record(value) || typeof value['type'] !== 'string') {
    return false;
  }
  return (
    (value['attrs'] === undefined || record(value['attrs'])) &&
    (value['text'] === undefined || typeof value['text'] === 'string') &&
    (value['content'] === undefined ||
      (Array.isArray(value['content']) &&
        value['content'].every((node) => richDocument(node, depth + 1)))) &&
    (value['marks'] === undefined ||
      (Array.isArray(value['marks']) &&
        value['marks'].every(
          (mark) =>
            record(mark) &&
            typeof mark['type'] === 'string' &&
            (mark['attrs'] === undefined || record(mark['attrs'])),
        )))
  );
}
function creationResponse(value: unknown, request: CreateMaterialRequest): value is MaterialDto {
  if (
    !record(value) ||
    value['id'] !== `note-${request.id}` ||
    value['title'] !== request.title ||
    value['folderId'] !== request.folderId ||
    typeof value['group'] !== 'string' ||
    value['documentSchemaVersion'] !== 1 ||
    typeof value['revision'] !== 'number' ||
    !Number.isSafeInteger(value['revision']) ||
    value['revision'] < 1 ||
    !richDocument(value['document']) ||
    value['document'].type !== 'doc'
  ) {
    return false;
  }
  try {
    getSchema(documentExtensions()).nodeFromJSON(value['document']).check();
    return true;
  } catch {
    return false;
  }
}

export class MaterialCreation {
  readonly title = signal('');
  readonly folderId = signal<string | null>(null);
  readonly pending = signal(false);
  readonly error = signal<CreationError | null>(null);
  readonly request = signal<CreateMaterialRequest | null>(null);
  readonly invalidPending = signal(false);
  readonly hasRecovery = computed(() => this.request() !== null || this.invalidPending());
  readonly locked = computed(() => this.pending() || this.hasRecovery());
  private readonly key: string;
  private readonly stop = new Subject<void>();
  private destroyed = false;

  constructor(
    readonly campaignId: string,
    private readonly http: HttpClient,
    private readonly storage: CreationStorage | null,
  ) {
    this.key = `mastercompanion.material.pending.${campaignId}`;
    try {
      const stored = storage?.getItem(this.key);
      if (stored) {
        if (stored.length > 8_192) {
          throw new Error('Pending material creation is too large.');
        }
        const value: unknown = JSON.parse(stored);
        if (!isCreationRequest(value)) {
          throw new Error('Invalid pending material creation.');
        }
        this.request.set(value);
        this.title.set(value.title);
        this.folderId.set(value.folderId);
        this.error.set('uncertain');
      }
    } catch {
      this.invalidPending.set(true);
      this.error.set('invalidPending');
    }
  }

  setTitle(title: string) {
    if (!this.locked()) {
      this.title.set(title);
      this.error.set(null);
    }
  }
  setFolder(folderId: string | null) {
    if (!this.locked()) {
      this.folderId.set(folderId);
      this.error.set(null);
    }
  }
  setDefaultFolder(folderId: string | null) {
    if (!this.locked() && !this.title()) {
      this.folderId.set(folderId);
    }
  }

  async create(folders: readonly string[]): Promise<MaterialDto | null> {
    if (this.destroyed || this.locked()) {
      return null;
    }
    const title = this.title().trim();
    if (!validTitle(title)) {
      this.error.set('invalidTitle');
      return null;
    }
    const folderId = this.folderId();
    if (!validFolder(folderId) || (folderId !== null && !folders.includes(folderId))) {
      this.error.set('invalidFolder');
      return null;
    }
    let request: CreateMaterialRequest;
    try {
      request = { id: crypto.randomUUID().toLowerCase(), title, folderId };
    } catch {
      this.error.set('rejected');
      return null;
    }
    // Do not send before durable recovery information exists in this browser session.
    if (!this.store(request)) {
      return null;
    }
    this.request.set(request);
    this.title.set(title);
    return this.send();
  }
  async retry(): Promise<MaterialDto | null> {
    if (this.destroyed || this.pending() || this.invalidPending() || !this.request()) {
      return null;
    }
    return this.send();
  }
  discardUnreadable(): boolean {
    if (this.destroyed || this.pending() || !this.invalidPending()) {
      return false;
    }
    if (!this.clearRequest()) {
      return false;
    }
    this.invalidPending.set(false);
    this.error.set(null);
    return true;
  }
  destroy() {
    this.destroyed = true;
    this.stop.next();
    this.stop.complete();
  }

  private store(request: CreateMaterialRequest): boolean {
    try {
      if (!this.storage) {
        throw new Error('Material recovery storage is unavailable.');
      }
      this.storage.setItem(this.key, JSON.stringify(request));
      return true;
    } catch {
      this.error.set('storageUnavailable');
      return false;
    }
  }
  private clearRequest(): boolean {
    try {
      if (!this.storage) {
        throw new Error('Material recovery storage is unavailable.');
      }
      this.storage.removeItem(this.key);
      this.request.set(null);
      return true;
    } catch {
      this.error.set('storageUnavailable');
      return false;
    }
  }
  private async send(): Promise<MaterialDto | null> {
    const request = this.request();
    if (!request) {
      return null;
    }
    this.pending.set(true);
    this.error.set(null);
    try {
      if (!this.store(request)) {
        return null;
      }
      let value: unknown;
      try {
        value = await firstValueFrom(
          this.http
            .post<unknown>(`/api/campaigns/${this.campaignId}/materials`, request)
            .pipe(takeUntil(this.stop)),
        );
      } catch (error) {
        if (this.destroyed) {
          return null;
        }
        const code: unknown =
          error instanceof HttpErrorResponse && record(error.error)
            ? error.error['code']
            : undefined;
        const rejected =
          error instanceof HttpErrorResponse &&
          ((error.status === 400 &&
            ['invalid_material_creation', 'material_folder_not_found'].includes(String(code))) ||
            (error.status === 404 && code === 'campaign_not_found') ||
            (error.status === 409 && code === 'material_creation_conflict') ||
            (error.status === 413 && code === 'material_request_too_large') ||
            (error.status === 415 && code === 'material_json_required'));
        if (rejected) {
          if (!this.clearRequest()) {
            return null;
          }
          this.error.set(
            code === 'material_folder_not_found'
              ? 'invalidFolder'
              : code === 'campaign_not_found'
                ? 'campaignMissing'
                : code === 'material_creation_conflict'
                  ? 'identityConflict'
                  : 'rejected',
          );
        } else {
          this.error.set('uncertain');
        }
        return null;
      }
      if (this.destroyed) {
        return null;
      }
      if (!creationResponse(value, request)) {
        this.error.set('invalidResponse');
        return null;
      }
      if (!this.clearRequest()) {
        return null;
      }
      this.title.set('');
      this.folderId.set(null);
      return value;
    } finally {
      this.pending.set(false);
    }
  }
}
