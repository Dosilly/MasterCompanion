import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import type {
  SessionOperation,
  SessionOperationRequest,
  SessionSnapshot,
} from '@mastercompanion/contracts';
import {
  confirmsSessionOperation,
  isSessionOperation,
  isSessionRequest,
  isSessionSnapshot,
} from './session-wire';

export type MeetingError =
  'conflict' | 'rejected' | 'uncertain' | 'storageUnavailable' | 'invalidRecovery' | 'loadFailed';
type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Owns confirmed meeting records and exact retries independently of document saves. */
export class MeetingRecords {
  private readonly confirmed = signal<SessionSnapshot>({ revision: 0, sessions: [] });
  readonly snapshot = this.confirmed.asReadonly();
  private readonly pendingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<MeetingError | null>(null);
  private readonly requestState = signal<SessionOperationRequest | null>(null);
  private readonly invalidRecoveryState = signal(false);
  readonly pending = this.pendingState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly request = this.requestState.asReadonly();
  readonly invalidRecovery = this.invalidRecoveryState.asReadonly();
  readonly locked = computed(
    () => !this.loaded() || this.pending() || this.request() !== null || this.invalidRecovery(),
  );
  readonly activeSession = computed(() =>
    this.snapshot().sessions.find((item) => item.status === 'active'),
  );
  private readonly key: string;
  private readonly stop = new Subject<void>();
  private destroyed = false;

  constructor(
    readonly campaignId: string,
    private readonly http: HttpClient,
    private readonly storage: RecoveryStorage | null,
  ) {
    this.key = `mastercompanion.sessions.pending.${campaignId}`;
    try {
      const stored = storage?.getItem(this.key);
      if (stored) {
        const value: unknown = stored.length <= 262_144 ? JSON.parse(stored) : null;
        if (!isSessionRequest(value)) {
          throw new Error('Invalid pending session operation.');
        }
        this.requestState.set(value);
        this.errorState.set('uncertain');
      }
    } catch {
      this.invalidRecoveryState.set(true);
      this.errorState.set('invalidRecovery');
    }
  }

  accept(snapshot: SessionSnapshot): boolean {
    if (!isSessionSnapshot(snapshot) || snapshot.revision < this.snapshot().revision) {
      return false;
    }
    if (
      this.loaded() &&
      snapshot.revision === this.snapshot().revision &&
      JSON.stringify(snapshot.sessions) !== JSON.stringify(this.snapshot().sessions)
    ) {
      return false;
    }
    this.confirmed.set(snapshot);
    this.loadedState.set(true);
    return true;
  }

  async refresh(): Promise<void> {
    if (this.pending() || this.destroyed) {
      return;
    }
    this.pendingState.set(true);
    try {
      const value = await firstValueFrom(
        this.http.get<unknown>(this.url).pipe(takeUntil(this.stop)),
      );
      if (!this.destroyed) {
        if (!isSessionSnapshot(value) || !this.accept(value)) {
          this.errorState.set('loadFailed');
        } else if (!this.request() && !this.invalidRecovery()) {
          this.errorState.set(null);
        }
      }
    } catch {
      if (!this.destroyed) {
        this.errorState.set('loadFailed');
      }
    } finally {
      this.pendingState.set(false);
    }
  }

  async execute(operation: SessionOperation): Promise<boolean> {
    if (this.destroyed || this.locked()) {
      return false;
    }
    if (!isSessionOperation(operation)) {
      this.errorState.set('rejected');
      return false;
    }
    const request: SessionOperationRequest = {
      requestId: crypto.randomUUID(),
      expectedRevision: this.snapshot().revision,
      operation,
    };
    if (!this.persist(request)) {
      return false;
    }
    this.requestState.set(request);
    return this.send();
  }

  async retry(): Promise<boolean> {
    if (this.pending() || !this.request() || this.destroyed) {
      return false;
    }
    const confirmed = await this.send();
    if (confirmed) {
      await this.refresh();
    }
    return confirmed;
  }

  discardUnreadable(): void {
    if (!this.pending() && this.invalidRecovery() && this.clear()) {
      this.invalidRecoveryState.set(false);
      this.errorState.set(null);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop.next();
    this.stop.complete();
  }

  private get url(): string {
    return `/api/campaigns/${this.campaignId}/sessions`;
  }

  private persist(request: SessionOperationRequest): boolean {
    try {
      if (!this.storage) {
        throw new Error('Session recovery storage is unavailable.');
      }
      this.storage.setItem(this.key, JSON.stringify(request));
      return true;
    } catch {
      this.errorState.set('storageUnavailable');
      return false;
    }
  }

  private clear(): boolean {
    try {
      if (!this.storage) {
        throw new Error('Session recovery storage is unavailable.');
      }
      this.storage.removeItem(this.key);
      this.requestState.set(null);
      return true;
    } catch {
      this.errorState.set('storageUnavailable');
      return false;
    }
  }

  private async send(): Promise<boolean> {
    const request = this.request();
    if (!request || !this.persist(request)) {
      return false;
    }
    this.pendingState.set(true);
    this.errorState.set(null);
    try {
      const value = await firstValueFrom(
        this.http.post<unknown>(this.url, request).pipe(takeUntil(this.stop)),
      );
      if (this.destroyed) {
        return false;
      }
      if (
        !isSessionSnapshot(value) ||
        value.revision !== request.expectedRevision + 1 ||
        !confirmsSessionOperation(value, request.operation)
      ) {
        this.errorState.set('uncertain');
        return false;
      }
      const accepted = this.accept(value);
      if (!accepted && value.revision >= this.snapshot().revision) {
        this.errorState.set('uncertain');
        return false;
      }
      return this.clear();
    } catch (error) {
      if (this.destroyed) {
        return false;
      }
      if (this.isRejection(error)) {
        if (this.clear()) {
          this.errorState.set(error.status === 409 ? 'conflict' : 'rejected');
        }
      } else {
        this.errorState.set('uncertain');
      }
      return false;
    } finally {
      this.pendingState.set(false);
    }
  }

  private isRejection(error: unknown): error is HttpErrorResponse {
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
      [400, 404, 409, 413, 415].includes(error.status) &&
      [
        'campaign_not_found',
        'invalid_session_operation',
        'session_json_required',
        'session_request_too_large',
        'session_revision_conflict',
        'session_request_conflict',
        'session_revision_limit',
        'session_not_found',
        'session_material_not_found',
        'session_already_exists',
        'session_limit',
        'session_transition_conflict',
        'session_pin_exists',
        'session_pin_limit',
        'session_pin_not_found',
      ].includes(code)
    );
  }
}
