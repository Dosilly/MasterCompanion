import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MaterialDto, RichDocument } from '@mastercompanion/contracts';

export type MaterialErrorCode = 'saveConflict' | 'saveFailed' | 'clipboardUnavailable';

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

  constructor(
    readonly material: MaterialDto,
    private readonly http: HttpClient,
  ) {
    this.document = material.document;
    this.confirmedRevisionState.set(material.revision);
  }
  change(document: RichDocument) {
    this.document = document;
    this.generation++;
    this.dirty.set(true);
    if (this.status() === 'conflict') {
      return;
    }
    this.status.set('waiting');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 650);
  }
  flush(): Promise<boolean> {
    clearTimeout(this.timer);
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
  private async savePending(): Promise<boolean> {
    while (this.savedGeneration !== this.generation) {
      const generation = this.generation;
      // HttpClient serializes this immutable document snapshot for the request.
      const document = this.document;
      this.status.set('saving');
      this.error.set(null);
      try {
        const response = await firstValueFrom(
          this.http.put<{ revision: number }>(`/api/materials/${this.material.id}`, {
            document,
            expectedRevision: this.confirmedRevision(),
          }),
        );
        this.confirmedRevisionState.set(response.revision);
        this.savedGeneration = generation;
      } catch (error) {
        const conflict = error instanceof HttpErrorResponse && error.status === 409;
        this.status.set(conflict ? 'conflict' : 'error');
        this.error.set(conflict ? 'saveConflict' : 'saveFailed');
        return false;
      }
    }
    this.dirty.set(false);
    this.status.set('saved');
    return true;
  }
}
