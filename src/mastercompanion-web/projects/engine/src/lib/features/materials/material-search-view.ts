import { Component, input, output } from '@angular/core';
import { uiMessages } from '../../i18n/messages';
import { MaterialSearch } from './material-search';

@Component({
  selector: 'mc-material-search',
  templateUrl: './material-search-view.html',
  styleUrl: './material-search-view.scss',
})
export class MaterialSearchView {
  readonly search = input.required<MaterialSearch>();
  readonly activeId = input.required<string>();
  readonly materialRequested = output<string>();
  readonly ui = uiMessages;

  updateQuery(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.search().updateQuery(event.target.value);
    }
  }

  clear(event: Event): void {
    if (this.search().query()) {
      event.preventDefault();
      this.search().updateQuery('');
    }
  }
}
