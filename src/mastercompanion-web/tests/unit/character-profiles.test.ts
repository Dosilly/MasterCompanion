import '@angular/compiler';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { CharacterCatalog as Catalog } from '@mastercompanion/contracts';
import { CharacterDraft } from '../../projects/engine/src/lib/features/characters/character-draft';
import {
  CharacterCatalog,
  isCharacterCatalog,
} from '../../projects/engine/src/lib/features/characters/character-catalog';
import { isGameRequest } from '../../projects/engine/src/lib/features/gameplay/game-wire';
import { ControlledHttp } from '../support/controlled-http';

const id = 'fc0cb119-d4a5-48e7-8d9c-ab01349a2006';
const catalog: Catalog = {
  revision: 4,
  characters: [
    {
      id,
      name: 'Catalog character',
      kind: 'npc',
      inParty: false,
      backstoryMaterialId: 'backstory',
      notesMaterialId: 'notes',
    },
  ],
};

describe('Character profile drafts and catalog', () => {
  test('New players join by default and NPC defaults allow explicit membership', () => {
    const draft = new CharacterDraft();
    draft.begin(4);
    assert.equal(draft.value()?.inParty, true);
    draft.name('New character');
    draft.kind('npc');
    assert.equal(draft.value()?.inParty, false);
    draft.membership(true);
    const change = draft.change('Backstory', 'Notes');
    assert.ok(change);
    assert.equal(change.inParty, true);
    assert.equal(change.kind, 'npc');
    assert.equal(
      isGameRequest({
        kind: 'updateCharacter',
        requestId: id,
        expectedRevision: 4,
        character: change,
      }),
      true,
    );
    assert.equal(draft.dirty(), true);
  });

  test('An explicit new-character membership choice survives type changes', () => {
    const draft = new CharacterDraft();
    draft.begin(4);
    draft.membership(true);

    draft.kind('npc');

    assert.equal(draft.value()?.kind, 'npc');
    assert.equal(draft.value()?.inParty, true);
  });

  for (const character of [
    { ...catalog.characters[0], kind: 'player' as const, inParty: false },
    { ...catalog.characters[0], kind: 'npc' as const, inParty: true },
  ]) {
    test(`Changing an existing ${character.kind} type retains membership ${character.inParty}`, () => {
      const draft = new CharacterDraft();
      draft.begin(4, character);

      draft.kind(character.kind === 'player' ? 'npc' : 'player');

      assert.equal(draft.value()?.inParty, character.inParty);
    });
  }

  for (const name of ['', ' ', 'a'.repeat(101), 'Invalid\nname']) {
    test(`Invalid character name ${JSON.stringify(name)} is rejected without losing the draft`, () => {
      const draft = new CharacterDraft();
      draft.begin(4, catalog.characters[0]);
      draft.name(name);
      assert.equal(draft.change('Backstory', 'Notes'), null);
      assert.equal(draft.value()?.name, name);
      assert.equal(draft.dirty(), true);
    });
  }

  test('Catalog rejects duplicate identities and unsupported types', () => {
    assert.equal(isCharacterCatalog(catalog), true);
    assert.equal(
      isCharacterCatalog({
        ...catalog,
        characters: [...catalog.characters, ...catalog.characters],
      }),
      false,
    );
    assert.equal(
      isCharacterCatalog({
        ...catalog,
        characters: [{ ...catalog.characters[0], kind: 'monster' }],
      }),
      false,
    );
  });

  test('A delayed catalog read cannot roll back the confirmed snapshot', async (t) => {
    const http = new ControlledHttp((value) => value);
    const owner = new CharacterCatalog(id, http.client);
    t.after(() => owner.destroy());
    const first = owner.load();
    const second = owner.load();
    http.requests[1].response.next(catalog);
    await second;
    http.requests[0].response.next({ ...catalog, revision: 3, characters: [] });
    await first;
    assert.deepEqual(owner.snapshot(), catalog);
    assert.equal(owner.loading(), false);
  });

  test('A failed refresh retains the previous catalog and exposes recovery', async (t) => {
    const http = new ControlledHttp((value) => value);
    const owner = new CharacterCatalog(id, http.client);
    t.after(() => owner.destroy());
    const first = owner.load();
    http.requests[0].response.next(catalog);
    await first;
    const refresh = owner.load();
    http.requests[1].response.error(new Error('Controlled read failure'));
    await refresh;
    assert.deepEqual(owner.snapshot(), catalog);
    assert.equal(owner.failed(), true);
  });
});
