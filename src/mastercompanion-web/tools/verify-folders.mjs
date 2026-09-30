import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:5142';
const baselinePath = '.local/materials-before-folders.json';
async function get(path) {
  const response = await fetch(baseUrl + path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}
const workspace = await get('/api/workspace');
const materials = [];
for (let offset = 0; offset < workspace.materials.length; offset += 8) {
  const batch = workspace.materials.slice(offset, offset + 8);
  materials.push(...await Promise.all(batch.map(material => get(`/api/materials/${material.id}`))));
}
const fingerprints = materials.map(material => ({ id: material.id, revision: material.revision,
  hash: createHash('sha256').update(JSON.stringify(material.document)).digest('hex') }));
if (process.argv.includes('--capture')) {
  mkdirSync('.local', { recursive: true });
  writeFileSync(baselinePath, JSON.stringify(fingerprints));
  console.log(`Captured document hashes and revisions for ${materials.length} materials.`);
} else {
  assert.deepEqual(fingerprints, JSON.parse(readFileSync(baselinePath, 'utf8')), 'Folder upgrade must preserve every document and revision.');
  const seed = JSON.parse(readFileSync('../MasterCompanion.Modules.Ythryn/Data/pilot.json', 'utf8'));
  const byId = (left, right) => left.id.localeCompare(right.id);
  assert.deepEqual([...workspace.folders].sort(byId), seed.folders.map(({ sortOrder, ...folder }) => folder).sort(byId));
  for (const material of materials) assert.equal(material.folderId, seed.materials.find(item => item.id === material.id).folderId);
  console.log(`Verified ${workspace.folders.length} folders, ${materials.length} assignments, and unchanged documents and revisions.`);
}
