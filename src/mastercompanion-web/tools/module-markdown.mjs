import MarkdownIt from 'markdown-it';
import { parseDocument, stringify } from 'yaml';
import { Window } from 'happy-dom';
import { generateJSON } from '@tiptap/html';
import { documentExtensions } from '../projects/engine/src/lib/editor-schema.mjs';

const markdown = new MarkdownIt({ html: true, linkify: false, typographer: false });
const extensions = documentExtensions();
// Stable section IDs use a small heading extension, rather than HTML headings.
markdown.core.ruler.after('inline', 'source_heading_ids', (state) => {
  for (let index = 0; index < state.tokens.length - 1; index++) {
    if (state.tokens[index].type !== 'heading_open') continue;
    const inline = state.tokens[index + 1];
    const last = inline.children?.at(-1);
    if (last?.type !== 'text') continue;
    const match = last.content.match(/\s+\{#([a-zA-Z0-9:_-]+)\}$/);
    if (!match) continue;
    state.tokens[index].attrSet('id', match[1]);
    last.content = last.content.slice(0, -match[0].length);
  }
});

const tags = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'strong',
  'b',
  'em',
  'i',
  's',
  'del',
  'u',
  'code',
  'pre',
  'br',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'colgroup',
  'col',
  'details',
  'summary',
  'div',
  'a',
  'img',
]);
const attributes = new Set([
  'id',
  'href',
  'title',
  'target',
  'rel',
  'class',
  'start',
  'colspan',
  'rowspan',
  'colwidth',
  'align',
  'style',
  'data-colwidth',
  'width',
  'height',
  'data-details-content',
  'src',
  'alt',
]);

export function markdownToDocument(source) {
  if (Buffer.byteLength(source, 'utf8') > 1024 * 1024)
    throw new Error('A material exceeds the 1 MiB source limit.');
  const html = markdown.render(source);
  const window = new Window();
  try {
    const element = window.document.createElement('div');
    element.innerHTML = html;
    for (const node of element.querySelectorAll('*')) {
      if (!tags.has(node.localName)) throw new Error(`Unsupported HTML element: ${node.localName}`);
      for (const attribute of node.attributes) {
        if (!attributes.has(attribute.name))
          throw new Error(`Unsupported HTML attribute: ${attribute.name}`);
        if (
          attribute.name === 'style' &&
          !/^(?:(?:text-align:\s*(?:left|center|right)|(?:min-)?width:\s*\d+px);?\s*)*$/.test(
            attribute.value,
          )
        )
          throw new Error('Unsupported inline style in a material.');
      }
      if (
        node.hasAttribute('href') &&
        !/^#material\/[a-zA-Z0-9:_-]+(?:\/[a-zA-Z0-9:_-]+)?$/.test(node.getAttribute('href'))
      )
        throw new Error('Material links must reference an internal material or section.');
      if (
        node.hasAttribute('src') &&
        !/^\/api\/assets\/[a-zA-Z0-9:_-]+$/.test(node.getAttribute('src'))
      )
        throw new Error('Images must reference a local module asset.');
    }
    return JSON.parse(JSON.stringify(generateJSON(element.innerHTML, extensions)));
  } finally {
    window.happyDOM.abort();
  }
}

export function readMaterialSource(source) {
  const match = source
    .replace(/^\uFEFF/, '')
    .match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error('Material source must start with YAML front matter.');
  const yaml = parseDocument(match[1], { uniqueKeys: true });
  if (yaml.errors.length) throw new Error(`Invalid material metadata: ${yaml.errors[0].message}`);
  const metadata = yaml.toJS({ maxAliasCount: 0 });
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    throw new Error('Material metadata must be an object.');
  const allowed = new Set(['id', 'title', 'folderId', 'sortOrder']);
  if (Object.keys(metadata).some((key) => !allowed.has(key)))
    throw new Error('Unknown material metadata field.');
  for (const key of ['id', 'title', 'folderId']) {
    if (typeof metadata[key] !== 'string' || !metadata[key].trim())
      throw new Error(`Missing material metadata: ${key}`);
  }
  if (!/^[a-zA-Z0-9:_-]+$/.test(metadata.id)) throw new Error('Invalid material ID.');
  if (!Number.isSafeInteger(metadata.sortOrder) || metadata.sortOrder < 0)
    throw new Error('Material sortOrder must be a non-negative integer.');
  return { ...metadata, document: markdownToDocument(match[2]) };
}

export function writeMaterialSource(metadata, body) {
  const content = body.trim();
  return `---\n${stringify(metadata, { lineWidth: 0 })}---\n${content ? '\n' + content + '\n' : ''}`;
}
