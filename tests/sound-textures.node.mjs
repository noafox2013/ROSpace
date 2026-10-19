import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSoundTextures } from '../src/sound-textures.js';

test('all material textures contain finite, bounded, distinct audio', () => {
  const context = {
    sampleRate: 8000,
    createBuffer(channels, length) {
      const samples = new Float32Array(length);
      return { getChannelData: () => samples };
    },
  };
  const textures = createSoundTextures(context);
  assert.equal(textures.size, 8);
  const energies = [];
  for (const buffer of textures.values()) {
    const samples = buffer.getChannelData(0);
    assert.equal(samples.length, 40000);
    assert(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
    const energy = samples.reduce((sum, value) => sum + value * value, 0) / samples.length;
    assert(energy > 0.0001);
    energies.push(energy);
  }
  assert.equal(new Set(energies).size, 8);
});
