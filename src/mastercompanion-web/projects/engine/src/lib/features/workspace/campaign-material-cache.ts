import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import type { MaterialDto } from '@mastercompanion/contracts';
import { isMaterialResponse } from '../materials/material-response';

/** Stores confirmed campaign documents independently of open editors. */
export class CampaignMaterialCache {
  private records = new Map<string, MaterialDto>();
  private readonly confirmedChanges = new Map<string, number>();
  private version = 0;
  private pending?: Promise<void>;
  private readonly stopReads = new Subject<void>();
  private destroyed = false;

  constructor(
    readonly campaignId: string,
    private readonly http: HttpClient,
  ) {}

  get(id: string): MaterialDto | undefined {
    return this.records.get(id);
  }

  materials(): readonly MaterialDto[] {
    return [...this.records.values()];
  }

  confirm(material: MaterialDto): void {
    if (this.destroyed || (this.records.get(material.id)?.revision ?? -1) > material.revision) {
      return;
    }
    this.records.set(material.id, material);
    this.confirmedChanges.set(material.id, ++this.version);
  }

  refresh(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('The campaign material cache has been destroyed.'));
    }
    if (this.pending) {
      return this.pending;
    }
    const startedAtVersion = this.version;
    this.pending = firstValueFrom(
      this.http
        .get<unknown>(`/api/campaigns/${encodeURIComponent(this.campaignId)}/materials`)
        .pipe(takeUntil(this.stopReads)),
    )
      .then((materials) => this.acceptSnapshot(materials, startedAtVersion))
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  }

  private acceptSnapshot(materials: unknown, startedAtVersion: number): void {
    if (this.destroyed) {
      throw new Error('The campaign material cache has been destroyed.');
    }
    if (!Array.isArray(materials)) {
      throw new Error('The campaign material snapshot is not an array.');
    }
    const snapshot: readonly unknown[] = materials;
    const refreshed = new Map<string, MaterialDto>();
    for (const material of snapshot) {
      if (!isMaterialResponse(material)) {
        throw new Error('The campaign material snapshot contains an unsupported material.');
      }
      if (refreshed.has(material.id)) {
        throw new Error('The campaign material snapshot contains duplicate identifiers.');
      }
      const previous = this.records.get(material.id);
      // A delayed read must not roll back a save confirmed while it was in flight.
      refreshed.set(
        material.id,
        previous && previous.revision > material.revision ? previous : material,
      );
    }
    for (const [id, material] of this.records) {
      if (!refreshed.has(id) && (this.confirmedChanges.get(id) ?? 0) > startedAtVersion) {
        refreshed.set(id, material);
      }
    }
    this.records = refreshed;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopReads.next();
    this.stopReads.complete();
    this.records.clear();
    this.confirmedChanges.clear();
  }
}
