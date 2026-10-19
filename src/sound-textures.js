// Material excitation signals. These are procedural textures, not recordings.
// Uneven grain collisions and correlated turbulence avoid uniform white-noise hiss.
export function createSoundTextures(context) {
  const textures = new Map();
  for (const kind of ['sand', 'stone', 'metal', 'glass', 'cloth', 'exhaust', 'earth', 'breath']) {
    const buffer = context.createBuffer(1, context.sampleRate * 5, context.sampleRate);
    const samples = buffer.getChannelData(0);
    // Damped, inharmonic material modes excited by individual collisions.
    const modalFrequencies = kind === 'metal' ? [181, 467, 1093, 2369] : kind === 'glass' ? [1331, 2179, 3263] : kind === 'stone' ? [237, 619, 1157] : [];
    const modes = modalFrequencies.filter(f => f < context.sampleRate * 0.45).map((frequency, index) => {
      const decay = Math.exp(-1 / (context.sampleRate * (kind === 'metal' ? 0.17 : kind === 'glass' ? 0.11 : 0.025) / (1 + index * 0.4)));
      return { a: 2 * decay * Math.cos(2 * Math.PI * frequency / context.sampleRate), b: decay * decay, y1: 0, y2: 0 };
    });
    let low = 0, mid = 0, pulse = 0, grain = 0, drift = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      low += (white - low) * 0.018;
      mid += (white - mid) * 0.16;
      drift += ((Math.random() * 2 - 1) - drift) * 0.0007;
      const density = kind === 'sand' ? 1700 : kind === 'glass' ? 170 : kind === 'stone' ? 310 : 65;
      let excitation = 0;
      if (Math.random() < density / context.sampleRate) {
        grain = (Math.random() * 2 - 1) * (0.15 + Math.random() ** 3 * 0.85);
        pulse += grain; excitation = grain;
      }
      pulse *= kind === 'glass' ? 0.74 : 0.93;
      const t = i / context.sampleRate;
      let value;
      switch (kind) {
        case 'sand': value = (white - mid) * (0.12 + Math.abs(pulse) * 0.8) + pulse * 0.55; break;
        case 'metal': value = pulse * 0.14 + white * 0.018; break;
        case 'stone': value = pulse * 0.72 + low * 2.2 + white * 0.035; break;
        case 'glass': value = pulse * 0.8 + (white - mid) * 0.025; break;
        case 'cloth': value = mid * (0.25 + Math.abs(Math.sin(t * 19 + drift * 8)) * 0.7) + white * Math.abs(pulse) * 0.18; break;
        case 'exhaust': value = (mid * 1.9 + low * 2.8 + white * 0.1) * (0.65 + Math.abs(drift) * 2); break;
        case 'earth': value = low * 3.2 + pulse * 0.32 + mid * 0.12; break;
        default: value = (white - low) * (0.42 + drift * 0.7) + mid * 0.6;
      }
      for (const mode of modes) {
        const response = excitation * 0.025 + mode.a * mode.y1 - mode.b * mode.y2;
        mode.y2 = mode.y1; mode.y1 = response;
        value += response * (kind === 'stone' ? 0.35 : 0.55);
      }
      samples[i] = Math.tanh(value * 1.2) * 0.8;
    }
    // Join loop ends without a discontinuity.
    const join = Math.floor(context.sampleRate * 0.035);
    for (let i = 0; i < join; i++) {
      const mix = i / (join - 1);
      samples[samples.length - join + i] = samples[samples.length - join + i] * (1 - mix) + samples[0] * mix;
    }
    textures.set(kind, buffer);
  }
  return textures;
}
