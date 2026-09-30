import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { generateHTML } from '@tiptap/html';
import { documentExtensions } from '../projects/engine/src/lib/editor-schema.mjs';
import { markdownToDocument, writeMaterialSource } from './module-markdown.mjs';

const extensions = documentExtensions();
const converter = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*', br: '\\\n' });
converter.use(gfm);
converter.addRule('tableParagraphs', {
  filter: node => node.nodeName === 'P' && ['TH', 'TD'].includes(node.parentNode.nodeName),
  replacement: content => content,
});
converter.addRule('sourceHeadings', {
  filter: node => /^H[1-6]$/.test(node.nodeName) && node.hasAttribute('id'),
  replacement: (content, node) => `\n\n${'#'.repeat(Number(node.nodeName[1]))} ${content} {#${node.getAttribute('id')}}\n\n`,
});
converter.addRule('details', {
  filter: 'details',
  replacement: (_content, node) => `\n\n${node.outerHTML}\n\n`,
});

export function documentToMarkdown(document) {
  const blocks = JSON.parse(JSON.stringify(document)).content ?? [];
  return blocks.map(block => {
    const original = { type: 'doc', content: [block] };
    const html = generateHTML(original, extensions);
    // Generated column layout is a rendering detail, not part of the rich document.
    const candidate = converter.turndown(html.replace(/<colgroup>[\s\S]*?<\/colgroup>/g, ''))
      .replace(/^[ \t]+$/gm, '').replace(/^([ \t>]*>)[ \t]+$/gm, '$1');
    if (isDeepStrictEqual(markdownToDocument(candidate), original)) return candidate;
    // CommonMark cannot represent every rich block. Preserve just that block as HTML.
    if (!isDeepStrictEqual(markdownToDocument(html), original)) throw new Error('A source block cannot survive the Markdown conversion.');
    return html;
  }).join('\n\n');
}

export function writeModuleSources(destination, seed, manifest, image) {
  const root = resolve(destination);
  if (existsSync(root)) throw new Error('Source import requires a new output directory; existing sources will not be overwritten.');
  // Finish conversion before writing sources so unsupported content fails without partial output.
  const documents = seed.materials.map(material => ({
    material,
    body: documentToMarkdown(material.document),
  }));
  for (const { material, body } of documents) {
    if (!isDeepStrictEqual(markdownToDocument(body), JSON.parse(JSON.stringify(material.document)))) throw new Error(`Markdown conversion changed material: ${material.id}`);
  }
  mkdirSync(resolve(root, 'maps'), { recursive: true });
  mkdirSync(resolve(root, 'assets'), { recursive: true });
  const json = (name, value) => writeFileSync(resolve(root, name), JSON.stringify(value, null, 2) + '\n');
  json('module.json', { sourceSchemaVersion: 1, ...manifest, navigation: 'navigation.json', documents: 'documents',
    maps: ['maps/ythryn.json'], assets: [{ id: 'ythryn-map-image', file: 'assets/ythryn-map.webp', contentType: 'image/webp' }] });
  json('navigation.json', seed.folders);
  json('maps/ythryn.json', seed.maps[0]);
  writeFileSync(resolve(root, 'assets/ythryn-map.webp'), image);
  for (const { material, body } of documents) {
    // Contract IDs can contain colons, which Windows filenames cannot contain.
    const directory = resolve(root, 'documents', `folder-${encodeURIComponent(material.folderId)}`);
    mkdirSync(directory, { recursive: true });
    const slug = material.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
    writeFileSync(resolve(directory, `${encodeURIComponent(material.id)}-${slug || 'material'}.md`), writeMaterialSource({
      id: material.id, title: material.title, folderId: material.folderId, sortOrder: material.sortOrder,
    }, body));
  }
}
