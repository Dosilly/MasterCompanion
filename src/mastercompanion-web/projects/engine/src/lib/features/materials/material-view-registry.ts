import type { ComponentRef, ViewContainerRef, ViewRef } from '@angular/core';
import type { CampaignFolder, MaterialSummary } from '@mastercompanion/contracts';
import { MaterialSession } from './material-session';
import { MaterialView } from './material-view';
import type { EmbeddedMaterialView } from './embedded-material-view';

interface MountedMaterial {
  readonly component: ComponentRef<MaterialView>;
  container: ViewContainerRef;
  view: ViewRef;
}

/** Keeps one mounted editor while Angular moves its view between reading destinations. */
export class MaterialViewRegistry {
  private readonly mounted = new Map<string, MountedMaterial>();

  constructor(
    private readonly open: (request: { id: string; anchor?: string }) => void,
    private readonly deleteMaterial: (id: string, event: Event) => void,
  ) {}

  synchronize(
    sessions: readonly MaterialSession[],
    standalone: ViewContainerRef,
    embedded: EmbeddedMaterialView | undefined,
    activeId: string,
    materials: readonly MaterialSummary[],
    folders: readonly CampaignFolder[],
    deletionLockedIds: ReadonlySet<string>,
  ): void {
    const retained = new Set(sessions.map((session) => session.material.id));
    for (const [id, mounted] of this.mounted) {
      if (!retained.has(id)) {
        mounted.view.destroy();
        this.mounted.delete(id);
      }
    }
    for (const session of sessions) {
      const id = session.material.id;
      const isEmbedded = embedded?.materialId === id;
      const destination = embedded && isEmbedded ? embedded.container : standalone;
      let mounted = this.mounted.get(id);
      if (!mounted) {
        const component = destination.createComponent(MaterialView);
        component.setInput('session', session);
        component.instance.openMaterial.subscribe(this.open);
        component.instance.deleteRequested.subscribe((event) => this.deleteMaterial(id, event));
        mounted = { component, container: destination, view: component.hostView };
        this.mounted.set(id, mounted);
      } else if (mounted.container !== destination) {
        mounted.component.instance.rememberPlacement();
        const index = mounted.container.indexOf(mounted.view);
        if (index < 0) {
          throw new Error('The material view is no longer attached to its owner.');
        }
        const view = mounted.container.detach(index);
        if (!view) {
          throw new Error('The mounted material view is unavailable.');
        }
        mounted.view = destination.insert(view);
        mounted.container = destination;
      }
      mounted.component.setInput('materials', materials);
      mounted.component.setInput('folders', folders);
      mounted.component.setInput('deletionLocked', deletionLockedIds.has(id));
      mounted.component.setInput('showTitle', isEmbedded ? embedded.showTitle : true);
      mounted.component.setInput('allowDeletion', isEmbedded ? embedded.allowDeletion : true);
      const element: HTMLElement = mounted.component.location.nativeElement;
      element.hidden = id !== activeId && !isEmbedded;
      element.id = `panel-${id}`;
      element.classList.toggle('session-document', isEmbedded);
      element.setAttribute('role', isEmbedded ? 'region' : 'tabpanel');
      element.setAttribute('aria-labelledby', isEmbedded ? embedded.headingId : `tab-${id}`);
      mounted.component.changeDetectorRef.detectChanges();
      mounted.component.instance.restorePlacement();
    }
  }

  find(id: string): MaterialView | undefined {
    return this.mounted.get(id)?.component.instance;
  }

  destroy(): void {
    for (const mounted of this.mounted.values()) {
      mounted.view.destroy();
    }
    this.mounted.clear();
  }
}
