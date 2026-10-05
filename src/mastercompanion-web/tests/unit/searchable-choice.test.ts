import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { filterChoices } from '../../projects/ui/src/lib/searchable-choice/choice-filter';
import {
  folderChoices,
  materialChoices,
} from '../../projects/engine/src/lib/features/choices/campaign-choices';
import type { CampaignFolder, MaterialSummary } from '@mastercompanion/contracts';

const folders: CampaignFolder[] = Array.from({ length: 100 }, (_, index) => ({
  id: `folder-${index}`,
  title: index === 99 ? 'Northern district' : `Chapter ${index}`,
  parentId: index === 99 ? 'folder-0' : null,
}));
const materials: MaterialSummary[] = Array.from({ length: 200 }, (_, index) => ({
  id: `material-${index}`,
  title: index >= 198 ? 'Shared title' : `Note ${index}`,
  folderId: index === 199 ? 'folder-99' : 'folder-0',
  group: 'Unrelated cached group',
}));

describe('Searchable campaign choices', () => {
  test('A title and nested path identify the intended material among 200 records', () => {
    const options = materialChoices(materials, folders, 'Unfiled');

    const results = filterChoices(options, ' SHARED northern ');

    assert.deepEqual(results, [
      { id: 'material-199', label: 'Shared title', detail: 'Chapter 0 / Northern district' },
    ]);
    assert.equal(options.length, 200);
  });

  test('Folder query finds the descendant by its full path among 100 records', () => {
    const options = folderChoices(folders);

    const results = filterChoices(options, 'chapter 0 northern');

    assert.deepEqual(
      results.map((item) => item.id),
      ['folder-99'],
    );
  });

  test('Identical titles in the same folder expose their distinct stable identities', () => {
    const options = materialChoices(
      [materials[198], { ...materials[199], folderId: 'folder-0' }],
      folders,
      'Unfiled',
    );

    assert.deepEqual(
      options.map((item) => item.detail),
      ['Chapter 0 · material-198', 'Chapter 0 · material-199'],
    );
  });

  test('Unfiled choices and empty queries retain explicit labels and original ordering', () => {
    const options = materialChoices([{ ...materials[0], folderId: null }], folders, 'Unfiled');

    assert.deepEqual(filterChoices(options, '   '), [
      { id: 'material-0', label: 'Note 0', detail: 'Unfiled' },
    ]);
    assert.deepEqual(filterChoices(options, 'absent'), []);
    assert.equal(options[0].id, 'material-0');
  });
});
