import type { Locator } from '@playwright/test';

export async function selectChoice(control: Locator, id: string): Promise<void> {
  await control.click();
  await control.locator('..').locator(`[role="option"][data-choice-id="${id}"]`).click();
}
