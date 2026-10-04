import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { MaterialDto, WorkspaceDto } from '@mastercompanion/contracts';
import { MaterialSession } from '../materials/material-session';

/** Owns campaign material sessions independently of their mounted views. */
export class WorkspaceMaterials {
  private readonly workspaceState = signal<WorkspaceDto | null>(null);
  private readonly sessionState = signal<readonly MaterialSession[]>([]);
  private readonly loading = new Map<string, Promise<MaterialSession>>();
  readonly workspace = this.workspaceState.asReadonly();
  readonly sessions = this.sessionState.asReadonly();

  constructor(private readonly http: HttpClient) {}

  initialize(workspace: WorkspaceDto): void {
    this.workspaceState.set(workspace);
  }

  async open(id: string): Promise<MaterialSession> {
    const existing = this.sessions().find((session) => session.material.id === id);
    if (existing) {
      return existing;
    }
    const pending = this.loading.get(id);
    if (pending) {
      return pending;
    }
    const request = firstValueFrom(this.http.get<MaterialDto>(`/api/materials/${id}`))
      .then((material) => this.acceptCreatedMaterial(material))
      .finally(() => this.loading.delete(id));
    this.loading.set(id, request);
    return request;
  }

  acceptCreatedMaterial(material: MaterialDto): MaterialSession {
    this.workspaceState.update((workspace) =>
      workspace === null || workspace.materials.some((item) => item.id === material.id)
        ? workspace
        : {
            ...workspace,
            materials: [
              ...workspace.materials,
              {
                id: material.id,
                title: material.title,
                group: material.group,
                folderId: material.folderId,
              },
            ],
          },
    );
    // Replayed confirmations must not replace a mounted editor or its newer draft.
    const existing = this.sessions().find((session) => session.material.id === material.id);
    if (existing) {
      return existing;
    }
    const session = new MaterialSession(material, this.http);
    this.sessionState.update((sessions) => [...sessions, session]);
    return session;
  }

  removeConfirmedSession(id: string): void {
    this.sessionState.update((sessions) =>
      sessions.filter((session) => session.material.id !== id),
    );
  }
}
