import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import type { GameAction, GameOperationRequest, GameStateDto } from '@mastercompanion/contracts';
import { isGameRequest, isGameState } from './game-wire';

export type GameError = 'loadFailed' | 'operationUncertain' | 'refreshFailed' | 'conflict' | 'rejected' |
  'storageUnavailable' | 'invalidPending' | 'invalidResponse';
export type GameStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class GameSession {
  readonly state = signal<GameStateDto | null>(null);
  readonly pending = signal(false);
  readonly error = signal<GameError | null>(null);
  readonly hasRecovery = signal(false);
  readonly invalidPending = signal(false);
  private readonly needsReload = signal(false);
  readonly canOperate = computed(() => this.state() !== null && !this.pending() && !this.hasRecovery() &&
    !this.needsReload() && !this.invalidPending());
  private request: GameOperationRequest | null = null;
  private readonly stop = new Subject<void>();
  private destroyed = false;
  private readonly key: string;
  private readonly url: string;

  constructor(readonly campaignId: string, private readonly http: HttpClient, private readonly storage: GameStorage | null) {
    this.key = `mastercompanion.game.pending.${campaignId}`;
    this.url = `/api/campaigns/${campaignId}/game`;
    try {
      const stored = storage?.getItem(this.key);
      if (stored) {
        if (new TextEncoder().encode(stored).length > 65_536) throw new Error('Pending game request is too large.');
        const value: unknown = JSON.parse(stored);
        if (!isGameRequest(value)) throw new Error('Invalid pending game request.');
        this.request = value;
        this.hasRecovery.set(true);
      }
    } catch {
      this.invalidPending.set(true);
      this.error.set('invalidPending');
    }
  }

  async load(): Promise<boolean> {
    if (this.pending() || this.destroyed) return false;
    this.pending.set(true);
    try {
      const result = await this.read();
      if (result) {
        this.needsReload.set(false);
        this.error.set(this.invalidPending() ? 'invalidPending' : this.hasRecovery() ? 'operationUncertain' : null);
      }
      return result;
    } finally { this.pending.set(false); }
  }

  async execute(action: GameAction): Promise<boolean> {
    const state = this.state();
    if (!this.canOperate() || state === null || this.destroyed) return false;
    let request: unknown;
    try {
      const json = JSON.stringify({ ...action, requestId: crypto.randomUUID(), expectedRevision: state.revision });
      if (new TextEncoder().encode(json).length > 65_536) throw new Error('Game request is too large.');
      request = JSON.parse(json);
    } catch { this.error.set('rejected'); return false; }
    if (!isGameRequest(request)) { this.error.set('rejected'); return false; }
    this.request = request;
    this.hasRecovery.set(true);
    return this.send();
  }

  async retry(): Promise<boolean> {
    if (this.pending() || this.destroyed || this.invalidPending()) return false;
    return this.request ? this.send() : this.load();
  }

  async discardUnreadable(): Promise<boolean> {
    if (!this.invalidPending() || this.pending() || !this.state() || this.destroyed) return false;
    try {
      if (!this.storage) throw new Error('Pending storage is unavailable.');
      this.storage.removeItem(this.key);
      this.invalidPending.set(false);
      return this.load();
    } catch { this.error.set('storageUnavailable'); return false; }
  }

  destroy() { this.destroyed = true; this.stop.next(); this.stop.complete(); }

  private async send(): Promise<boolean> {
    const request = this.request;
    if (!request) return false;
    this.pending.set(true);
    this.error.set(null);
    try {
      try {
        if (!this.storage) throw new Error('Pending storage is unavailable.');
        // Preserve the exact ID and body before a write whose acknowledgement could be lost.
        this.storage.setItem(this.key, JSON.stringify(request));
      } catch { this.error.set('storageUnavailable'); return false; }
      let value: unknown;
      try { value = await firstValueFrom(this.http.post<unknown>(`${this.url}/operations`, request).pipe(takeUntil(this.stop))); }
      catch (error) {
        if (this.destroyed) return false;
        const rejected = error instanceof HttpErrorResponse && [400, 404, 409, 413, 415, 422].includes(error.status);
        if (rejected) {
          if (!this.clearRequest()) return false;
          const conflict = error.status === 409;
          this.needsReload.set(conflict);
          this.error.set(conflict ? 'conflict' : 'rejected');
        } else this.error.set('operationUncertain');
        return false;
      }
      if (this.destroyed) return false;
      if (!isGameState(value) || value.revision !== request.expectedRevision + 1) {
        this.error.set('invalidResponse'); return false;
      }
      if (request.kind !== 'undo' && (value.lastOperation?.requestId.toLowerCase() !== request.requestId.toLowerCase() ||
        value.lastOperation.kind !== request.kind || value.lastOperation.revision !== value.revision)) {
        this.error.set('invalidResponse'); return false;
      }
      // An idempotent receipt can predate other operations. Always read current state before enabling the next action.
      if (!await this.read(value.revision)) { if (!this.destroyed) this.error.set('refreshFailed'); return false; }
      if (this.destroyed) return false;
      if (!this.clearRequest()) return false;
      this.needsReload.set(false);
      this.error.set(null);
      return true;
    } finally { this.pending.set(false); }
  }

  private clearRequest(): boolean {
    if (this.destroyed) return false;
    try {
      if (!this.storage) throw new Error('Pending storage is unavailable.');
      this.storage.removeItem(this.key);
      this.request = null;
      this.hasRecovery.set(false);
      return true;
    } catch { this.error.set('storageUnavailable'); return false; }
  }

  private async read(minimumRevision = 0): Promise<boolean> {
    if (this.destroyed) return false;
    try {
      const value = await firstValueFrom(this.http.get<unknown>(this.url).pipe(takeUntil(this.stop)));
      if (this.destroyed) return false;
      if (!isGameState(value) || value.revision < minimumRevision || value.revision < (this.state()?.revision ?? 0)) {
        this.needsReload.set(true);
        this.error.set('invalidResponse'); return false;
      }
      this.state.set(value);
      return true;
    } catch { if (!this.destroyed) { this.needsReload.set(true); this.error.set('loadFailed'); } return false; }
  }
}
