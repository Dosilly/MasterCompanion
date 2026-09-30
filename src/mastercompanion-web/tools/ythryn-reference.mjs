import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Window } from 'happy-dom';
import { generateJSON, generateHTML } from '@tiptap/html';
import { documentExtensions } from '../projects/engine/src/lib/editor-schema.mjs';

export function convertYthrynReference(sourceFile) {
  if (typeof sourceFile !== 'string' || !sourceFile) throw new Error('An external POC HTML path is required.');
  const sourceFixture = JSON.parse(readFileSync(new URL('./fixtures/ythryn-import.json', import.meta.url), 'utf8'));
  const source = readFileSync(resolve(sourceFile), 'utf8');
  const match = source.match(/const DATA\s*=\s*(\{[^\r\n]+\});?/);
  if (!match) throw new Error('POC HTML does not contain a supported DATA payload.');
  const data = JSON.parse(match[1]);
  const pages = data.pages.filter(page => Number(page.chapter) === 7);
  const groups = data.docs.filter(doc => Number(doc.chapter) === 7);
  // Directory hierarchy belongs to this module's source conversion, never to the engine.
  const rootDirectory = sourceFixture.rootDirectory;
  const directories = new Map();
  const folders = groups.map((group, sortOrder) => ({ id: group.id, title: group.title, parentId: null, sortOrder }));
  function directoryId(path) {
    if (path === rootDirectory) return null;
    if (directories.has(path)) return directories.get(path);
    const parentPath = path.slice(0, path.lastIndexOf('/'));
    const parentId = directoryId(parentPath);
    // The player index is the requested parent; its Fenes subdirectory stays a separate folder like in the POC.
    const index = path.endsWith('/' + sourceFixture.playerDirectory)
      ? groups.find(doc => doc.path.slice(0, doc.path.lastIndexOf('/')) === path && /^00\./.test(doc.name)) : undefined;
    const id = index?.id ?? `directory:${createHash('sha256').update(path).digest('hex').slice(0, 16)}`;
    directories.set(path, id);
    if (index) folders.find(folder => folder.id === id).parentId = parentId;
    else folders.push({ id, title: path.endsWith('/' + sourceFixture.metadataDirectory) ? sourceFixture.metadataTitle : path.split('/').at(-1), parentId,
      sortOrder: groups.findIndex(doc => doc.path.startsWith(path + '/')) });
    return id;
  }
  for (const group of groups) {
    const parentId = directoryId(group.path.slice(0, group.path.lastIndexOf('/')));
    if (parentId !== group.id) folders.find(folder => folder.id === group.id).parentId = parentId;
  }
  folders.sort((left, right) => left.sortOrder - right.sortOrder);
  const knownIds = new Set(pages.map(page => page.id));
  const window = new Window();
  const extensions = documentExtensions();
  const report = { groups: groups.length, materials: pages.length, markers: data.maps['7'].points.length, unresolvedLinks: [], externalReferences: [], textMismatches: [] };
  // HTML indentation and formatting introduce different whitespace between block nodes.
  // Compare all non-whitespace characters, in order, so missing words and punctuation still fail.
  const normalize = text => text.replace(/\s+/g, '');
  function plainText(html) {
    const element = window.document.createElement('div');
    element.innerHTML = html;
    return normalize(element.textContent);
  }
  const materials = pages.map((page, sortOrder) => {
    const element = window.document.createElement('div');
    element.innerHTML = page.html;
    for (const link of element.querySelectorAll('a')) {
      const href = link.getAttribute('href') ?? '';
      const [target, anchor] = href.replace(/^#/, '').split('~');
      if (href.startsWith('#') && knownIds.has(target)) {
        link.setAttribute('href', `#material/${target}${anchor ? '/' + anchor : ''}`);
      } else {
        const entry = { materialId: page.id, title: page.title, label: link.textContent, target: href };
        (href.startsWith('#') || href.startsWith('obsidian:') ? report.unresolvedLinks : report.externalReferences).push(entry);
        // Keep the reference's visible text; no dead navigation or request to an external site.
        link.replaceWith(...link.childNodes);
      }
    }
    const document = generateJSON(element.innerHTML, extensions);
    const rendered = generateHTML(document, extensions);
    if (plainText(element.innerHTML) !== plainText(rendered)) report.textMismatches.push(page.id);
    return { id: page.id, title: page.title, group: groups.find(group => group.id === page.doc)?.title ?? page.doc,
      folderId: page.doc, document, sortOrder };
  });
  if (report.textMismatches.length) throw new Error(`Conversion changed the source text: ${report.textMismatches.join(', ')}`);
  const sourceMap = data.maps['7'];
  const markers = sourceMap.points.map(point => ({ code: point.code, x: point.x, y: point.y, materialId: point.page, title: point.title }));
  if (markers.some(marker => !knownIds.has(marker.materialId))) throw new Error('A map marker references a material that does not exist.');
  window.happyDOM.abort();
  return { seed: { schemaVersion: 1, folders, materials, maps: [{ id: 'ythryn-map', title: sourceMap.title, assetId: 'ythryn-map-image', width: sourceMap.width, height: sourceMap.height, markers }] },
    image: Buffer.from(sourceMap.image.split(',')[1], 'base64'), report };
}
