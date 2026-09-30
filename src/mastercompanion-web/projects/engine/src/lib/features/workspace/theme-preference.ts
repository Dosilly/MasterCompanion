import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemePreference {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  readonly dark = signal(this.initialDark());

  constructor() { this.apply(); }

  toggle() {
    this.dark.update(dark => !dark);
    this.apply();
    try { this.window?.localStorage.setItem('mastercompanion.theme', this.dark() ? 'dark' : 'light'); }
    catch { /* The current session still works when browser storage is unavailable. */ }
  }

  private initialDark(): boolean {
    try {
      const preference = this.window?.localStorage.getItem('mastercompanion.theme');
      if (preference === 'dark' || preference === 'light') return preference === 'dark';
    } catch { /* Fall back to the operating system preference. */ }
    return this.window?.matchMedia('(prefers-color-scheme: dark)').matches ?? false;
  }

  private apply() { this.document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light'; }
}
