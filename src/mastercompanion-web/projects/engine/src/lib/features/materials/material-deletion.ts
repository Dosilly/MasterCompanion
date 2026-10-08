import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import type { MaterialDeletionPreview, MaterialDeletionRequest } from '@mastercompanion/contracts';
import { MaterialSession } from './material-session';

export type DeletionError =
  'loadFailed' | 'failed' | 'conflict' | 'referencesChanged' | 'protected' | 'notFound';

/** Owns confirmation snapshot, paused autosave, and exact retry of an uncertain write. */
export class MaterialDeletion {
  readonly preview = signal<MaterialDeletionPreview | null>(null);
  readonly pending = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<DeletionError | null>(null);
  readonly retryAvailable = signal(false);
  readonly dirty = signal(false);
  readonly recoveryTarget = signal('');
  private session: MaterialSession | null = null;
  private request: MaterialDeletionRequest | null = null;
  private target = '';
  private readonly stop = new Subject<void>();
  private readonly stopReads = new Subject<void>();
  private generation = 0;
  private destroyed = false;

  constructor(
    readonly campaignId: string,
    private readonly http: HttpClient,
  ) {}

  lockedFor(id: string): boolean {
    return this.pending() || (this.request !== null && this.target !== id);
  }

  async inspect(id: string, session: MaterialSession | null): Promise<void> {
    if (this.pending() || (this.request && this.target !== id)) {
      return;
    }
    const generation = ++this.generation;
    this.target = id;
    this.session = session;
    this.error.set(null);
    this.pending.set(true);
    if (!this.request) {
      this.preview.set(null);
    }
    try {
      await session?.pauseForDeletion();
      if (this.destroyed || generation !== this.generation) {
        return;
      }
      this.dirty.set(session?.dirty() ?? false);
      if (this.request) {
        this.retryAvailable.set(true);
        return;
      }
      this.preview.set(null);
      const value = await firstValueFrom(
        this.http.get<unknown>(this.url()).pipe(takeUntil(this.stop), takeUntil(this.stopReads)),
      );
      if (this.destroyed || generation !== this.generation) {
        return;
      }
      if (!isDeletionPreview(value) || value.id !== id) {
        throw new Error('The material deletion preview is invalid.');
      }
      if (session && value.revision !== session.confirmedRevision()) {
        session.markConflict();
        this.error.set('conflict');
        return;
      }
      this.preview.set(value);
    } catch (error) {
      if (!this.destroyed && generation === this.generation) {
        this.error.set(
          error instanceof HttpErrorResponse && error.status === 404 ? 'notFound' : 'loadFailed',
        );
      }
    } finally {
      if (generation === this.generation) {
        this.pending.set(false);
      }
    }
  }

  async confirm(discardAcknowledged: boolean): Promise<string | null> {
    const preview = this.preview();
    if (
      this.pending() ||
      !preview ||
      preview.owningSessions.length ||
      preview.owningCharacters.length ||
      (this.dirty() && !discardAcknowledged)
    ) {
      return null;
    }
    this.request ??= {
      requestId: crypto.randomUUID(),
      expectedRevision: preview.revision,
      referencesToken: preview.referencesToken,
    };
    this.submitting.set(true);
    this.recoveryTarget.set(this.target);
    this.pending.set(true);
    this.error.set(null);
    try {
      const value = await firstValueFrom(
        this.http.post<unknown>(this.url(), this.request).pipe(takeUntil(this.stop)),
      );
      if (
        typeof value !== 'object' ||
        value === null ||
        !('id' in value) ||
        value.id !== this.target
      ) {
        throw new Error('The material deletion confirmation is invalid.');
      }
      this.request = null;
      this.recoveryTarget.set('');
      this.retryAvailable.set(false);
      return this.target;
    } catch (error) {
      if (!this.destroyed) {
        const details: unknown = error instanceof HttpErrorResponse ? error.error : null;
        const code: unknown =
          typeof details === 'object' && details !== null && 'code' in details
            ? details.code
            : null;
        if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
          this.request = null;
          this.recoveryTarget.set('');
          this.retryAvailable.set(false);
          this.error.set(
            code === 'material_session_document' || code === 'material_character_document'
              ? 'protected'
              : code === 'material_references_changed'
                ? 'referencesChanged'
                : error.status === 404
                  ? 'notFound'
                  : 'conflict',
          );
          if (error.status === 404) {
            this.session?.markDeleted();
          } else if (code === 'material_revision_conflict') {
            this.session?.markConflict();
          }
          this.preview.set(null);
        } else {
          this.retryAvailable.set(true);
          this.error.set('failed');
        }
      }
      return null;
    } finally {
      this.submitting.set(false);
      this.pending.set(false);
    }
  }

  cancel(): void {
    if (!this.submitting()) {
      this.generation++;
      this.stopReads.next();
      this.pending.set(false);
      this.session?.resumeAfterDeletion();
      this.session = null;
      if (!this.request) {
        this.preview.set(null);
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.generation++;
    this.stopReads.next();
    this.stopReads.complete();
    this.stop.next();
    this.stop.complete();
  }

  private url(): string {
    return `/api/campaigns/${encodeURIComponent(this.campaignId)}/materials/${encodeURIComponent(this.target)}/deletion`;
  }
}

export function isDeletionPreview(value: unknown): value is MaterialDeletionPreview {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('title' in value) ||
    typeof value.title !== 'string' ||
    !('revision' in value) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    !('referencesToken' in value) ||
    typeof value.referencesToken !== 'string' ||
    !/^[A-Fa-f0-9]{64}$/.test(value.referencesToken)
  ) {
    return false;
  }
  return (
    'documentLinks' in value &&
    stringArray(value.documentLinks) &&
    'mapMarkers' in value &&
    stringArray(value.mapMarkers) &&
    'pinnedSessions' in value &&
    stringArray(value.pinnedSessions) &&
    'owningSessions' in value &&
    stringArray(value.owningSessions) &&
    'owningCharacters' in value &&
    stringArray(value.owningCharacters)
  );
}

function stringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}
