import { getSchema } from '@tiptap/core';
import type { MaterialDto, RichDocument } from '@mastercompanion/contracts';
import { documentExtensions } from '../../editor-schema.mjs';

const schema = getSchema(documentExtensions());
const maximumDocumentDepth = 32;
const maximumDocumentNodes = 20_000;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function richDocument(
  value: unknown,
  budget: { remaining: number },
  depth = 0,
): value is RichDocument {
  if (
    depth > maximumDocumentDepth ||
    --budget.remaining < 0 ||
    !record(value) ||
    typeof value['type'] !== 'string'
  ) {
    return false;
  }
  return (
    (value['attrs'] === undefined || record(value['attrs'])) &&
    (value['text'] === undefined || typeof value['text'] === 'string') &&
    (value['content'] === undefined ||
      (Array.isArray(value['content']) &&
        value['content'].every((node: unknown) => richDocument(node, budget, depth + 1)))) &&
    (value['marks'] === undefined ||
      (Array.isArray(value['marks']) &&
        value['marks'].every(
          (mark: unknown) =>
            record(mark) &&
            typeof mark['type'] === 'string' &&
            (mark['attrs'] === undefined || record(mark['attrs'])),
        )))
  );
}

/** Rejects unsupported persisted documents before they reach an editor or confirmed cache. */
export function isMaterialResponse(value: unknown): value is MaterialDto {
  if (
    !record(value) ||
    typeof value['id'] !== 'string' ||
    !value['id'] ||
    typeof value['title'] !== 'string' ||
    typeof value['group'] !== 'string' ||
    !(value['folderId'] === null || (typeof value['folderId'] === 'string' && value['folderId'])) ||
    value['documentSchemaVersion'] !== 1 ||
    typeof value['revision'] !== 'number' ||
    !Number.isSafeInteger(value['revision']) ||
    value['revision'] < 1 ||
    !richDocument(value['document'], { remaining: maximumDocumentNodes }) ||
    value['document'].type !== 'doc'
  ) {
    return false;
  }
  try {
    schema.nodeFromJSON(value['document']).check();
    return true;
  } catch {
    return false;
  }
}
