import { Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';

// The converter and the browser import this exact schema. Source anchors remain stable after editing.
const SourceAnchors = Extension.create({
  name: 'sourceAnchors',
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading', 'blockquote', 'table', 'bulletList', 'orderedList', 'listItem', 'details'],
      attributes: { sourceId: { default: null, parseHTML: element => element.getAttribute('id'),
        renderHTML: attributes => attributes.sourceId ? { id: attributes.sourceId } : {} } } }];
  },
});
const Details = Node.create({
  name: 'details', group: 'block', content: 'detailsSummary detailsContent', defining: true,
  parseHTML: () => [{ tag: 'details' }],
  renderHTML: ({ HTMLAttributes }) => ['details', { ...HTMLAttributes, class: 'context' }, 0],
});
const DetailsSummary = Node.create({
  name: 'detailsSummary', content: 'inline*', defining: true,
  parseHTML: () => [{ tag: 'summary' }], renderHTML: () => ['summary', 0],
});
const DetailsContent = Node.create({
  name: 'detailsContent', content: 'block+', defining: true,
  parseHTML: () => [{ tag: 'details > div' }], renderHTML: () => ['div', { 'data-details-content': '' }, 0],
});
export function documentExtensions() {
  return [StarterKit.configure({ link: { openOnClick: false, autolink: false, linkOnPaste: false } }),
    TableKit.configure({ table: { resizable: false } }), Image.configure({ allowBase64: false }),
    SourceAnchors, Details, DetailsSummary, DetailsContent];
}
