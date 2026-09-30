import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { readMaterialSource } from './module-markdown.mjs';

export function sourcePath(root, name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || isAbsolute(name)) throw new Error('Invalid module source path.');
  if (name.split('/').some(segment => !segment || segment === '.' || segment === '..')) throw new Error(`Module source path escapes its directory: ${name}`);
  const directory = realpathSync(root);
  const path = realpathSync(resolve(directory, name));
  const offset = relative(directory, path);
  if (!offset || offset === '..' || offset.startsWith('../') || offset.startsWith('..\\') || isAbsolute(offset))
    throw new Error(`Module source path escapes its directory: ${name}`);
  return path;
}

function json(root, name) { return JSON.parse(readFileSync(sourcePath(root, name), 'utf8')); }
function uniqueIds(items, label) {
  if (!Array.isArray(items)) throw new Error(`${label} must be an array.`);
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9:_-]+$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate ${label} ID: ${item?.id}`);
    ids.add(item.id);
  }
  return ids;
}

function materialFiles(root, directory) {
  return readdirSync(sourcePath(root, directory), { withFileTypes: true }).flatMap(entry => {
    const name = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in module documents: ${name}`);
    if (entry.isDirectory()) return materialFiles(root, name);
    if (extname(entry.name) !== '.md') throw new Error(`Unexpected file in module documents: ${name}`);
    return [name];
  }).sort();
}

export function compileModule(root) {
  const manifest = json(root, 'module.json');
  for (const key of ['id', 'name', 'version', 'startMaterialId'])
    if (typeof manifest[key] !== 'string' || !manifest[key].trim()) throw new Error(`Missing module manifest field: ${key}`);
  if (!/^[a-zA-Z0-9:_-]+$/.test(manifest.id)) throw new Error('Invalid module ID.');
  if (manifest.sourceSchemaVersion !== 1 || manifest.contentSchemaVersion !== 1) throw new Error('Unsupported module content schema.');
  const folders = json(root, manifest.navigation);
  const folderIds = uniqueIds(folders, 'folder');
  for (const folder of folders) {
    if (typeof folder.title !== 'string' || !folder.title.trim() || !Number.isSafeInteger(folder.sortOrder) || folder.sortOrder < 0)
      throw new Error(`Invalid folder metadata: ${folder.id}`);
    const ancestors = new Set([folder.id]);
    let parent = folder.parentId;
    while (parent !== null) {
      if (!folderIds.has(parent) || ancestors.has(parent)) throw new Error(`Missing parent or folder cycle: ${folder.id}`);
      ancestors.add(parent);
      parent = folders.find(item => item.id === parent).parentId;
    }
  }
  const materials = materialFiles(root, manifest.documents).map(name => {
    try {
      const material = readMaterialSource(readFileSync(sourcePath(root, name), 'utf8'));
      if (!folderIds.has(material.folderId)) throw new Error(`Unknown folder: ${material.folderId}`);
      return { ...material, group: folders.find(folder => folder.id === material.folderId).title };
    } catch (error) {
      throw new Error(`Invalid material source ${name}: ${error.message}`, { cause: error });
    }
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id, 'en'));
  const materialIds = uniqueIds(materials, 'material');
  if (!materialIds.has(manifest.startMaterialId)) throw new Error('The module start material does not exist.');
  const anchors = new Map();
  const links = [];
  function visit(node, ids) {
    if (node.attrs?.sourceId) {
      if (ids.has(node.attrs.sourceId)) throw new Error(`Duplicate source anchor: ${node.attrs.sourceId}`);
      ids.add(node.attrs.sourceId);
    }
    for (const mark of node.marks ?? []) if (mark.type === 'link') links.push(mark.attrs.href);
    for (const child of node.content ?? []) visit(child, ids);
  }
  for (const material of materials) {
    const ids = new Set();
    visit(material.document, ids);
    ids.add(material.id);
    anchors.set(material.id, ids);
  }
  for (const href of links) {
    const [, id, anchor] = href.match(/^#material\/([^/]+)(?:\/(.+))?$/) ?? [];
    if (!anchors.has(id) || (anchor && !anchors.get(id).has(anchor))) throw new Error(`Unresolved material link: ${href}`);
  }
  const assets = manifest.assets;
  const assetIds = uniqueIds(assets, 'asset');
  for (const asset of assets) {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(asset.contentType)) throw new Error(`Invalid asset media type: ${asset.id}`);
    if (typeof asset.file !== 'string' || !asset.file.startsWith('assets/')) throw new Error(`Module assets must be under the assets directory: ${asset.id}`);
    sourcePath(root, asset.file);
  }
  function validateImages(node) {
    if (node.type === 'image' && !assetIds.has(node.attrs.src.slice('/api/assets/'.length))) throw new Error('Image references an unknown module asset.');
    for (const child of node.content ?? []) validateImages(child);
  }
  materials.forEach(material => validateImages(material.document));
  if (!Array.isArray(manifest.maps)) throw new Error('Module maps must be an array of source paths.');
  const maps = manifest.maps.map(name => json(root, name));
  uniqueIds(maps, 'map');
  for (const map of maps) {
    if (!assetIds.has(map.assetId) || !Number.isFinite(map.width) || map.width <= 0 || !Number.isFinite(map.height) || map.height <= 0)
      throw new Error(`Invalid map asset or dimensions: ${map.id}`);
    if (typeof map.title !== 'string' || !map.title.trim() || !Array.isArray(map.markers)) throw new Error(`Invalid map metadata: ${map.id}`);
    const codes = new Set();
    for (const marker of map.markers) {
      if (!marker || typeof marker.code !== 'string' || !marker.code.trim() || codes.has(marker.code) || typeof marker.title !== 'string' || !marker.title.trim() ||
          !materialIds.has(marker.materialId) || ![marker.x, marker.y].every(value => Number.isFinite(value) && value >= 0 && value <= 100))
        throw new Error(`Invalid map marker: ${marker?.code}`);
      codes.add(marker.code);
    }
  }
  return { schemaVersion: manifest.contentSchemaVersion, folders, materials, maps };
}
