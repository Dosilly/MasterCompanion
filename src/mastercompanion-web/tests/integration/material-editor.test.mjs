import '@angular/compiler';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { of } from 'rxjs';
import { Window } from 'happy-dom';
const window = new Window();
for (const name of [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLDetailsElement',
  'MutationObserver',
  'DOMParser',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]) {
  const value = name === 'window' ? window : window[name];
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: typeof value === 'function' && /^[a-z]/.test(name) ? value.bind(window) : value,
  });
}
// Exercise the real editor/session integration without publishing internal library classes.
import { MaterialSession } from '../../projects/engine/src/lib/features/materials/material-session';
import { createMaterialEditor } from '../../projects/engine/src/lib/features/materials/material-editor';
import { DocumentNavigation } from '../../projects/engine/src/lib/features/materials/document-navigation';
const paragraph = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const endings = {
  paragraph: paragraph('Last paragraph'),
  heading: {
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text: 'Last heading' }],
  },
  rule: { type: 'horizontalRule' },
  list: { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('List item')] }] },
  table: {
    type: 'table',
    content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('Cell')] }] }],
  },
  details: {
    type: 'details',
    content: [
      { type: 'detailsSummary', content: [{ type: 'text', text: 'Context' }] },
      { type: 'detailsContent', content: [paragraph('Hidden context')] },
    ],
  },
};
function fixture(t, ending = endings.rule) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = { type: 'doc', content: [paragraph('Original text'), ending] };
  const requests = [];
  let revision = 10;
  const http = {
    put(url, body) {
      requests.push({ url, body });
      return of({ revision: ++revision });
    },
  };
  const session = new MaterialSession(
    {
      id: 'note',
      title: 'Note',
      group: 'Group',
      folderId: null,
      document: original,
      documentSchemaVersion: 1,
      revision,
    },
    http,
  );
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createMaterialEditor(element, session, 'Note content');
  t.after(() => {
    editor.destroy();
    element.remove();
  });
  return { editor, session, requests, original, element };
}
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));
describe('Material editor and session integration', () => {
  test('Matches reindex on actual edits and undo restores content without decoration history', async (t) => {
    const { editor, session } = fixture(t, endings.paragraph);
    session.editing.set(true);
    editor.setEditable(true, false);
    const navigation = new DocumentNavigation(editor);
    t.after(() => navigation.destroy());
    navigation.search('Original');
    const original = editor.getJSON();

    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent(' Original');
    assert.equal(navigation.index().matches.length, 2);
    editor.commands.undo();

    assert.equal(navigation.index().matches.length, 1);
    assert.deepEqual(editor.getJSON(), original);
    assert.equal(editor.can().undo(), false);
  });
  test('Temporary matches preserve editable document, selection, history and save state', async (t) => {
    const { editor, session, requests } = fixture(t);
    session.editing.set(true);
    editor.setEditable(true, false);
    editor.commands.setTextSelection(3);
    const content = editor.getJSON();
    const selection = editor.state.selection.toJSON();
    const navigation = new DocumentNavigation(editor);

    navigation.search('Original');
    navigation.search('Last');
    navigation.search('');
    navigation.destroy();
    t.mock.timers.tick(700);
    await nextTurn();

    assert.deepEqual(editor.getJSON(), content);
    assert.deepEqual(editor.state.selection.toJSON(), selection);
    assert.equal(editor.can().undo(), false);
    assert.equal(session.dirty(), false);
    assert.deepEqual(requests, []);
  });
  for (const [name, ending] of Object.entries(endings)) {
    test(`Selecting a document ending in ${name} preserves reader content and never saves`, async (t) => {
      // Arrange
      const { editor, session, requests, original } = fixture(t, ending);
      const initial = editor.getJSON();
      let updates = 0;

      // Act
      editor.on('update', () => updates++);
      editor.commands.setTextSelection(2);
      editor.commands.setTextSelection({ from: 1, to: 8 });
      editor.commands.selectAll();

      // Assert
      assert.deepEqual(editor.getJSON(), initial);
      assert.equal(updates, 0);
      assert.equal(session.dirty(), false);
      assert.equal(session.status(), 'saved');
      assert.deepEqual(session.document, original);

      // Act
      t.mock.timers.tick(700);
      await nextTurn();
      const actual1 = await session.prepareToClose();

      // Assert
      assert.equal(actual1, true);
      assert.equal(requests.length, 0);
    });
  }
  test('Opening details and switching editing modes without an edit does not save', async (t) => {
    // Arrange
    const { editor, session, requests, original, element } = fixture(t, endings.details);
    const initial = editor.getJSON();

    // Act
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

    // Assert
    assert.deepEqual(editor.getJSON(), initial);
    assert.deepEqual(session.document, original);
    assert.equal(session.dirty(), false);

    // Act
    t.mock.timers.tick(700);
    await nextTurn();
    const actual1 = await session.flush();

    // Assert
    assert.equal(actual1, true);
    assert.equal(requests.length, 0);
  });
  test('Document update events require both explicit editing and an editable editor', async (t) => {
    // Arrange
    const { editor, session, requests, original } = fixture(t);

    // Act
    editor.commands.insertContent('Reader update');
    session.editing.set(true);
    editor.commands.insertContent('Still read-only');
    session.editing.set(false);
    editor.setEditable(true, false);
    editor.commands.insertContent('Editing not requested');

    // Assert
    assert.deepEqual(session.document, original);
    assert.equal(session.dirty(), false);

    // Act
    t.mock.timers.tick(700);
    await nextTurn();

    // Assert
    assert.equal(requests.length, 0);
  });
  test('A real edit autosaves once with the original revision and undo remains a content change', async (t) => {
    // Arrange
    const { editor, session, requests } = fixture(t);

    // Act
    session.editing.set(true);
    editor.setEditable(true, false);
    editor.commands.setTextSelection({ from: 1, to: 8 });

    // Assert
    assert.equal(session.dirty(), false);

    // Act
    editor.commands.insertContent('Edited');

    // Assert
    assert.equal(session.dirty(), true);
    assert.equal(session.status(), 'waiting');
    // Arrange
    const edited = editor.getJSON();

    // Act
    t.mock.timers.tick(650);
    await nextTurn();

    // Assert
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.expectedRevision, 10);
    assert.deepEqual(requests[0].body.document, edited);
    assert.equal(session.dirty(), false);

    // Act
    editor.commands.setTextSelection(2);
    t.mock.timers.tick(700);
    await nextTurn();

    // Assert
    assert.equal(requests.length, 1);

    // Act
    editor.commands.undo();

    // Assert
    assert.equal(session.dirty(), true);

    // Act
    const pending = session.flush();
    const actual1 = await pending;

    // Assert
    assert.equal(actual1, true);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.expectedRevision, 11);
    assert.deepEqual(requests[1].body.document, editor.getJSON());
  });
});
