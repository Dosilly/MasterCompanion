import type { Node } from '@tiptap/pm/model';
import type { DocumentOutlineEntry } from './document-outline-entry';
import type { DocumentMatch } from './document-match';

/** Index the supported editor model, including nested details and table cells. */
export function documentNavigationIndex(
  document: Node,
  query: string,
): { outline: readonly DocumentOutlineEntry[]; matches: readonly DocumentMatch[] } {
  const outline: DocumentOutlineEntry[] = [];
  const matches: DocumentMatch[] = [];
  const phrase = query.trim();
  const pattern = phrase ? new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'giu') : null;
  document.descendants((node, position) => {
    if (node.type.name === 'heading') {
      const level: unknown = node.attrs['level'];
      outline.push({
        position,
        label: node.textContent,
        level: typeof level === 'number' ? level : 2,
      });
    }
    if (node.isTextblock && pattern) {
      const text = node.textBetween(0, node.content.size, '', '\ufffc');
      for (const match of text.matchAll(pattern)) {
        matches.push({
          from: position + 1 + match.index,
          to: position + 1 + match.index + match[0].length,
        });
      }
    }
  });
  return { outline, matches };
}
