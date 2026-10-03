import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerId, readerTitle, linkedTitle } from './fixtures/campaign';
test('Editor controls and Markdown dialog fit the viewport @editor @visual', async ({ page, api }) => {
    // Arrange
    await openReader(page);

    // Act
    await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
    const editor = page.locator(`#panel-${readerId}`).getByLabel(text('engine', 'material', 'contentLabel'));

    // Assert
    await expect(editor).toHaveAttribute('contenteditable', 'true');
    await expect(page.getByRole('button', { name: text('engine', 'material', 'bold'), exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page, page.locator(`#panel-${readerId} .material-scroll`));
    await expect(page).toHaveScreenshot('editor.png');

    // Act
    await page.getByRole('button', { name: text('engine', 'material', 'insertMarkdown'), exact: true }).click();
    const dialog = page.getByRole('dialog', { name: text('engine', 'material', 'insertMarkdown'), exact: true });

    // Assert
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel(text('engine', 'material', 'markdownSource'), { exact: true })).toBeFocused();
    await expectNoHorizontalOverflow(page, dialog);
    await expect(page).toHaveScreenshot('markdown-dialog.png');

    // Act
    await page.keyboard.press('Escape');

    // Assert
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: text('engine', 'material', 'insertMarkdown'), exact: true })).toBeFocused();

    // Act
    await page.getByRole('button', { name: text('engine', 'material', 'finishEditing'), exact: true }).click();

    // Assert
    await expect(editor).toHaveAttribute('contenteditable', 'false');
    expect(api.saves).toHaveLength(0);
});
test('Finishing editing waits for confirmed save and preserves draft across tabs @editor', async ({ page, api }) => {
    // Arrange
    await openReader(page);
    api.saveMode = 'hold';

    // Act
    await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
    const editor = page.locator(`#panel-${readerId}`).getByLabel(text('engine', 'material', 'contentLabel'));
    await editor.fill('Recoverable draft');
    await page.getByRole('button', { name: linkedTitle, exact: true }).click();

    // Assert
    await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();

    // Act
    await page.getByRole('tab', { name: `${readerTitle} •`, exact: true }).click();

    // Assert
    await expect(editor).toHaveText('Recoverable draft');

    // Act
    await page.getByRole('button', { name: text('engine', 'material', 'finishEditing'), exact: true }).click();

    // Assert
    await expect.poll(() => api.saves.length).toBe(1);
    await expect(page.locator('.save-state:visible')).toHaveText(text('engine', 'material', 'status', 'saving'));
    await expect(editor).toHaveAttribute('contenteditable', 'true');

    // Act
    api.releaseSave();

    // Assert
    await expect(page.locator('.save-state:visible')).toHaveText(text('engine', 'material', 'status', 'saved'));
    await expect(editor).toHaveAttribute('contenteditable', 'false');
    expect(api.saves).toEqual([expect.objectContaining({ expectedRevision: 7, document: expect.objectContaining({ type: 'doc' }) })]);

    // Act
    await page.reload();

    // Assert
    await expect(page.getByLabel(text('engine', 'material', 'contentLabel'))).toHaveText('Recoverable draft');
});
test('Save conflict retains editable content and prevents tab closure @editor', async ({ page, api }) => {
    // Arrange
    await openReader(page);
    api.saveMode = 'conflict';

    // Act
    await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
    const editor = page.locator(`#panel-${readerId}`).getByLabel(text('engine', 'material', 'contentLabel'));
    await editor.fill('Draft kept after conflict');
    await page.getByRole('button', { name: `${text('engine', 'workspace', 'closeTab')} ${readerTitle}`, exact: true }).click();

    // Assert
    await expect(page.locator('.save-state')).toHaveText(text('engine', 'material', 'status', 'conflict'));
    await expect(page.getByRole('alert')).toContainText(text('engine', 'material', 'errors', 'saveConflict'));
    await expect(editor).toHaveText('Draft kept after conflict');
    await expect(editor).toHaveAttribute('contenteditable', 'true');
    await expect(page.getByRole('tab', { name: `${readerTitle} •`, exact: true })).toBeVisible();
    expect(api.revision).toBe(7);
    expect(api.savedDocument).toEqual(api.data.materials.find(material => material.id === readerId)?.document);
    expect(api.saves).toHaveLength(1);
});
