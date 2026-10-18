import { test, expect } from '@playwright/test';

test('C asks before deleting the selected save and preserves the other slots', async ({ page }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    if (localStorage.getItem('delete-test-seeded')) return;
    localStorage.setItem('delete-test-seeded', 'true');
    const slots = Array(10).fill(null);
    slots[0] = { version: 1, name: 'First save' };
    slots[9] = { version: 1, name: 'Tenth save' };
    localStorage.setItem('rust-mesa-saves-v2', JSON.stringify(slots));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-slot').selectOption('9');
  await page.keyboard.press('c');
  await expect(page.locator('#delete-save-dialog')).toBeVisible();
  await expect(page.locator('#delete-save-name')).toHaveText('10 · Tenth save');
  await expect(page.locator('#delete-save-cancel')).toBeFocused();
  await page.locator('#delete-save-cancel').click();
  await expect(page.locator('#load-slot option')).toHaveCount(2);
  await page.keyboard.press('c');
  await page.keyboard.press('Escape');
  await expect(page.locator('#delete-save-dialog')).not.toBeVisible();
  await page.keyboard.press('c');
  await page.locator('#delete-save-confirm').click();
  await expect(page.locator('#load-slot option')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#load-slot option')).toHaveCount(1);
  await expect(page.locator('#load-button')).toHaveText('Spielstand laden: First save');
  await page.keyboard.press('c');
  await page.locator('#delete-save-confirm').click();
  await expect(page.locator('#load-slot')).toBeHidden();
  await expect(page.locator('#load-button')).toBeHidden();
});

test('C does not open save deletion during gameplay or in the pause menu', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await page.keyboard.press('c');
  await expect(page.locator('#delete-save-dialog')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#quit-button').click();
  await page.locator('#load-button').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#save-slot')).toBeDisabled();
  await page.keyboard.press('c');
  await expect(page.locator('#delete-save-dialog')).not.toBeVisible();
  await expect(page.locator('#pause-menu')).toBeVisible();
  const saves = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2')));
  expect(saves.filter(Boolean)).toHaveLength(1);
});
