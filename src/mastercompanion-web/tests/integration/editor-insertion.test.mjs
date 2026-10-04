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
import { MaterialSession } from '../../projects/engine/src/lib/features/materials/material-session';
import { createMaterialEditor } from '../../projects/engine/src/lib/features/materials/material-editor';
import {
  insertMarkdown,
  insertMaterialLink,
  maximumMarkdownLength,
} from '../../projects/engine/src/lib/features/materials/editor-insertion';
const paragraph = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const materials = [
  { id: 'target:stable-id', title: 'Target material', group: 'Group', folderId: null },
];
function fixture(t, editing = true) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = {
    type: 'doc',
    content: [
      paragraph('Original text'),
      {
        type: 'table',
        attrs: { sourceId: 'existing-table' },
        content: [
          {
            type: 'tableRow',
            content: [{ type: 'tableCell', content: [paragraph('Preserved cell')] }],
          },
        ],
      },
      {
        type: 'details',
        attrs: { sourceId: 'existing-context' },
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 'Context' }] },
          { type: 'detailsContent', content: [paragraph('Preserved context')] },
        ],
      },
      { type: 'image', attrs: { src: '/api/assets/existing-image', alt: 'Original image' } },
    ],
  };
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
  session.editing.set(editing);
  editor.setEditable(editing, false);
  t.after(() => {
    editor.destroy();
    element.remove();
  });
  return { editor, session, requests, original, element };
}
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));
describe('Rich editor insertion', () => {
  test('Markdown replaces the captured selection, preserves rich content, saves once and can be undone', async (t) => {
    // Arrange
    const { editor, session, requests } = fixture(t);
    const initial = editor.getJSON();
    const selection = { from: 1, to: 9 };

    // Act
    editor.commands.setTextSelection(12);
    // Arrange
    const source =
      '## Inserted heading\n\n**Bold** and *italic*.\n\n- First\n- Second\n\n> Quoted text\n\n| Key | Value |\n| --- | --- |\n| A | B |';

    // Assert
    assert.equal(insertMarkdown(editor, session.editing(), selection, source, materials), null);
    // Arrange
    const inserted = editor.getJSON();
    for (const node of initial.content.slice(1))
      assert.ok(
        inserted.content.some((item) => JSON.stringify(item) === JSON.stringify(node)),
        `Existing ${node.type} must be preserved`,
      );

    // Assert
    assert.ok(inserted.content.some((node) => node.type === 'heading' && node.attrs.level === 2));
    assert.ok(inserted.content.some((node) => node.type === 'bulletList'));
    assert.ok(inserted.content.some((node) => node.type === 'blockquote'));
    assert.equal(inserted.content.filter((node) => node.type === 'table').length, 2);
    assert.ok(!editor.getText().includes('Original'));
    assert.ok(editor.getText().includes(' text'));
    assert.equal(session.dirty(), true);

    // Act
    t.mock.timers.tick(650);
    await nextTurn();

    // Assert
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.expectedRevision, 10);
    assert.deepEqual(requests[0].body.document, inserted);
    assert.equal(editor.commands.undo(), true);
    assert.deepEqual(editor.getJSON(), initial);

    // Act
    const actual1 = await session.flush();

    // Assert
    assert.equal(actual1, true);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.expectedRevision, 11);
  });
  test('Material links keep the selected text and reference the stable campaign ID', async (t) => {
    // Arrange
    const { editor, session, requests } = fixture(t);
    const initial = editor.getJSON();

    // Act
    editor.commands.setTextSelection(12);

    // Assert
    assert.equal(
      insertMaterialLink(editor, session.editing(), { from: 1, to: 9 }, materials[0].id, materials),
      null,
    );
    assert.equal(editor.getJSON().content[0].content[0].text, 'Original');
    assert.equal(
      editor.getJSON().content[0].content[0].marks.find((mark) => mark.type === 'link').attrs.href,
      '#material/target:stable-id',
    );

    // Act
    const actual1 = await session.flush();

    // Assert
    assert.equal(actual1, true);
    assert.equal(requests.length, 1);
    assert.equal(editor.commands.undo(), true);
    assert.deepEqual(editor.getJSON(), initial);
  });
  test('A link at a cursor inserts the current title with a safe link mark', (t) => {
    // Arrange
    const { editor, session } = fixture(t);

    // Assert
    assert.equal(
      insertMaterialLink(editor, session.editing(), { from: 1, to: 1 }, materials[0].id, materials),
      null,
    );
    // Arrange
    const text = editor.getJSON().content[0].content[0];

    // Assert
    assert.equal(text.text, 'Target material');
    assert.equal(
      text.marks.find((mark) => mark.type === 'link').attrs.href,
      '#material/target:stable-id',
    );
    assert.ok(editor.getText().includes('Original text'));
  });
  test('Blank, oversized, external links, unknown references and images never mutate or save the document', async (t) => {
    // Arrange
    const { editor, session, requests } = fixture(t);
    const initial = editor.getJSON();
    const selection = { from: 1, to: 9 };
    for (const [source, error] of [
      ['   ', 'emptyMarkdown'],
      ['x'.repeat(maximumMarkdownLength + 1), 'markdownTooLarge'],
      ['[External](https://example.com)', 'invalidContent'],
      ['[Local](file:///private)', 'invalidContent'],
      ['[Unsafe](javascript:alert(1))', 'invalidContent'],
      ['[Missing](#material/unknown)', 'invalidContent'],
      ['![Image](https://example.com/image.png)', 'invalidContent'],
      ['![Image](/api/assets/existing-image)', 'invalidContent'],
    ]) {
      // Assert
      assert.equal(
        insertMarkdown(editor, session.editing(), selection, source, materials),
        error,
        source.slice(0, 80),
      );
      assert.deepEqual(editor.getJSON(), initial);
      assert.equal(session.dirty(), false);
    }

    // Assert
    assert.equal(
      insertMaterialLink(editor, true, selection, 'missing', materials),
      'invalidMaterial',
    );
    assert.equal(
      insertMaterialLink(editor, true, { from: 1, to: 999999 }, materials[0].id, materials),
      'notEditing',
    );

    // Act
    t.mock.timers.tick(700);
    await nextTurn();

    // Assert
    assert.equal(requests.length, 0);
  });
  test('Markdown HTML stays literal text and supported internal links resolve only to the current campaign', (t) => {
    // Arrange
    const { editor, session, element } = fixture(t);

    // Assert
    assert.equal(
      insertMarkdown(
        editor,
        session.editing(),
        { from: 1, to: 1 },
        '<script>alert(1)</script>\n\n<img src="https://example.com/remote" onerror="alert(1)">\n\n[Campaign](#material/target:stable-id)',
        materials,
      ),
      null,
    );
    assert.equal(element.querySelector('script'), null);
    assert.equal(element.querySelector('img[src^="https:"]'), null);
    assert.equal(element.querySelector('a[href^="javascript:"]'), null);
    assert.ok(editor.getText().includes('<script>alert(1)</script>'));
    assert.ok(element.querySelector('a[href="#material/target:stable-id"]'));
  });
  test('Insertion requires explicit edit mode and an editable editor', async (t) => {
    // Arrange
    const { editor, session, requests } = fixture(t, false);
    const initial = editor.getJSON();
    const selection = { from: 1, to: 1 };
    const check = () => {
      assert.equal(
        insertMarkdown(editor, session.editing(), selection, 'Text', materials),
        'notEditing',
      );
      assert.equal(
        insertMaterialLink(editor, session.editing(), selection, materials[0].id, materials),
        'notEditing',
      );
      assert.deepEqual(editor.getJSON(), initial);
      assert.equal(session.dirty(), false);
    };

    // Act
    check();
    session.editing.set(true);
    check();
    session.editing.set(false);
    editor.setEditable(true, false);
    check();
    t.mock.timers.tick(700);
    await nextTurn();

    // Assert
    assert.equal(requests.length, 0);
  });
});
