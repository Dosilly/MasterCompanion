import { Directive, ViewContainerRef, inject } from '@angular/core';

/** A workspace-owned destination for an existing material component view. */
@Directive({ selector: '[mcMaterialViewHost]' })
export class MaterialViewHost {
  readonly container = inject(ViewContainerRef);
}
