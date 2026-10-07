import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { MaterialDto, RichDocument } from '@mastercompanion/contracts';
import { isMaterialResponse } from './material-response';

type SavedVersion =
  | { readonly kind: 'idle' | 'loading' | 'failed' }
  | { readonly kind: 'ready'; readonly material: MaterialDto };

export type MaterialErrorCode =
  'saveConflict' | 'saveFailed' | 'clipboardUnavailable' | 'materialDeleted';

export class MaterialSession {
  readonly editing = signal(false);
  readonly status = signal<'saved' | 'waiting' | 'saving' | 'error' | 'conflict'>('saved');
  readonly error = signal<MaterialErrorCode | null>(null);
  readonly dirty = signal(false);
  document: RichDocument;
  private readonly confirmedRevisionState = signal(0);
  readonly confirmedRevision = this.confirmedRevisionState.asReadonly();
  private generation = 0;
  private savedGeneration = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private inFlight?: Promise<boolean>;
  private readonly savedVersionState = signal<SavedVersion>({ kind: 'idle' });
  readonly savedVersion = this.savedVersionState.asReadonly();
  private readonly stop = new Subject<void>();
  private destroyed = false;
  private deletionPaused = false;

  constructor(
    readonly material: MaterialDto,
    private readonly http: HttpClient,
    private readonly onConfirmedSave?: (material: MaterialDto) => void,
  ) {
    this.document = material.document;
    this.confirmedRevisionState.set(material.revision);
  }
  change(document: RichDocument) {
    if (this.destroyed) {
      return;
    }
    this.document = document;
    this.generation++;
    this.dirty.set(true);
    if (this.status() === 'conflict') {
      return;
    }
    this.status.set('waiting');
    clearTimeout(this.timer);
    if (this.deletionPaused) {
      return;
    }
    this.timer = setTimeout(() => void this.flush(), 650);
  }
  flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.destroyed || this.deletionPaused) {
      return Promise.resolve(false);
    }
    if (this.inFlight) {
      return this.inFlight;
    }
    if (this.status() === 'conflict') {
      return Promise.resolve(false);
    }
    this.inFlight = this.savePending().finally(() => (this.inFlight = undefined));
    return this.inFlight;
  }
  async prepareToClose(): Promise<boolean> {
    return (await this.flush()) && !this.dirty();
  }
  async inspectSavedVersion(): Promise<void> {
    if (this.destroyed || this.status() !== 'conflict' || this.savedVersion().kind === 'loading') {
      return;
    }
    this.savedVersionState.set({ kind: 'loading' });
    try {
      const material = await firstValueFrom(
        this.http
          .get<unknown>(`/api/materials/${encodeURIComponent(this.material.id)}`)
          .pipe(takeUntil(this.stop)),
      );
      if (this.destroyed) {
        return;
      }
      if (
        !isMaterialResponse(material) ||
        material.id !== this.material.id ||
        material.revision < this.confirmedRevision()
      ) {
        this.savedVersionState.set({ kind: 'failed' });
        return;
      }
      this.savedVersionState.set({ kind: 'ready', material });
    } catch {
      if (!this.destroyed) {
        this.savedVersionState.set({ kind: 'failed' });
      }
    }
  }
  adoptSavedVersion(): boolean {
    const version = this.savedVersion();
    if (version.kind !== 'ready' || this.status() !== 'conflict') {
      return false;
    }
    clearTimeout(this.timer);
    this.document = version.material.document;
    this.confirmedRevisionState.set(version.material.revision);
    this.savedGeneration = ++this.generation;
    this.dirty.set(false);
    this.status.set('saved');
    this.error.set(null);
    this.savedVersionState.set({ kind: 'idle' });
    this.onConfirmedSave?.(version.material);
    return true;
  }
  reapplyDraft(): Promise<boolean> {
    const version = this.savedVersion();
    if (version.kind !== 'ready' || this.status() !== 'conflict') {
      return Promise.resolve(false);
    }
    this.confirmedRevisionState.set(version.material.revision);
    this.savedVersionState.set({ kind: 'idle' });
    this.status.set('waiting');
    this.error.set(null);
    return this.flush();
  }
  markConflict(): void {
    clearTimeout(this.timer);
    this.status.set('conflict');
    this.error.set('saveConflict');
  }

  markDeleted(): void {
    clearTimeout(this.timer);
    this.deletionPaused = true;
    this.status.set('conflict');
    this.error.set('materialDeleted');
  }

  async pauseForDeletion(): Promise<void> {
    this.deletionPaused = true;
    clearTimeout(this.timer);
    await this.inFlight;
  }

  resumeAfterDeletion(): void {
    this.deletionPaused = false;
    if (!this.destroyed && this.dirty() && this.status() === 'waiting') {
      this.timer = setTimeout(() => void this.flush(), 650);
    }
  }

  destroy(): void {
    this.destroyed = true;
    clearTimeout(this.timer);
    this.stop.next();
    this.stop.complete();
  }
  private async savePending(): Promise<boolean> {
    while (this.savedGeneration !== this.generation) {
      if (this.deletionPaused) {
        this.status.set('waiting');
        return false;
      }
      const generation = this.generation;
      // HttpClient serializes this immutable document snapshot for the request.
      const document = this.document;
      this.status.set('saving');
      this.error.set(null);
      try {
        const response = await firstValueFrom(
          this.http
            .put<{ revision: number }>(`/api/materials/${encodeURIComponent(this.material.id)}`, {
              document,
              expectedRevision: this.confirmedRevision(),
            })
            .pipe(takeUntil(this.stop)),
        );
        if (this.destroyed) {
          return false;
        }
        this.confirmedRevisionState.set(response.revision);
        this.savedGeneration = generation;
        this.onConfirmedSave?.({ ...this.material, document, revision: response.revision });
      } catch (error) {
        if (this.destroyed) {
          return false;
        }
        const missing = error instanceof HttpErrorResponse && error.status === 404;
        const conflict = missing || (error instanceof HttpErrorResponse && error.status === 409);
        this.status.set(conflict ? 'conflict' : 'error');
        this.error.set(missing ? 'materialDeleted' : conflict ? 'saveConflict' : 'saveFailed');
        return false;
      }
    }
    this.dirty.set(false);
    this.status.set('saved');
    return true;
  }
}
