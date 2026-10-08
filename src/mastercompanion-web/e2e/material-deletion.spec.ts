import type { Page } from '@playwright/test';
import type { MaterialDeletionPreview } from '@mastercompanion/contracts';
import { test, expect, text, openReader, TestApi } from './fixtures';
import { readerId, readerTitle } from './fixtures/campaign';

async function mockDeletion(
  page: Page,
  api: TestApi,
  options: { lostResponse?: boolean; protected?: boolean } = {},
) {
  const requests: unknown[] = [];
  let deleted = false;
  await page.route('**/deletion', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      const preview: MaterialDeletionPreview = {
        id: readerId,
        title: readerTitle,
        revision: api.revision,
        referencesToken: 'A'.repeat(64),
        documentLinks: ['Linked document'],
        mapMarkers: ['Map / Marker'],
        pinnedSessions: ['Pinned meeting'],
        owningCharacters: [],
        owningSessions: options.protected ? ['Required meeting'] : [],
      };
      await route.fulfill({ json: preview });
      return;
    }
    requests.push(request.postDataJSON());
    if (!deleted) {
      deleted = true;
      api.data.materials.splice(
        api.data.materials.findIndex((material) => material.id === readerId),
        1,
      );
      api.data.workspace.materials = api.data.workspace.materials.filter(
        (material) => material.id !== readerId,
      );
      api.data.workspace.foldersRevision++;
    }
    if (options.lostResponse && requests.length === 1) {
      api.expectedNetworkFailures.push(request.url());
      await route.abort('failed');
    } else {
      await route.fulfill({ json: { id: readerId } });
    }
  });
  return requests;
}

function dialog(page: Page) {
  return page.getByRole('dialog', { name: text('engine', 'deletion', 'title') });
}

test('Embedded session documents keep their deletion action and protected confirmation after section switches @deletion', async ({
  page,
  api,
}) => {
  const inspectedIds: string[] = [];
  await page.route('**/deletion', async (route) => {
    expect(route.request().method()).toBe('GET');
    const id = route.request().url().split('/').at(-2);
    const material = api.createdMaterials.find((item) => item.id === id);
    if (!material) {
      throw new Error('Expected an embedded session material.');
    }
    inspectedIds.push(material.id);
    const preview: MaterialDeletionPreview = {
      id: material.id,
      title: material.title,
      revision: material.revision,
      referencesToken: 'A'.repeat(64),
      documentLinks: [],
      mapMarkers: [],
      pinnedSessions: [],
      owningCharacters: [],
      owningSessions: ['Protected session'],
    };
    await route.fulfill({ json: preview });
  });
  await page.goto('/sessions');
  const sessionView = page.locator('mc-session-view');
  await sessionView
    .getByRole('button', { name: text('engine', 'meetings', 'newSession'), exact: true })
    .click();
  await sessionView.getByLabel(text('engine', 'meetings', 'newTitle')).fill('Protected session');
  await sessionView
    .getByRole('button', { name: text('engine', 'meetings', 'create'), exact: true })
    .click();
  await expect(
    sessionView.getByRole('heading', { name: 'Protected session', exact: true }),
  ).toBeVisible();
  const record = api.meetings.snapshot.sessions[0];
  if (!record) {
    throw new Error('Expected the created session.');
  }

  for (const section of ['preparation', 'notes', 'preparation']) {
    await sessionView
      .getByRole('tab', { name: text('engine', 'meetings', section), exact: true })
      .click();
    const documentId =
      section === 'preparation' ? record.preparationMaterialId : record.notesMaterialId;
    const material = sessionView.locator(`#panel-${documentId}`);
    await expect(material).toBeVisible();
    const toolbar = material.getByRole('button', {
      name: text('engine', 'deletion', 'action'),
      exact: true,
    });
    await toolbar.click();
    await expect(dialog(page)).toContainText('Protected session');
    await expect(dialog(page).getByRole('alert')).toContainText(
      text('engine', 'deletion', 'protected'),
    );
    await expect(
      dialog(page).getByRole('button', {
        name: text('engine', 'deletion', 'confirm'),
        exact: true,
      }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(toolbar).toBeFocused();
  }
  expect(inspectedIds).toEqual([
    record.preparationMaterialId,
    record.notesMaterialId,
    record.preparationMaterialId,
  ]);
  expect(api.saves).toHaveLength(0);
});

test('Material context menu and toolbar share confirmation and return focus on cancellation @deletion', async ({
  page,
  api,
}, testInfo) => {
  // Arrange
  await mockDeletion(page, api);
  await openReader(page);
  const navigationItem = page.locator(`[data-material-id="${readerId}"]`);

  // Act
  await navigationItem.click({ button: 'right' });
  const action = page.getByRole('menuitem', {
    name: text('engine', 'contextMenu', 'delete'),
    exact: true,
  });

  // Assert
  await expect(action).toHaveClass(/destructive/);
  await expect(action.locator('mc-icon')).toBeVisible();

  // Act
  await action.click();

  // Assert
  await expect(dialog(page)).toContainText(readerTitle);
  await expect(dialog(page)).toContainText('Linked document');
  await expect(dialog(page)).toContainText('Map / Marker');
  await expect(dialog(page)).toContainText('Pinned meeting');
  await page.screenshot({ path: testInfo.outputPath('deletion-confirmation.png') });

  // Act
  await dialog(page)
    .getByRole('button', { name: text('engine', 'deletion', 'cancel'), exact: true })
    .click();

  // Assert
  await expect(navigationItem).toBeFocused();

  // Act
  await navigationItem.press('Shift+F10');
  await page
    .getByRole('menuitem', { name: text('engine', 'contextMenu', 'delete'), exact: true })
    .click();
  await page.keyboard.press('Escape');
  const toolbar = page.getByRole('button', {
    name: text('engine', 'deletion', 'action'),
    exact: true,
  });
  await toolbar.click();
  await page.keyboard.press('Escape');

  // Assert
  await expect(toolbar).toBeFocused();
  expect(api.saves).toHaveLength(0);
});

test('Confirmed material deletion removes navigation and tab and remains absent after reload @deletion', async ({
  page,
  api,
}) => {
  // Arrange
  const requests = await mockDeletion(page, api);
  await openReader(page);

  // Act
  await page
    .getByRole('button', { name: text('engine', 'deletion', 'action'), exact: true })
    .click();
  await dialog(page)
    .getByRole('button', { name: text('engine', 'deletion', 'confirm'), exact: true })
    .click();

  // Assert
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: readerTitle, exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(1);

  // Act
  await page.reload();

  // Assert
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: readerTitle, exact: true })).toHaveCount(0);

  // Act
  await page.goto(`/materials/${readerId}`);

  // Assert
  await expect(page.getByRole('alert')).toContainText(
    text('engine', 'routes', 'errors', 'materialNotFound'),
  );
});

