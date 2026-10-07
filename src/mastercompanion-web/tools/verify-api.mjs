import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sourceFixture = JSON.parse(
  readFileSync(new URL('./fixtures/ythryn-source.json', import.meta.url), 'utf8'),
);

const base = process.env.API_BASE_URL ?? 'http://localhost:5142';
const workspace = await fetch(`${base}/api/workspace`).then((response) => response.json());
assert.equal(workspace.materials.length, 142);
assert.equal(workspace.maps[0].markers.length, 29);
const url = `${base}/api/materials/s615b3d87a8ef`;
const original = await fetch(url).then((response) => response.json());
const put = (document, expectedRevision) =>
  fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: original.title, document, expectedRevision }),
  });
async function verifyRejectedWrites(revision) {
  const conflict = await put(original.document, revision - 1);
  assert.equal(conflict.status, 409);
  const conflictProblem = await conflict.json();
  assert.equal(conflictProblem.code, 'material_revision_conflict');
  assert.equal(conflictProblem.title, 'Material revision conflict');
  const invalid = await put({ type: 7, content: [] }, revision);
  assert.equal(invalid.status, 400);
  const invalidProblem = await invalid.json();
  assert.equal(invalidProblem.code, 'invalid_document');
  assert.equal(invalidProblem.title, 'Invalid material document');
}
if (process.argv.includes('--errors-only')) {
  await verifyRejectedWrites(original.revision);
  const readBack = await fetch(url).then((response) => response.json());
  assert.deepEqual(readBack.document, original.document);
  assert.equal(readBack.revision, original.revision);
  console.log(
    'API errors OK: English ProblemDetails, stable error codes, and no persisted changes.',
  );
} else {
  const modified = structuredClone(original.document);
  modified.content.push({
    type: 'paragraph',
    attrs: { sourceId: null },
    content: [
      { type: 'text', text: `Persistence probe ${randomUUID()} — ${sourceFixture.unicodeText}.` },
    ],
  });
  let savedRevision;
  try {
    const saved = await put(modified, original.revision);
    assert.equal(saved.status, 200);
    savedRevision = (await saved.json()).revision;
    assert.equal(savedRevision, original.revision + 1);
    const readBack = await fetch(url).then((response) => response.json());
    assert.deepEqual(readBack.document, modified);
    await verifyRejectedWrites(savedRevision);
    assert.deepEqual((await fetch(url).then((response) => response.json())).document, modified);
    console.log(
      'PostgreSQL/API OK: durable read/write, revision conflict 409, invalid document 400.',
    );
  } finally {
    if (savedRevision !== undefined) {
      const restored = await put(original.document, savedRevision);
      assert.equal(
        restored.status,
        200,
        'The material changed during the probe; do not overwrite a newer revision to restore the fixture.',
      );
    }
  }
}
