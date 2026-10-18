import { test, expect } from '@playwright/test';

test('save selection is restricted to the main menu and saving uses the active slot', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    if (localStorage.getItem('slot-test-seeded')) return;
    localStorage.setItem('slot-test-seeded', 'true');
    const saves = Array(10).fill(null);
    saves[0] = { version: 1, name: 'First expedition', state: { health: 80 }, position: [0, 1, 2], dayElapsed: 0 };
    saves[9] = { version: 1, name: 'Tenth expedition', state: { health: 90 }, position: [0, 1, 2], dayElapsed: 0 };
    localStorage.setItem('rust-mesa-saves-v2', JSON.stringify(saves));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-slot').selectOption('9');
  await page.locator('#load-button').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#save-slot')).toBeDisabled();
  await expect(page.locator('#save-slot')).toHaveValue('9');
  await expect(page.locator('#save-name')).toHaveValue('Tenth expedition');
  // Even a stale or programmatically changed UI value cannot redirect a save.
  await page.locator('#save-slot').evaluate(select => { select.value = '0'; });
  await page.locator('#save-name').fill('Updated tenth');
  await page.locator('#quit-button').click();
  const saves = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2')));
  expect(saves[0].name).toBe('First expedition');
  expect(saves[9].name).toBe('Updated tenth');
  await expect(page.locator('#save-slot')).toHaveValue('9');
  await page.locator('#load-slot').selectOption('0');
  await expect(page.locator('#load-button')).toHaveText('Spielstand laden: First expedition');
});
