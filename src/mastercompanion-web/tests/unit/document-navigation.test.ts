import '@angular/compiler';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getSchema } from '@tiptap/core';
import { documentExtensions } from '../../projects/engine/src/lib/editor-schema.mjs';
import { documentNavigationIndex } from '../../projects/engine/src/lib/features/materials/document-navigation-index';
import { searchHighlight } from '../../projects/engine/src/lib/features/materials/search-highlight';

const schema = getSchema(documentExtensions());
describe('Document retrieval projections', () => {
  test('Literal terms preserve markup, regular expression symbols and original casing', () => {
    const text = '<script>Åuril [gate].</script>';
    const parts = searchHighlight(text, 'åuril [gate].');
    assert.equal(parts.map((part) => part.text).join(''), text);
    assert.deepEqual(
      parts.filter((part) => part.matched).map((part) => part.text),
      ['Åuril', '[gate].'],
    );
    assert.deepEqual(searchHighlight(text, ''), [{ text, matched: false }]);
  });
  test('Formatted adjacent text is matched at real model positions and table headings enter the outline', () => {
    const document = schema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '😀Sealed ' },
            { type: 'text', text: 'gate', marks: [{ type: 'bold' }] },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'heading',
                      attrs: { level: 3 },
                      content: [{ type: 'text', text: 'Gate rules' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const index = documentNavigationIndex(document, 'Sealed gate');
    assert.equal(index.matches.length, 1);
    assert.equal(
      document.textBetween(index.matches[0]?.from ?? 0, index.matches[0]?.to ?? 0),
      'Sealed gate',
    );
    assert.deepEqual(
      index.outline.map((entry) => ({ label: entry.label, level: entry.level })),
      [{ label: 'Gate rules', level: 3 }],
    );
  });
  test('Nested details are searchable while a hard break keeps phrases from crossing unrelated text', () => {
    const document = schema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'sealed' },
            { type: 'hardBreak' },
            { type: 'text', text: 'gate' },
          ],
        },
        {
          type: 'details',
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Context' }] },
            {
              type: 'detailsContent',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sealed gate' }] }],
            },
          ],
        },
      ],
    });
    const index = documentNavigationIndex(document, 'sealed gate');
    assert.equal(index.matches.length, 1);
    assert.equal(
      document.textBetween(index.matches[0]?.from ?? 0, index.matches[0]?.to ?? 0),
      'Sealed gate',
    );
    assert.deepEqual(documentNavigationIndex(document, '').matches, []);
  });
});
