import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import type { CharacterCatalog as Catalog } from '@mastercompanion/contracts';

export function isCharacterCatalog(value: unknown): value is Catalog {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('revision' in value) ||
    !Number.isSafeInteger(value.revision) ||
    typeof value.revision !== 'number' ||
    value.revision < 0 ||
    !('characters' in value) ||
    !Array.isArray(value.characters) ||
    value.characters.length > 1_000
  ) {
    return false;
  }
  const ids = new Set<string>();
  return value.characters.every((item: unknown) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('id' in item) ||
      typeof item.id !== 'string' ||
      item.id === '00000000-0000-0000-0000-000000000000' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id) ||
      ids.has(item.id.toLowerCase()) ||
      !('name' in item) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.trim() !== item.name ||
      /[\u0000-\u001f\u007f]/.test(item.name) ||
      item.name.length > 100 ||
      !('kind' in item) ||
      (item.kind !== 'player' && item.kind !== 'npc') ||
      !('inParty' in item) ||
      typeof item.inParty !== 'boolean' ||
      !('backstoryMaterialId' in item) ||
      typeof item.backstoryMaterialId !== 'string' ||
      !('notesMaterialId' in item) ||
      typeof item.notesMaterialId !== 'string' ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(item.backstoryMaterialId) ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(item.notesMaterialId) ||
      item.backstoryMaterialId === item.notesMaterialId
    ) {
      return false;
    }
    ids.add(item.id.toLowerCase());
    return true;
  });
}

/** Reads catalog snapshots without replacing metadata or document drafts. */
export class CharacterCatalog {
  private readonly snapshotState = signal<Catalog>({ revision: 0, characters: [] });
  readonly snapshot = this.snapshotState.asReadonly();
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly loaded = signal(false);
  private generation = 0;
  private destroyed = false;
  private readonly stop = new Subject<void>();

  constructor(
    private readonly campaignId: string,
    private readonly http: HttpClient,
  ) {}

  async load(): Promise<void> {
    const generation = ++this.generation;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const value = await firstValueFrom(
        this.http
          .get<unknown>(`/api/campaigns/${this.campaignId}/characters`)
          .pipe(takeUntil(this.stop)),
      );
      if (this.destroyed || generation !== this.generation) {
        return;
      }
      if (!isCharacterCatalog(value)) {
        throw new Error('The character catalog response is invalid.');
      }
      if (!this.loaded() || value.revision >= this.snapshot().revision) {
        this.snapshotState.set(value);
        this.loaded.set(true);
      }
    } catch {
      if (!this.destroyed && generation === this.generation) {
        this.failed.set(true);
      }
    } finally {
      if (!this.destroyed && generation === this.generation) {
        this.loading.set(false);
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop.next();
    this.stop.complete();
  }
}