test('Failed save draft is kept on cancellation and exact deletion retry @deletion', async ({
  page,
  api,
}) => {
  // Arrange
  const requests = await mockDeletion(page, api, { lostResponse: true });
  api.saveMode = 'failure';
  await openReader(page);
  const reader = page.locator(`#panel-${readerId}`);
  await reader
    .getByRole('button', { name: text('engine', 'material', 'edit'), exact: true })
    .click();
  const editor = reader.getByLabel(text('engine', 'material', 'contentLabel'));
  const title = reader.getByLabel(text('engine', 'material', 'titleLabel'), { exact: true });
  await title.fill('Unsaved deletion title');
  await editor.press('Control+End');
  await editor.pressSequentially(' Draft to keep');
  await expect(reader.getByRole('alert')).toContainText(
    text('engine', 'material', 'errors', 'saveFailed'),
  );

  // Act
  await reader
    .getByRole('button', { name: text('engine', 'deletion', 'action'), exact: true })
    .click();

  // Assert
  await expect(
    dialog(page).getByRole('button', { name: text('engine', 'deletion', 'confirm'), exact: true }),
  ).toBeDisabled();

  // Act
  await page.keyboard.press('Escape');

  // Assert
  await expect(editor).toContainText('Draft to keep');
  await expect(title).toHaveValue('Unsaved deletion title');

  // Act
  await reader
    .getByRole('button', { name: text('engine', 'deletion', 'action'), exact: true })
    .click();
  await dialog(page).getByRole('checkbox').check();
  await dialog(page)
    .getByRole('button', { name: text('engine', 'deletion', 'confirm'), exact: true })
    .click();

  // Assert
  await expect(dialog(page).getByRole('alert')).toContainText(
    text('engine', 'deletion', 'errors', 'failed'),
  );
  await expect(editor).toContainText('Draft to keep');

  // Act
  await dialog(page)
    .getByRole('button', { name: text('engine', 'deletion', 'retry'), exact: true })
    .click();

  // Assert
  await expect(dialog(page)).not.toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
});

