import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import type { RichDocument } from '@mastercompanion/contracts';
import { documentExtensions } from '../../editor-schema.mjs';

/** Renders inspected content with the same supported schema without a save owner. */
@Component({
  selector: 'mc-rich-document-preview',
  template: '<div #content class="document-body"></div>',
})
export class RichDocumentPreview implements AfterViewInit, OnDestroy {
  readonly document = input.required<RichDocument>();
  readonly label = input.required<string>();
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private editor?: Editor;

  constructor() {
    effect(() => {
      const document = this.document();
      this.editor?.commands.setContent(document, { emitUpdate: false });
    });
  }

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.content().nativeElement,
      extensions: documentExtensions(),
      content: this.document(),
      editable: false,
      editorProps: { attributes: { role: 'document', 'aria-label': this.label() } },
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }
}
