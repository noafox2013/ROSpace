import { test, expect } from '@playwright/test';

test('loading an older defeated-worm save shows the curse once in the lower right corner', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 650 });
  await page.addInitScript(() => {
    if (localStorage.getItem('test-curse-seeded')) return;
    localStorage.setItem('test-curse-seeded', 'true');
    localStorage.setItem('rust-mesa-sandworm-curse-shown', 'true');
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({
      version: 1, name: 'Besiegter Sandwurm', state: { crystals: 5, health: 100 },
      position: [0, 1, 2], dayElapsed: 100, sandwormRepelled: true, curseShown: true,
    }));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  const message = page.locator('#curse-message');
  await expect(message).toBeVisible();
  await expect(message).toHaveText('DER FLUCH DES SANDWURMS HAT SICH ÜBER DICH GELEGT, DU WIRST NIE GUT ERWACHEN');
  const bounds = await message.boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(600);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(650);
  expect(bounds.x + bounds.width).toBeGreaterThan(570);
  expect(bounds.y + bounds.height).toBeGreaterThan(620);
  await page.keyboard.press('Escape');
  await page.locator('#quit-button').click();
  await page.reload();
  await page.locator('#load-button').click();
  await expect(message).not.toBeVisible();
});
