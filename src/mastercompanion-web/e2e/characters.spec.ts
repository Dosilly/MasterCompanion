import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';

async function openCharacters(page: import('@playwright/test').Page): Promise<void> {
  await openReader(page);
  await page
    .getByRole('navigation', {
      name: text('engine', 'workspace', 'primaryNavigationLabel'),
      exact: true,
    })
    .getByRole('button', { name: new RegExp(`^${text('engine', 'characters', 'title')}`) })
    .click();
  await expect(page.locator('.character-list li')).toHaveCount(2);
  await expect(page.locator('.character-main .reading-paper')).toBeVisible();
}

test('Catalog creates NPCs outside the party and can join them deliberately @characters', async ({
  page,
  api,
}) => {
  await openCharacters(page);
  const profile = page.locator('.party-view');
  await profile
    .getByRole('button', { name: text('engine', 'characters', 'add'), exact: true })
    .click();
  await expect(
    profile.getByLabel(text('engine', 'characters', 'inParty'), { exact: true }),
  ).toBeChecked();
  await profile
    .getByLabel(text('engine', 'game', 'characterName'), { exact: true })
    .fill('Catalog NPC');
  await profile
    .locator('.character-editor')
    .getByRole('button', { name: text('engine', 'characters', 'npc'), exact: true })
    .click();
  await expect(
    profile.getByLabel(text('engine', 'characters', 'inParty'), { exact: true }),
  ).not.toBeChecked();
  await profile
    .getByRole('button', { name: text('engine', 'characters', 'save'), exact: true })
    .click();

  await expect(profile.locator('.profile-heading')).toContainText('Catalog NPC');
  await expect(profile.locator('.character-list li')).toHaveCount(3);
  expect(api.characters.requests[0]).toMatchObject({
    name: 'Catalog NPC',
    kind: 'npc',
    inParty: false,
  });
  expect(api.data.game.snapshot.party.map((member) => member.name)).not.toContain('Catalog NPC');

  await page
    .getByRole('navigation', {
      name: text('engine', 'workspace', 'primaryNavigationLabel'),
      exact: true,
    })
    .getByRole('button', { name: new RegExp(`^${text('engine', 'game', 'title')}`) })
    .click();
  await expect(page.locator('.blight-tool .character')).toHaveCount(2);
  await expect(page.locator('.game-view')).not.toContainText('Catalog NPC');
  await page.getByRole('tab', { name: text('engine', 'characters', 'title'), exact: true }).click();

  await profile
    .locator('.profile-heading')
    .getByRole('button', { name: text('engine', 'characters', 'details') })
    .click();
  await profile.getByLabel(text('engine', 'characters', 'inParty'), { exact: true }).check();
  await profile
    .getByRole('button', { name: text('engine', 'characters', 'save'), exact: true })
    .click();
  await expect(profile.locator('.character-editor')).toHaveCount(0);
  expect(api.data.game.snapshot.party.map((member) => member.name)).toContain('Catalog NPC');

  await profile
    .locator('.character-filters')
    .first()
    .getByRole('button', { name: text('engine', 'characters', 'party'), exact: true })
    .click();
  await expect(profile.locator('.character-list li')).toHaveCount(3);
  await expectNoHorizontalOverflow(page, profile);
});

test('Backstory and notes keep separate drafts across character and workspace switching @characters', async ({
  page,
  api,
}) => {
  await openCharacters(page);
  const profile = page.locator('.party-view');
  const first = api.characters.profiles[0];
  if (!first) {
    throw new Error('The fixture requires a first character profile.');
  }
  await profile.locator('.character-list li button').first().click();
  await profile
    .locator('.material-commands')
    .getByRole('button', { name: text('engine', 'material', 'edit'), exact: true })
    .click();
  const editor = profile.locator('.tiptap[contenteditable="true"]');
  await editor.fill('Independent backstory');
  await expect.poll(() => api.saves.length).toBe(1);
  await profile
    .locator('.profile-sections')
    .getByRole('button', { name: text('engine', 'characters', 'notes'), exact: true })
    .click();
  await expect(profile.locator('.reading-paper')).not.toContainText('Independent backstory');
  await profile.locator('.character-list li button').nth(1).click();
  await expect(profile.locator('.reading-paper')).not.toContainText('Independent backstory');
  await profile.locator('.character-list li button').first().click();
  await profile
    .locator('.profile-sections')
    .getByRole('button', { name: text('engine', 'characters', 'backstory'), exact: true })
    .click();
  await expect(editor).toContainText('Independent backstory');
  expect(api.noteDocuments.get(first.backstoryMaterialId)).toBeDefined();
  expect(api.noteDocuments.get(first.notesMaterialId)).toBeUndefined();
});

