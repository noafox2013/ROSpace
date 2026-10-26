import { test, expect } from '@playwright/test';

test('canopy uses the electric window recording and interrupts it on reversal', async ({ page }) => {
  await page.route('**/canopy-audio-test', route => route.fulfill({ contentType: 'text/html', body: '<button>Audio</button>' }));
  await page.goto('http://127.0.0.1:5173/canopy-audio-test');
  await page.evaluate(async () => {
    const NativeAudio = window.AudioContext;
    window.canopySources = [];
    window.AudioContext = class extends NativeAudio {
      constructor() {
        super();
        const createSource = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = createSource();
          const stop = source.stop.bind(source);
          source.stop = when => { source.wasStopped = true; stop(when); };
          window.canopySources.push(source); return source;
        };
      }
    };
    const { createGameAudio } = await import('/src/audio.js');
    window.canopyAudio = createGameAudio();
    document.querySelector('button').onclick = () => window.canopyAudio.unlock();
  });
  await page.getByRole('button').click();
  await expect.poll(() => page.evaluate(() => {
    window.canopyAudio.play('canopy');
    return window.canopySources.some(source => Math.abs((source.buffer?.duration || 0) - 2.986667) < 0.001);
  })).toBe(true);
  expect(await page.evaluate(() => window.canopySources.at(-1).buffer.duration / window.canopySources.at(-1).playbackRate.value)).toBeCloseTo(2.8);
  await page.waitForTimeout(100);
  await page.evaluate(() => window.canopyAudio.play('canopy'));
  expect(await page.evaluate(() => window.canopySources.at(-2).wasStopped)).toBe(true);
  await page.evaluate(() => window.canopyAudio.silence());
  expect(await page.evaluate(() => window.canopySources.at(-1).wasStopped)).toBe(true);
});