test('Deletion waits for a saving document and protects required session materials @deletion', async ({
  page,
  api,
}) => {
  // Arrange
  await mockDeletion(page, api, { protected: true });
  api.saveMode = 'hold';
  await openReader(page);
  const reader = page.locator(`#panel-${readerId}`);
  await reader
    .getByRole('button', { name: text('engine', 'material', 'edit'), exact: true })
    .click();
  const editor = reader.getByLabel(text('engine', 'material', 'contentLabel'));
  await editor.press('Control+End');
  await editor.pressSequentially(' Saving draft');
  await expect.poll(() => api.saves.length).toBe(1);

  // Act
  await reader
    .getByRole('button', { name: text('engine', 'deletion', 'action'), exact: true })
    .click();

  // Assert
  await expect(
    dialog(page).getByRole('button', { name: text('engine', 'deletion', 'confirm'), exact: true }),
  ).toBeDisabled();
  await expect(dialog(page).getByRole('status')).toContainText(
    text('engine', 'deletion', 'pending'),
  );

  // Act
  api.releaseSave();

  // Assert
  await expect(dialog(page).getByRole('alert')).toContainText(
    text('engine', 'deletion', 'protected'),
  );
  await expect(
    dialog(page).getByRole('button', { name: text('engine', 'deletion', 'confirm'), exact: true }),
  ).toBeDisabled();
});

test('Campaign refresh explains remote deletion of the active clean material @deletion', async ({
  page,
  api,
}) => {
  // Arrange
  await openReader(page);
  api.data.materials.splice(0, 1);
  api.data.workspace.materials = api.data.workspace.materials.filter(
    (material) => material.id !== readerId,
  );
  api.data.workspace.foldersRevision++;

  // Act
  await page
    .getByRole('button', { name: text('engine', 'workspace', 'refreshMaterials'), exact: true })
    .click();

  // Assert
  await expect(page.getByRole('alert')).toContainText(
    text('engine', 'routes', 'errors', 'materialNotFound'),
  );
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: readerTitle, exact: true })).toHaveCount(0);
});

test('Remote deletion removes navigation while keeping an unsaved open editor available for copying @deletion', async ({
  page,
  api,
}) => {
  // Arrange
  api.saveMode = 'failure';
  await openReader(page);
  const reader = page.locator(`#panel-${readerId}`);
  await reader
    .getByRole('button', { name: text('engine', 'material', 'edit'), exact: true })
    .click();
  const editor = reader.getByLabel(text('engine', 'material', 'contentLabel'));
  await editor.press('Control+End');
  await editor.pressSequentially(' Remote draft');
  await expect(reader.getByRole('alert')).toContainText(
    text('engine', 'material', 'errors', 'saveFailed'),
  );
  api.data.materials.splice(0, 1);
  api.data.workspace.materials = api.data.workspace.materials.filter(
    (material) => material.id !== readerId,
  );
  api.data.workspace.foldersRevision++;

  // Act
  await page
    .getByRole('button', { name: text('engine', 'workspace', 'refreshMaterials'), exact: true })
    .click();

  // Assert
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toHaveCount(0);
  await expect(reader.getByRole('alert')).toContainText(
    text('engine', 'material', 'errors', 'materialDeleted'),
  );
  await expect(editor).toContainText('Remote draft');
  await expect(
    reader.getByRole('button', { name: text('engine', 'material', 'copyDraft'), exact: true }),
  ).toBeVisible();
  await expect(page.locator(`#tab-${readerId}`)).toBeVisible();
});

test('Uncertain deletion remains recoverable after Back and refresh removes its target @deletion', async ({
  page,
  api,
}) => {
  // Arrange
  const requests = await mockDeletion(page, api, { lostResponse: true });
  await openReader(page);
  await page
    .getByRole('button', { name: text('engine', 'deletion', 'action'), exact: true })
    .click();

  // Act
  await dialog(page)
    .getByRole('button', { name: text('engine', 'deletion', 'confirm'), exact: true })
    .click();
  await expect(dialog(page).getByRole('alert')).toContainText(
    text('engine', 'deletion', 'errors', 'failed'),
  );
  await dialog(page)
    .getByRole('button', { name: text('engine', 'deletion', 'cancel'), exact: true })
    .click();
  await page
    .getByRole('button', { name: text('engine', 'workspace', 'refreshMaterials'), exact: true })
    .click();

  // Assert
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toHaveCount(0);
  const recovery = page.getByRole('region', { name: text('engine', 'deletion', 'recoveryTitle') });
  await expect(recovery).toContainText(readerTitle);

  // Act
  await recovery
    .getByRole('button', { name: text('engine', 'deletion', 'resume'), exact: true })
    .click();
  await dialog(page)
    .getByRole('button', { name: text('engine', 'deletion', 'retry'), exact: true })
    .click();

  // Assert
  await expect(recovery).toHaveCount(0);
  expect(requests[1]).toEqual(requests[0]);

  // Act
  await page.locator('[data-material-id="ui-linked"]').click({ button: 'right' });

  // Assert
  await expect(
    page.getByRole('menuitem', { name: text('engine', 'contextMenu', 'delete'), exact: true }),
  ).toBeEnabled();
});
