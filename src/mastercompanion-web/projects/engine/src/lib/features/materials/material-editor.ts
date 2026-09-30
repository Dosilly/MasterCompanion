import { Editor } from '@tiptap/core';
import { documentExtensions } from '../../editor-schema.mjs';
import type { MaterialSession } from './material-session';

export function createMaterialEditor(element: HTMLElement, session: MaterialSession, contentLabel: string): Editor {
  return new Editor({
    element,
    extensions: documentExtensions(), content: session.document, editable: false,
    editorProps: { attributes: { 'aria-label': contentLabel } },
    onUpdate: ({ editor }) => {
      // Editor plugins may emit content updates while the user is only reading.
      if (session.editing() && editor.isEditable) session.change(editor.getJSON());
    },
  });
}
