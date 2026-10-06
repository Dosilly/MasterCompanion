import { NgTemplateOutlet } from '@angular/common';
import type { CampaignFolder } from '@mastercompanion/contracts';
import { folderPath } from '../workspace/navigation';
import { searchHighlight } from './search-highlight';
import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { uiMessages } from '../../i18n/messages';
import { MaterialSearch } from './material-search';

@Component({
  selector: 'mc-material-search',
  imports: [NgTemplateOutlet],
  templateUrl: './material-search-view.html',
  styleUrl: './material-search-view.scss',
})
export class MaterialSearchView {
  readonly folders = input<readonly CampaignFolder[]>([]);
  readonly highlight = searchHighlight;
  path(folderId: string | null): string {
    return (
      folderPath(this.folders(), folderId)
        .map((id) => this.folders().find((folder) => folder.id === id)?.title)
        .join(' / ') || uiMessages.workspace.unfiledMaterials
    );
  }
  readonly search = input.required<MaterialSearch>();
  readonly activeId = input.required<string>();
  readonly materialRequested = output<string>();
  readonly ui = uiMessages;
  private readonly results = viewChild.required<ElementRef<HTMLElement>>('results');

  revealSelected(focus: boolean): void {
    const container = this.results().nativeElement;
    const selected = container.querySelector<HTMLElement>('[aria-current="page"]');
    if (!selected) {
      return;
    }
    if (focus) {
      selected.focus({ preventScroll: true });
    }
    const item = selected.getBoundingClientRect();
    const bounds = container.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + item.top - bounds.top - (container.clientHeight - item.height) / 2,
    });
  }

  updateQuery(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.search().updateQuery(event.target.value);
    }
  }

  clear(event: Event): void {
    if (this.search().query()) {
      event.preventDefault();
      this.search().updateQuery('');
      this.results().nativeElement.parentElement?.querySelector('input')?.focus();
    }
  }
}
