import '@angular/compiler';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import { of } from 'rxjs';
import { Window } from 'happy-dom';

const window = new Window();
for (const name of ['window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'HTMLDetailsElement',
  'MutationObserver', 'DOMParser', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  const value = name === 'window' ? window : window[name];
  Object.defineProperty(globalThis, name, { configurable: true, value: typeof value === 'function' && /^[a-z]/.test(name) ? value.bind(window) : value });
}

// Exercise the real editor/session integration without publishing internal library classes.
const compiledDirectory = '.local/tests/material-editor';
mkdirSync(compiledDirectory, { recursive: true });
for (const name of ['material-session', 'material-editor']) {
  const source = readFileSync(`projects/engine/src/lib/features/materials/${name}.ts`, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace('../../editor-schema.mjs', pathToFileURL(resolve('projects/engine/src/lib/editor-schema.mjs')).href);
  writeFileSync(`${compiledDirectory}/${name}.mjs`, compiled);
}
const { MaterialSession } = await import(pathToFileURL(resolve(compiledDirectory, 'material-session.mjs')));
const { createMaterialEditor } = await import(pathToFileURL(resolve(compiledDirectory, 'material-editor.mjs')));
const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const endings = {
  paragraph: paragraph('Last paragraph'),
  heading: { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Last heading' }] },
  rule: { type: 'horizontalRule' },
  list: { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('List item')] }] },
  table: { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('Cell')] }] }] },
  details: { type: 'details', content: [
    { type: 'detailsSummary', content: [{ type: 'text', text: 'Context' }] },
    { type: 'detailsContent', content: [paragraph('Hidden context')] },
  ] },
};

function fixture(t, ending = endings.rule) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = { type: 'doc', content: [paragraph('Original text'), ending] };
  const requests = [];
  let revision = 10;
  const http = { put(url, body) { requests.push({ url, body }); return of({ revision: ++revision }); } };
  const session = new MaterialSession({ id: 'note', title: 'Note', group: 'Group', folderId: null,
    document: original, documentSchemaVersion: 1, revision }, http);
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createMaterialEditor(element, session, 'Note content');
  t.after(() => { editor.destroy(); element.remove(); });
  return { editor, session, requests, original, element };
}
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

for (const [name, ending] of Object.entries(endings)) {
  test(`Selecting a document ending in ${name} preserves reader content and never saves`, async t => {
    const { editor, session, requests, original } = fixture(t, ending);
    const initial = editor.getJSON();
    let updates = 0;
    editor.on('update', () => updates++);
    editor.commands.setTextSelection(2);
    editor.commands.setTextSelection({ from: 1, to: 8 });
    editor.commands.selectAll();
    assert.deepEqual(editor.getJSON(), initial);
    assert.equal(updates, 0);
    assert.equal(session.dirty(), false);
    assert.equal(session.status(), 'saved');
    assert.deepEqual(session.document, original);
    t.mock.timers.tick(700);
    await nextTurn();
    assert.equal(await session.prepareToClose(), true);
    assert.equal(requests.length, 0);
  });
}

test('Opening details and switching editing modes without an edit does not save', async t => {
  const { editor, session, requests, original, element } = fixture(t, endings.details);
  const initial = editor.getJSON();
  element.querySelector('details').open = true;
  await nextTurn();
  session.editing.set(true);
  editor.setEditable(true, false);
  editor.commands.setTextSelection({ from: 1, to: 8 });
  editor.commands.focus();
  editor.commands.blur();
  session.editing.set(false);
  editor.setEditable(false, false);
  element.querySelector('details').open = false;
  await nextTurn();
  assert.deepEqual(editor.getJSON(), initial);
  assert.deepEqual(session.document, original);
  assert.equal(session.dirty(), false);
  t.mock.timers.tick(700);
  await nextTurn();
  assert.equal(await session.flush(), true);
  assert.equal(requests.length, 0);
});

test('Document update events require both explicit editing and an editable editor', async t => {
  const { editor, session, requests, original } = fixture(t);
  editor.commands.insertContent('Reader update');
  session.editing.set(true);
  editor.commands.insertContent('Still read-only');
  session.editing.set(false);
  editor.setEditable(true, false);
  editor.commands.insertContent('Editing not requested');
  assert.deepEqual(session.document, original);
  assert.equal(session.dirty(), false);
  t.mock.timers.tick(700);
  await nextTurn();
  assert.equal(requests.length, 0);
});

test('A real edit autosaves once with the original revision and undo remains a content change', async t => {
  const { editor, session, requests } = fixture(t);
  session.editing.set(true);
  editor.setEditable(true, false);
  editor.commands.setTextSelection({ from: 1, to: 8 });
  assert.equal(session.dirty(), false);
  editor.commands.insertContent('Edited');
  assert.equal(session.dirty(), true);
  assert.equal(session.status(), 'waiting');
  const edited = editor.getJSON();
  t.mock.timers.tick(650);
  await nextTurn();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.expectedRevision, 10);
  assert.deepEqual(requests[0].body.document, edited);
  assert.equal(session.dirty(), false);
  editor.commands.setTextSelection(2);
  t.mock.timers.tick(700);
  await nextTurn();
  assert.equal(requests.length, 1);
  editor.commands.undo();
  assert.equal(session.dirty(), true);
  const pending = session.flush();
  assert.equal(await pending, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.expectedRevision, 11);
  assert.deepEqual(requests[1].body.document, editor.getJSON());
});
