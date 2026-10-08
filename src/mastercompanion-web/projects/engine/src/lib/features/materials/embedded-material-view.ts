import type { ViewContainerRef } from '@angular/core';

/** Presentation destination for the workspace's single mounted document editor. */
export interface EmbeddedMaterialView {
  readonly container: ViewContainerRef;
  readonly materialId: string | null;
  readonly headingId: string;
  readonly showTitle: boolean;
  readonly allowDeletion: boolean;
}
