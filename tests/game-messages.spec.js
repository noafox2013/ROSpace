import { test, expect } from '@playwright/test';

test('pause menu keeps past game messages beside the settings and clears them for a new run', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.addInitScript(() => {
    if (localStorage.getItem('messages-test-seeded')) return;
    localStorage.setItem('messages-test-seeded', 'true');
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({
      version: 1, name: 'Past victory', state: { health: 100 }, position: [0, 1, 2],
      dayElapsed: 0, sandwormRepelled: true, curseMessageSeen: true,
    }));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  await expect(page.locator('#curse-message')).toBeHidden();
  await page.keyboard.press('Escape');
  const messages = page.locator('#game-message-list');
  await expect(messages.locator('li')).toHaveCount(1);
  await expect(messages).toContainText('DER FLUCH DES SANDWURMS');
  const settings = await page.locator('.pause-settings').boundingBox();
  const panel = await page.locator('.game-messages').boundingBox();
  expect(panel.x).toBeGreaterThan(settings.x + settings.width);
  await page.locator('#language-select').selectOption('en');
  await expect(page.locator('#game-messages-title')).toHaveText('Game messages');
  await expect(messages).toContainText('THE CURSE OF THE SANDWORM');
  await page.setViewportSize({ width: 390, height: 850 });
  const mobilePanel = await page.locator('.game-messages').boundingBox();
  expect(mobilePanel.x).toBeGreaterThanOrEqual(0);
  expect(mobilePanel.x + mobilePanel.width).toBeLessThanOrEqual(390);
  await page.locator('#quit-button').click();
  await page.locator('#start-button').click();
  await page.keyboard.press('Escape');
  await expect(messages.locator('li')).toHaveCount(0);
  await expect(page.locator('#game-messages-empty')).toBeVisible();
});
