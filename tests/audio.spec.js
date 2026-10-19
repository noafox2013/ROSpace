import { test, expect } from '@playwright/test';
const server = process.env.TEST_SERVER_URL || 'http://127.0.0.1:5173';

test('sounds produce audio, mute fades out, and all action sounds run without errors', async ({ page }) => {
  await page.route('**/audio-test', route => route.fulfill({ contentType: 'text/html', body: '<button>Enable audio</button>' }));
  await page.goto(`${server}/audio-test`);
  await page.evaluate(async () => {
    const NativeAudio = window.AudioContext;
    window.AudioContext = class extends NativeAudio {
      constructor() {
        super();
        window.testContext = this;
        window.testSampleSources = [];
        const createSource = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = createSource();
          const stop = source.stop.bind(source);
          source.stop = when => { source.testStopDelay = when - this.currentTime; stop(when); };
          window.testSampleSources.push(source); return source;
        };
        window.testPanners = [];
        const createPanner = this.createStereoPanner.bind(this);
        this.createStereoPanner = () => {
          const panner = createPanner(); window.testPanners.push(panner); return panner;
        };
        window.testAnalyser = this.createAnalyser();
        const createCompressor = this.createDynamicsCompressor.bind(this);
        this.createDynamicsCompressor = () => {
          const compressor = createCompressor();
          compressor.connect(window.testAnalyser);
          return compressor;
        };
      }
    };
    const { createGameAudio } = await import('/src/audio.js');
    window.testAudio = createGameAudio();
    document.querySelector('button').onclick = () => { window.testAudio.unlock(); };
    window.energy = () => {
      const data = new Float32Array(window.testAnalyser.fftSize);
      window.testAnalyser.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
    };
  });
  await page.locator('button').click();
  await expect.poll(() => page.evaluate(() => window.testContext.state)).toBe('running');
  await page.evaluate(() => window.testAudio.play('horn'));
  await expect.poll(() => page.evaluate(() => window.energy())).toBeGreaterThan(0.001);
  await page.evaluate(() => window.testAudio.setMuted(true));
  await expect.poll(() => page.evaluate(() => window.energy())).toBeLessThan(0.0001);
  await page.evaluate(() => {
    window.testAudio.setMuted(false);
    for (const name of ['step', 'metalStep', 'shot', 'beamStart', 'beamStop', 'jetStart', 'jetStop', 'impact', 'groundImpact', 'rock', 'crystal', 'hurt', 'death', 'buy', 'message', 'sleep', 'seat', 'ui']) window.testAudio.play(name);
    window.testAudio.update({ playing: true, indoors: false, jetpack: 1, beam: true, shake: 0.5, wormDistance: 20, wormPresent: true });
  });
  await expect.poll(() => page.evaluate(() => window.energy())).toBeGreaterThan(0.001);
  // The beam uses the supplied SciFiLaserBeam WAV, decoded and looped.
  await expect.poll(() => page.evaluate(() => {
    window.testAudio.update({ playing: true, indoors: false, jetpack: 0, beam: true, shake: 0, wormDistance: 500, wormPresent: false });
    return window.testSampleSources.some(source => source.loop && Math.abs((source.buffer?.duration ?? 0) - 3.7546666666666666) < 0.002);
  })).toBe(true);
  await page.evaluate(() => window.testAudio.update({
    playing: true, indoors: true, jetpack: 0, beam: false, shake: 1,
    wormDistance: 10, wormPresent: true, listenerPosition: { x: 0, y: 0, z: 0 },
    listenerRight: { x: 1, z: 0 }, wormPosition: { x: -10, y: 0, z: 0 },
  }));
  await expect.poll(() => page.evaluate(() => window.testPanners.filter(node => node.pan.value < -0.3).length)).toBeGreaterThanOrEqual(3);
  const beam = await page.evaluate(() => {
    const source = window.testSampleSources.find(source => source.loop && Math.abs((source.buffer?.duration ?? 0) - 3.754667) < 0.002);
    return { loopEnd: source.loopEnd, fade: source.testStopDelay };
  });
  expect(beam.loopEnd).toBeCloseTo(3.1);
  expect(beam.fade).toBeGreaterThan(0.27);
  await expect.poll(() => page.evaluate(() => {
    window.testAudio.update({ playing: true, moving: true, sprinting: false, jetpack: 0, beam: false, shake: 0, wormDistance: 500 });
    const voice = window.testSampleSources.find(source => source.loop && Math.abs((source.buffer?.duration ?? 0) - 6.069025) < 0.002);
    window.testWalkingSource = voice;
    return voice?.playbackRate.value;
  })).toBeCloseTo(1, 2);
  await page.evaluate(() => window.testAudio.update({ playing: true, moving: true, sprinting: true, jetpack: 0, beam: false, shake: 0, wormDistance: 500 }));
  await expect.poll(() => page.evaluate(() => window.testWalkingSource.playbackRate.value)).toBeGreaterThan(1.75);
  await expect.poll(() => page.evaluate(() => {
    window.testAudio.play('rock', 1, { x: 4, y: 0, z: 0 });
    return window.testSampleSources.some(source => !source.loop && Math.abs((source.buffer?.duration ?? 0) - 0.948229) < 0.002);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    window.testAudio.play('crystal', 1, { x: -4, y: 0, z: 0 });
    return window.testSampleSources.some(source => !source.loop && Math.abs((source.buffer?.duration ?? 0) - 2.277333) < 0.002);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    window.testAudio.update({ playing: true, indoors: true, moving: true, sprinting: false, jetpack: 0, beam: false, shake: 0, wormDistance: 500 });
    return window.testSampleSources.some(source => source.loop && Math.abs((source.buffer?.duration ?? 0) - 16.25) < 0.002);
  })).toBe(true);
  expect(await page.evaluate(() => window.testWalkingSource.testStopDelay)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => {
    window.testAudio.update({ playing: true, indoors: false, jetpack: 0, beam: false, shake: 0, wormDistance: 500 });
    return window.testSampleSources.some(source => source.loop && Math.abs((source.buffer?.duration ?? 0) - 34.482766) < 0.002);
  })).toBe(true);
  const rockRate = size => page.evaluate(size => {
    window.testAudio.play('rock', 1, null, size);
    const sources = window.testSampleSources.filter(source => Math.abs((source.buffer?.duration ?? 0) - 0.948229) < 0.002);
    return sources.at(-1)?.playbackRate.value;
  }, size);
  await expect.poll(() => rockRate(0.4)).toBeGreaterThan(1.5);
  await expect.poll(() => rockRate(3)).toBeLessThan(1);
  await expect.poll(() => page.evaluate(() => {
    window.testAudio.update({ playing: true, storm: 1, jetpack: 0, beam: false, shake: 0, wormDistance: 500 });
    return window.testSampleSources.some(source => source.loop && Math.abs((source.buffer?.duration ?? 0) - 28.496190) < 0.002);
  })).toBe(true);
  await page.evaluate(() => window.testAudio.silence());
  await page.evaluate(() => window.testContext.close());
});

test('game loads with sound setting and no runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${server}/`);
  await expect(page.locator('#start-button')).toBeVisible();
  await page.locator('#start-button').click();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
  await expect(page.locator('#sound-toggle')).toBeAttached();
});
