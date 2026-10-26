import { test, expect } from '@playwright/test';

test('cockpit muffles the complete mix and restores normal audio on exit', async ({ page }) => {
  await page.route('**/cockpit-audio-test', route => route.fulfill({ contentType: 'text/html', body: '<button>Audio</button>' }));
  await page.goto('http://127.0.0.1:5173/cockpit-audio-test');
  await page.evaluate(async () => {
    const NativeAudio = window.AudioContext;
    window.AudioContext = class extends NativeAudio {
      constructor() {
        super();
        window.audioGains = [];
        const createGain = this.createGain.bind(this);
        this.createGain = () => { const gain = createGain(); window.audioGains.push(gain); return gain; };
        window.audioContext = this;
      }
    };
    const { createGameAudio } = await import('/src/audio.js');
    window.cabinAudio = createGameAudio();
    document.querySelector('button').onclick = () => {
      window.cabinAudio.unlock();
      const context = window.audioContext;
      window.cabinAnalyser = context.createAnalyser();
      window.audioGains[1].connect(window.cabinAnalyser);
      const oscillator = context.createOscillator(); oscillator.frequency.value = 4000;
      const level = context.createGain(); level.gain.value = 0.08;
      oscillator.connect(level).connect(window.audioGains[0]); oscillator.start();
    };
    window.readEnergy = () => {
      const samples = new Float32Array(window.cabinAnalyser.fftSize);
      window.cabinAnalyser.getFloatTimeDomainData(samples);
      return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    };
  });
  await page.getByRole('button').click();
  await expect.poll(() => page.evaluate(() => window.readEnergy())).toBeGreaterThan(0.01);
  const normal = await page.evaluate(() => window.readEnergy());
  await page.evaluate(() => window.cabinAudio.setCockpit(true));
  await expect.poll(() => page.evaluate(() => window.readEnergy())).toBeLessThan(normal * 0.08);
  await page.evaluate(() => { window.cabinAudio.setMuted(true); window.cabinAudio.setCockpit(false); });
  await expect.poll(() => page.evaluate(() => window.readEnergy())).toBeLessThan(0.0001);
  await page.evaluate(() => window.cabinAudio.setMuted(false));
  await expect.poll(() => page.evaluate(() => window.readEnergy())).toBeGreaterThan(normal * 0.8);
});
