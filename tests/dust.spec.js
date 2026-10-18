import { test, expect } from '@playwright/test';

test('dust renders through takeoff, landing and retreat within its particle budget', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Isolate the effect so the check does not depend on the rest of the desert scene.
  await page.route('**/__dust-test', route => route.fulfill({
    contentType: 'text/html',
    body: `<script type="module">
      import * as THREE from '/node_modules/.vite/deps/three.js';
      import { createSandworm } from '/src/sandworm.js';
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(480, 320);
      document.body.append(renderer.domElement);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x665544, 2));
      const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 300);
      camera.position.set(35, 30, 95); camera.lookAt(0, 8, 25);
      const worm = createSandworm(() => 0);
      const player = new THREE.Vector3(); worm.reset(player, 0);
      scene.add(worm.object);
      const dust = worm.object.getObjectByName('sandworm-dust-clouds');
      window.checkDust = () => {
        const counts = [];
        for (let frame = 0; frame < 660; frame++) {
          worm.update(1 / 60, player, 0);
          if (frame % 60 === 59) { renderer.render(scene, camera); counts.push(dust.geometry.drawRange.count); }
        }
        const peak = Math.max(...counts);
        const finite = [...dust.geometry.attributes.position.array].every(Number.isFinite);
        const budget = dust.geometry.attributes.position.count;
        worm.repel();
        for (let frame = 0; frame < 1800; frame++) worm.update(1 / 60, player, 0);
        renderer.render(scene, camera);
        const expired = dust.geometry.drawRange.count;
        worm.reset(player, 0);
        return { peak, finite, budget, expired, reset: dust.geometry.drawRange.count, calls: renderer.info.render.calls };
      };
    </script>`,
  }));
  await page.goto('http://127.0.0.1:5173/__dust-test');
  await page.waitForFunction(() => window.checkDust);
  const result = await page.evaluate(() => window.checkDust());
  expect(result.peak).toBeGreaterThan(100);
  expect(result.peak).toBeLessThanOrEqual(900);
  expect(result.budget).toBe(900);
  expect(result.finite).toBe(true);
  expect(result.expired).toBe(0);
  expect(result.reset).toBe(0);
  expect(errors).toEqual([]);
});
