import { signal } from '@angular/core';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { documentNavigationIndex } from './document-navigation-index';

/** Temporary reader decorations and scrolling; document/selection/history remain editor-owned. */
export class DocumentNavigation {
  private readonly queryState = signal('');
  private readonly indexState = signal<ReturnType<typeof documentNavigationIndex>>({
    outline: [],
    matches: [],
  });
  private readonly selectedState = signal(-1);
  private readonly canReturnState = signal(false);
  readonly query = this.queryState.asReadonly();
  readonly index = this.indexState.asReadonly();
  readonly selected = this.selectedState.asReadonly();
  readonly canReturn = this.canReturnState.asReadonly();
  private readonly pluginKey = new PluginKey('documentNavigation');
  private previousScroll?: number;
  private readonly refresh = ({ transaction }: { transaction: { docChanged: boolean } }): void => {
    if (transaction.docChanged) {
      this.reindex();
    }
  };
  constructor(private readonly editor: Editor) {
    this.indexState.set(documentNavigationIndex(editor.state.doc, ''));
    editor.registerPlugin(
      new Plugin({
        key: this.pluginKey,
        props: {
          decorations: (state) =>
            DecorationSet.create(
              state.doc,
              this.index().matches.map((match, index) =>
                Decoration.inline(match.from, match.to, {
                  class:
                    index === this.selected() ? 'document-match current-match' : 'document-match',
                }),
              ),
            ),
        },
      }),
    );
    editor.on('transaction', this.refresh);
  }
  search(query: string): void {
    this.queryState.set(query);
    this.reindex();
  }
  move(delta: number): void {
    const matches = this.index().matches;
    if (!matches.length) {
      return;
    }
    const selected = (this.selected() + delta + matches.length) % matches.length;
    this.selectedState.set(selected);
    this.redraw();
    const match = matches[selected];
    if (match) {
      this.reveal(match.from);
    }
  }
  reveal(position: number): void {
    const scroll = this.editor.view.dom.closest<HTMLElement>('.material-scroll');
    if (!scroll) {
      return;
    }
    if (this.previousScroll === undefined) {
      this.previousScroll = scroll.scrollTop;
      this.canReturnState.set(true);
    }
    const target = this.editor.view.domAtPos(position).node;
    for (
      let element = target instanceof HTMLElement ? target : target.parentElement;
      element && element !== scroll;
      element = element.parentElement
    ) {
      if (element instanceof HTMLDetailsElement) {
        element.open = true;
      }
    }
    const bounds = this.editor.view.coordsAtPos(position);
    scroll.scrollTo({
      top: scroll.scrollTop + bounds.top - scroll.getBoundingClientRect().top - 40,
    });
  }
  returnToReading(): void {
    const scroll = this.editor.view.dom.closest<HTMLElement>('.material-scroll');
    if (scroll && this.previousScroll !== undefined) {
      scroll.scrollTop = this.previousScroll;
    }
    this.previousScroll = undefined;
    this.canReturnState.set(false);
  }
  destroy(): void {
    this.editor.off('transaction', this.refresh);
    this.editor.unregisterPlugin(this.pluginKey);
  }
  private reindex(): void {
    this.indexState.set(documentNavigationIndex(this.editor.state.doc, this.query()));
    this.selectedState.set(-1);
    this.redraw();
  }
  private redraw(): void {
    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(this.pluginKey, true).setMeta('addToHistory', false),
    );
  }
}
