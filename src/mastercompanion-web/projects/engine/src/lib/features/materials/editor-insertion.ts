import { Editor, generateJSON } from '@tiptap/core';
import type { MaterialSummary } from '@mastercompanion/contracts';
import MarkdownIt from 'markdown-it';
import { documentExtensions } from '../../editor-schema.mjs';

export interface InsertionSelection {
  from: number;
  to: number;
}
export type InsertionError =
  'notEditing' | 'emptyMarkdown' | 'markdownTooLarge' | 'invalidContent' | 'invalidMaterial';
export const maximumMarkdownLength = 65_536;

function canInsert(editor: Editor, editing: boolean, selection: InsertionSelection): boolean {
  return (
    editing &&
    editor.isEditable &&
    !editor.isDestroyed &&
    Number.isInteger(selection.from) &&
    Number.isInteger(selection.to) &&
    selection.from >= 0 &&
    selection.to >= selection.from &&
    selection.to <= editor.state.doc.content.size
  );
}

// Only campaign references are links. HTML is escaped, and image syntax is refused;
// pasting a note cannot load external resources or introduce arbitrary markup.
export function insertMarkdown(
  editor: Editor,
  editing: boolean,
  selection: InsertionSelection,
  source: string,
  materials: readonly MaterialSummary[],
): InsertionError | null {
  if (!canInsert(editor, editing, selection)) {
    return 'notEditing';
  }
  if (!source.trim()) {
    return 'emptyMarkdown';
  }
  if (source.length > maximumMarkdownLength) {
    return 'markdownTooLarge';
  }
  const markdown = new MarkdownIt({ html: false, linkify: false, maxNesting: 24 });
  // Parse all link syntax so the campaign allowlist can reject unsafe schemes
  // explicitly, instead of quietly inserting rejected URLs as ordinary text.
  markdown.validateLink = () => true;
  const materialIds = new Set(materials.map((material) => material.id));
  let invalidContent = false;
  markdown.renderer.rules.image = () => {
    invalidContent = true;
    return '';
  };
  markdown.renderer.rules.link_open = (tokens, index, options, _environment, renderer) => {
    const href = tokens[index].attrGet('href');
    const match =
      typeof href === 'string'
        ? href.match(/^#material\/([a-zA-Z0-9:_-]+)(?:\/([a-zA-Z0-9:_-]+))?$/)
        : null;
    if (!match || !materialIds.has(match[1])) {
      invalidContent = true;
    }
    return renderer.renderToken(tokens, index, options);
  };
  try {
    const html = markdown.render(source);
    if (invalidContent) {
      return 'invalidContent';
    }
    const document = generateJSON(html, documentExtensions());
    const node = editor.schema.nodeFromJSON(document);
    node.check();
    if (!node.textContent.trim() && node.childCount === 0) {
      return 'emptyMarkdown';
    }
    return editor
      .chain()
      .setTextSelection(selection)
      .insertContent(document.content ?? [])
      .run()
      ? null
      : 'invalidContent';
  } catch {
    // Keep the original document and pasted text recoverable on parser failure.
    return 'invalidContent';
  }
}

export function insertMaterialLink(
  editor: Editor,
  editing: boolean,
  selection: InsertionSelection,
  materialId: string,
  materials: readonly MaterialSummary[],
): InsertionError | null {
  if (!canInsert(editor, editing, selection)) {
    return 'notEditing';
  }
  const material = materials.find((item) => item.id === materialId);
  if (!material || !/^[a-zA-Z0-9:_-]+$/.test(material.id)) {
    return 'invalidMaterial';
  }
  const href = `#material/${material.id}`;
  const chain = editor.chain().setTextSelection(selection);
  const inserted =
    selection.from === selection.to
      ? chain
          .insertContent({
            type: 'text',
            text: material.title,
            marks: [{ type: 'link', attrs: { href } }],
          })
          .run()
      : chain.setMark('link', { href }).run();
  return inserted ? null : 'invalidContent';
}
