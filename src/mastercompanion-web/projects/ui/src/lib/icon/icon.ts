import { Component, input } from '@angular/core';

import type { IconName } from './icon-name';

/** Decorative icon. Its owning control supplies the accessible name. */
@Component({
  selector: 'mc-icon',
  templateUrl: './icon.html',
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      width: 1.125rem;
      height: 1.125rem;
      vertical-align: middle;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
}
