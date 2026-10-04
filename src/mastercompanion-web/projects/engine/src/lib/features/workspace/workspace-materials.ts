import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import type { MaterialDto, WorkspaceDto } from '@mastercompanion/contracts';
import { MaterialSession } from '../materials/material-session';
import { CampaignMaterialCache } from './campaign-material-cache';

/** Owns campaign document memory and editing sessions independently of mounted views. */
export class WorkspaceMaterials {
  private readonly workspaceState = signal<WorkspaceDto | null>(null);
  private readonly sessionState = signal<readonly MaterialSession[]>([]);
  private readonly loadStateValue = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  private cache: CampaignMaterialCache | null = null;
  private destroyed = false;
  readonly workspace = this.workspaceState.asReadonly();
  readonly sessions = this.sessionState.asReadonly();
  readonly loadState = this.loadStateValue.asReadonly();

  constructor(private readonly http: HttpClient) {}

  async initialize(workspace: WorkspaceDto): Promise<void> {
    if (this.destroyed) {
      throw new Error('The material session owner has been destroyed.');
    }
    if (this.cache && this.cache.campaignId !== workspace.campaignId) {
      throw new Error('An existing workspace cannot switch campaigns.');
    }
    this.cache ??= new CampaignMaterialCache(workspace.campaignId, this.http);
    this.loadStateValue.set('loading');
    try {
      await this.cache.refresh();
      this.updateWorkspace(workspace);
      this.loadStateValue.set('ready');
    } catch (error) {
      if (!this.destroyed) {
        this.loadStateValue.set('error');
      }
      throw error;
    }
  }

  async open(id: string): Promise<MaterialSession> {
    const cache = this.requireCache();
    const existing = this.sessions().find((session) => session.material.id === id);
    if (existing) {
      return existing;
    }
    if (!cache.get(id)) {
      await cache.refresh();
      const workspace = this.workspace();
      if (workspace) {
        this.updateWorkspace(workspace);
      }
    }
    const material = cache.get(id);
    if (!material) {
      throw new HttpErrorResponse({ status: 404, statusText: 'Material not found' });
    }
    return this.sessionFor(material);
  }

  acceptCreatedMaterial(material: MaterialDto): MaterialSession {
    this.requireCache().confirm(material);
    const workspace = this.workspace();
    if (workspace) {
      this.updateWorkspace(workspace);
    }
    return this.sessionFor(material);
  }

  private sessionFor(material: MaterialDto): MaterialSession {
    // Replayed confirmations and refreshes must not replace an editor or its newer draft.
    const existing = this.sessions().find((session) => session.material.id === material.id);
    if (existing) {
      return existing;
    }
    const cache = this.requireCache();
    const session = new MaterialSession(material, this.http, (confirmed) =>
      cache.confirm(confirmed),
    );
    this.sessionState.update((sessions) => [...sessions, session]);
    return session;
  }

  private updateWorkspace(workspace: WorkspaceDto): void {
    const materials = new Map(
      this.requireCache()
        .materials()
        .map((material) => [material.id, material]),
    );
    for (const session of this.sessions()) {
      if (!materials.has(session.material.id)) {
        materials.set(session.material.id, session.material);
      }
    }
    this.workspaceState.set({
      ...workspace,
      materials: [...materials.values()].map(({ id, title, group, folderId }) => ({
        id,
        title,
        group,
        folderId,
      })),
    });
  }

  private requireCache(): CampaignMaterialCache {
    if (this.destroyed || !this.cache) {
      throw new Error('The campaign material cache is unavailable.');
    }
    return this.cache;
  }

  removeConfirmedSession(id: string): void {
    if (this.sessions().some((session) => session.material.id === id && session.dirty())) {
      throw new Error('A material session with unconfirmed changes cannot be removed.');
    }
    this.sessionState.update((sessions) =>
      sessions.filter((session) => session.material.id !== id),
    );
  }

  destroy(): void {
    this.destroyed = true;
    this.cache?.destroy();
  }
}