test('Failed profile saves retain the draft and prevent closing the catalog @characters', async ({
  page,
  api,
}) => {
  api.saveMode = 'failure';
  await openCharacters(page);
  const profile = page.locator('.party-view');
  await profile
    .locator('.material-commands')
    .getByRole('button', { name: text('engine', 'material', 'edit'), exact: true })
    .click();
  await profile.locator('.tiptap[contenteditable="true"]').fill('Recoverable profile notes');
  await expect(
    profile
      .getByRole('alert')
      .filter({ hasText: text('engine', 'material', 'errors', 'saveFailed') }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: text('engine', 'workspace', 'closeTab') + ' ' + text('engine', 'game', 'partyTitle'),
      exact: true,
    })
    .click();
  await expect(profile).toBeVisible();
  await expect(profile.locator('.tiptap')).toContainText('Recoverable profile notes');
  await expect(
    profile.getByRole('alert').filter({ hasText: text('engine', 'characters', 'closeBlocked') }),
  ).toBeVisible();
});

test('Catalog closure waits for notes edited while the backstory save is pending @characters', async ({
  page,
  api,
}) => {
  api.saveMode = 'hold';
  await openCharacters(page);
  const profile = page.locator('.party-view');
  await profile
    .locator('.material-commands')
    .getByRole('button', { name: text('engine', 'material', 'edit'), exact: true })
    .click();
  await profile.locator('.tiptap[contenteditable="true"]').fill('Pending backstory');
  await expect.poll(() => api.saves.length).toBe(1);
  const close = page.getByRole('button', {
    name: text('engine', 'workspace', 'closeTab') + ' ' + text('engine', 'game', 'partyTitle'),
    exact: true,
  });
  await close.click();
  await expect(close).toBeDisabled();
  await profile
    .locator('.profile-sections')
    .getByRole('button', { name: text('engine', 'characters', 'notes'), exact: true })
    .click();
  await profile
    .locator('.material-commands')
    .getByRole('button', { name: text('engine', 'material', 'edit'), exact: true })
    .click();
  await profile.locator('.tiptap[contenteditable="true"]').fill('New notes during parent close');
  api.releaseSave();

  await expect(
    page.getByRole('tab', { name: text('engine', 'characters', 'title'), exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => api.saves.length).toBe(2);
  const first = api.characters.profiles[0];
  if (!first) {
    throw new Error('The fixture requires a first profile.');
  }
  expect(api.noteDocuments.get(first.backstoryMaterialId)).toBeDefined();
  expect(api.noteDocuments.get(first.notesMaterialId)).toBeDefined();
});

test('Character catalog and readable profile layout in both themes @characters @visual', async ({
  page,
  api,
}) => {
  const first = api.characters.profiles[0];
  const document = api.createdMaterials.find((item) => item.id === first?.backstoryMaterialId);
  if (!document) {
    throw new Error('The visual fixture requires a character backstory document.');
  }
  document.document = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Before the expedition' }],
      },
      ...Array.from({ length: 8 }, () => ({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'A traveler from the northern valleys, searching for traces of an old companion. The journey brought unlikely friendships, unresolved promises and a reason to explore the silent city.',
          },
        ],
      })),
    ],
  };
  await openCharacters(page);
  await expectNoHorizontalOverflow(page, page.locator('.party-view'));
  await expect(page).toHaveScreenshot('character-catalog.png');
});
