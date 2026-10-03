import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'mc-action-required',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5m0 3v1" />
  </svg><span><ng-content /></span>`,
  styles: `
    :host { display: inline-flex; align-items: center; gap: .6rem; padding: .5rem .75rem;
      border: 1px solid var(--error-line); border-radius: .4rem; background: var(--error-bg);
      color: var(--ink); font-weight: 700; line-height: 1.5; }
    svg { width: 1.4rem; height: 1.4rem; flex: none; fill: none; stroke: currentColor;
      stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  `,
})
export class ActionRequired {}
