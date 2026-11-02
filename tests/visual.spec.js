import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
];

async function readCanvasStats(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(4 * 432);
    const samples = [];

    for (let y = 0; y < 18; y += 1) {
      for (let x = 0; x < 24; x += 1) {
        samples.push([
          Math.floor(((x + 0.5) * width) / 24),
          Math.floor(((y + 0.5) * height) / 18),
        ]);
      }
    }

    for (let i = 0; i < samples.length; i += 1) {
      gl.readPixels(samples[i][0], samples[i][1], 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels, i * 4);
    }

    const colors = new Set();
    let brightPixels = 0;
    let nonBlackPixels = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      colors.add(`${r >> 4},${g >> 4},${b >> 4}`);
      if (r + g + b > 18) nonBlackPixels += 1;
      if (r + g + b > 180) brightPixels += 1;
    }

    return {
      colors: colors.size,
      nonBlackPixels,
      brightPixels,
      width,
      height,
    };
  });
}

for (const viewport of viewports) {
  test(`renders playable 3D scene on ${viewport.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /shader|WebGLProgram/i.test(message.text())) errors.push(message.text()); });
    if (process.env.ROSPACE_CAPTURE && viewport.name === 'desktop') {
      await page.route('**/src/main.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + `
          window.captureSoil = () => {
            const position=camera.position.clone(), rotation=camera.quaternion.clone();
            const day=dayStartedAt, ratio=renderer.getPixelRatio();
            dayStartedAt=performance.now()-(daylightDuration*0.4-initialSunAngle/Math.PI*daylightDuration)*1000;
            updateSunAndKeyLight();
            const x=spacecraft.group.position.x-18, z=spacecraft.group.position.z+12;
            const y=terrainHeight(x,z);
            camera.position.set(x,y+1.3,z+3.2); camera.lookAt(x,y+0.1,z-1);
            skyDome.position.copy(camera.position); renderer.setPixelRatio(1);
            renderer.render(scene,camera); const data=canvas.toDataURL();
            camera.position.copy(position); camera.quaternion.copy(rotation); dayStartedAt=day;
            renderer.setPixelRatio(ratio); return data;
          };
        ` });
      });
    }

    await page.goto('http://127.0.0.1:5173/');
    await expect(page.locator('#overlay-title')).toBeVisible();
    await page.locator('#start-button').click();
    await expect(page.locator('#overlay')).not.toHaveClass(/visible/);
    await page.keyboard.down('w');
    await page.waitForTimeout(900);
    await page.keyboard.up('w');

    const score = Number(await page.locator('#score').textContent());
    expect(score).toBeGreaterThan(0);

    const stats = await readCanvasStats(page);
    expect(stats.width).toBeGreaterThan(300);
    expect(stats.height).toBeGreaterThan(300);
    await page.screenshot({ path: `test-results/orbital-drift-${viewport.name}.png`, fullPage: true });
    expect(stats.nonBlackPixels).toBeGreaterThan(120);
    expect(stats.brightPixels).toBeGreaterThan(0);
    expect(stats.colors).toBeGreaterThan(5);
    if (process.env.ROSPACE_CAPTURE && viewport.name === 'desktop') {
      const data=await page.evaluate(() => window.captureSoil());
      writeFileSync('/tmp/rospace-textured-ground.png',Buffer.from(data.split(',')[1],'base64'));
    }
    expect(errors).toEqual([]);
    await context.close();
  });
}
