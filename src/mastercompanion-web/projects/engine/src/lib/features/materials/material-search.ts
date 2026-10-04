import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import type { MaterialSearchResponse, MaterialSearchResult } from '@mastercompanion/contracts';
import type { Subscription } from 'rxjs';

export type MaterialSearchError = 'invalidQuery' | 'campaignMissing' | 'failed';

export type MaterialSearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; results: readonly MaterialSearchResult[]; hasMore: boolean }
  | { kind: 'error'; error: MaterialSearchError };

const searchDelayMilliseconds = 250;
const maximumQueryLength = 160;
const maximumResults = 50;

/** Searches confirmed campaign documents; owns debounce, cancellation and stale-response protection. */
export class MaterialSearch {
  private readonly queryState = signal('');
  private readonly resultState = signal<MaterialSearchState>({ kind: 'idle' });
  private timer?: ReturnType<typeof setTimeout>;
  private request?: Subscription;
  private generation = 0;
  private destroyed = false;
  readonly query = this.queryState.asReadonly();
  readonly state = this.resultState.asReadonly();

  constructor(
    private readonly campaignId: string,
    private readonly http: HttpClient,
  ) {}

  updateQuery(query: string): void {
    if (this.destroyed) {
      return;
    }
    this.queryState.set(query);
    this.schedule();
  }

  refresh(): void {
    if (!this.destroyed && this.query().trim()) {
      this.schedule();
    }
  }

  retry(): void {
    if (!this.destroyed && this.state().kind === 'error') {
      this.schedule(true);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.cancel();
  }

  private schedule(immediate = false): void {
    this.cancel();
    const query = this.query().normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!query) {
      this.resultState.set({ kind: 'idle' });
      return;
    }
    if (query.length > maximumQueryLength || /[\u0000-\u001f\u007f]/u.test(query)) {
      this.resultState.set({ kind: 'error', error: 'invalidQuery' });
      return;
    }
    this.resultState.set({ kind: 'loading' });
    const generation = this.generation;
    if (immediate) {
      this.search(query, generation);
    } else {
      this.timer = setTimeout(() => this.search(query, generation), searchDelayMilliseconds);
    }
  }

  private search(query: string, generation: number): void {
    this.timer = undefined;
    this.request = this.http
      .get<unknown>(
        `/api/campaigns/${encodeURIComponent(this.campaignId)}/materials/search?query=${encodeURIComponent(query)}`,
      )
      .subscribe({
        next: (response) => {
          if (generation !== this.generation || this.destroyed) {
            return;
          }
          this.resultState.set(
            isSearchResponse(response)
              ? { kind: 'ready', results: response.results, hasMore: response.hasMore }
              : { kind: 'error', error: 'failed' },
          );
        },
        error: (error: unknown) => {
          if (generation !== this.generation || this.destroyed) {
            return;
          }
          const status = error instanceof HttpErrorResponse ? error.status : 0;
          this.resultState.set({
            kind: 'error',
            error: status === 400 ? 'invalidQuery' : status === 404 ? 'campaignMissing' : 'failed',
          });
        },
      });
  }

  private cancel(): void {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.request?.unsubscribe();
    this.request = undefined;
  }
}

function isSearchResponse(value: unknown): value is MaterialSearchResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('results' in value) ||
    !Array.isArray(value.results) ||
    value.results.length > maximumResults ||
    !('hasMore' in value) ||
    typeof value.hasMore !== 'boolean'
  ) {
    return false;
  }
  const ids = new Set<string>();
  return value.results.every((result: unknown) => {
    if (
      typeof result !== 'object' ||
      result === null ||
      !('id' in result) ||
      typeof result.id !== 'string' ||
      !result.id ||
      ids.has(result.id) ||
      !('title' in result) ||
      typeof result.title !== 'string' ||
      !('snippet' in result) ||
      typeof result.snippet !== 'string' ||
      !('folderId' in result) ||
      (result.folderId !== null && typeof result.folderId !== 'string')
    ) {
      return false;
    }
    ids.add(result.id);
    return true;
  });
}
