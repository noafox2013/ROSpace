import stormUrl from './assets/FF_ES_fx_sandstorm_ivory.wav?url';
import windUrl from './assets/Wind_06.wav?url';
import { createSoundTextures } from './sound-textures.js';
import laserBeamUrl from './assets/SciFiLaserBeam_S08SF.339.wav?url';
import crystalBreakUrl from './assets/GlassBreakLarge_SFXB.2341.wav?url';
import indoorWalkingUrl from './assets/ESM_Footstep_on_Concrete_1_Organic_Foley_Sound_Design_Post_Production_Human_Walk.wav?url';
import walkingUrl from './assets/SS_SOA_walking_on_gravel.wav?url';
import rockBreakUrl from './assets/ESM_GB_fx_foley_one_shot_rockbrk_crafting_foley_rock_07_natural_organic_material.wav?url';
// Local sound design: recorded laser beam plus procedural material textures.
// Audio is created only after a user gesture; no downloads are required.
export function createGameAudio() {
  let context, master, noise, reflections;
  let textures = new Map();
  let laserBuffer = null, laserVoice = null;
  let walkingBuffer = null, indoorWalkingBuffer = null, walkingVoice = null;
  let rockBreakBuffer = null, crystalBreakBuffer = null;
  let windBuffer = null, windVoice = null;
  let stormBuffer = null, stormVoice = null;
  let stepSide = 1;
  let jetSpool = 0, jetFiring = false, wasPlaying = false, lastUpdate = 0;
  let listener = { x: 0, y: 0, z: 0, rightX: 1, rightZ: 0 };
  let roomAmount = 0;
  const loops = new Map();
  const lastPlayed = new Map();
  let muted = false;
  function unlock() {
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      if (!context) {
        context = new Audio();
        master = context.createGain();
        master.gain.value = muted ? 0 : 0.55;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -16;
        limiter.ratio.value = 6;
        master.connect(limiter).connect(context.destination);
        // Quiet, diffuse early reflections instead of a long artificial echo.
        reflections = context.createGain();
        reflections.gain.value = 0.025;
        const impulse = context.createBuffer(2, Math.floor(context.sampleRate * 0.65), context.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
          const data = impulse.getChannelData(channel);
          for (let i = 0; i < data.length; i++) {
            const t = i / context.sampleRate;
            data[i] = t < 0.025 ? 0 : (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.25;
          }
        }
        const room = context.createConvolver(); room.buffer = impulse;
        reflections.connect(room).connect(master);
        noise = context.createBuffer(1, context.sampleRate * 5, context.sampleRate);
        textures = createSoundTextures(context);
        fetch(laserBeamUrl)
          .then(response => { if (!response.ok) throw new Error('Laser audio unavailable'); return response.arrayBuffer(); })
          .then(bytes => context.decodeAudioData(bytes))
          .then(buffer => { laserBuffer = buffer; })
          .catch(() => { /* Keep the rest of the audio working if the asset cannot load. */ });
        fetch(walkingUrl)
          .then(response => { if (!response.ok) throw new Error('Walking audio unavailable'); return response.arrayBuffer(); })
          .then(bytes => context.decodeAudioData(bytes))
          .then(buffer => { walkingBuffer = buffer; })
          .catch(() => { /* Walking remains playable without audio. */ });
        fetch(rockBreakUrl)
          .then(response => { if (!response.ok) throw new Error('Rock audio unavailable'); return response.arrayBuffer(); })
          .then(bytes => context.decodeAudioData(bytes))
          .then(buffer => { rockBreakBuffer = buffer; })
          .catch(() => { /* Procedural rock sound remains available as a fallback. */ });
        fetch(crystalBreakUrl)
          .then(response => { if (!response.ok) throw new Error('Crystal audio unavailable'); return response.arrayBuffer(); })
          .then(bytes => context.decodeAudioData(bytes))
          .then(buffer => { crystalBreakBuffer = buffer; })
          .catch(() => { /* Procedural crystal sound remains available as a fallback. */ });
        fetch(indoorWalkingUrl)
          .then(response => { if (!response.ok) throw new Error('Indoor walking audio unavailable'); return response.arrayBuffer(); })
          .then(bytes => context.decodeAudioData(bytes))
          .then(buffer => { indoorWalkingBuffer = buffer; })
          .catch(() => { /* Keep the game working if the indoor recording cannot load. */ });
        fetch(windUrl)
          .then(response => { if (!response.ok) throw new Error('Wind audio unavailable'); return response.arrayBuffer(); })
          .then(bytes => context.decodeAudioData(bytes))
          .then(buffer => { windBuffer = buffer; })
          .catch(() => { /* The game can continue if the wind asset cannot load. */ });
        fetch(stormUrl)
          .then(response => { if (!response.ok) throw new Error('Storm audio unavailable'); return response.arrayBuffer(); })
          .then(bytes => context.decodeAudioData(bytes))
          .then(buffer => { stormBuffer = buffer; })
          .catch(() => { /* Weather continues if audio loading fails. */ });
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* Sound is optional when the browser has no audio device. */ }
  }
  function layer({ duration = 0.2, frequency = 200, end = frequency, gain = 0.15, type = 'noise', filter = 'lowpass', q = 0.7, delay = 0, attack = 0.008, pan = 0, body = 3500, sustain = 0, vibrato = 0, air = 18000, wet = 1 }) {
    if (!context || context.state !== 'running') return;
    const now = context.currentTime + delay;
    const sampled = type === 'noise' || textures.has(type);
    const source = sampled ? context.createBufferSource() : context.createOscillator();
    const tone = context.createBiquadFilter();
    const envelope = context.createGain();
    tone.type = filter; tone.Q.value = q;
    if (sampled) {
      source.buffer = textures.get(type) || noise;
      tone.frequency.setValueAtTime(frequency, now);
      tone.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    } else {
      source.type = type;
      source.frequency.setValueAtTime(frequency, now);
      source.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
      tone.frequency.value = body;
    }
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(gain, now + Math.min(attack, duration / 4));
    if (sustain) envelope.gain.setValueAtTime(gain * 0.85, now + duration * sustain);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const panner = context.createStereoPanner(); panner.pan.value = pan;
    const absorption = context.createBiquadFilter();
    absorption.type = 'lowpass'; absorption.frequency.value = air;
    source.connect(tone).connect(absorption).connect(envelope).connect(panner).connect(master);
    const send = context.createGain(); send.gain.value = wet;
    panner.connect(send).connect(reflections);
    let modulation, depth;
    if (vibrato && !sampled) {
      modulation = context.createOscillator(); depth = context.createGain();
      modulation.frequency.value = 4.7; depth.gain.value = vibrato;
      modulation.connect(depth).connect(source.frequency);
      modulation.start(now); modulation.stop(now + duration + 0.02);
    }
    if (sampled) source.start(now, Math.random() * Math.max(0, 5 - duration));
    else source.start(now); source.stop(now + duration + 0.02);
    source.onended = () => { source.disconnect(); tone.disconnect(); absorption.disconnect(); envelope.disconnect(); panner.disconnect(); send.disconnect(); modulation?.disconnect(); depth?.disconnect(); };
  }
  function play(name, amount = 1, position = null, rockSize = 1) {
    if (!context || context.state !== 'running') return;
    const now = context.currentTime;
    if (now - (lastPlayed.get(name) ?? -100) < ((name === 'impact' || name === 'groundImpact') ? 0.13 : 0.065)) return;
    lastPlayed.set(name, now);
    const dx = position ? position.x - listener.x : 0;
    const dy = position ? position.y - listener.y : 0;
    const dz = position ? position.z - listener.z : 0;
    const distance = Math.hypot(dx, dy, dz);
    const spatialPan = distance > 0 ? Math.max(-0.9, Math.min(0.9, (dx * listener.rightX + dz * listener.rightZ) / distance)) : 0;
    const behind = position && distance > 0 ? Math.max(0, -(dx * listener.rightZ - dz * listener.rightX) / distance) : 0;
    const interfaceSound = ['ui', 'buy', 'message'].includes(name);
    const attenuation = position ? 1 / (1 + distance / 22) : 1;
    const rockPitch = Math.max(0.65, Math.min(1.9, 1.35 / Math.sqrt(Math.max(0.1, Number.isFinite(rockSize) ? rockSize : 1))));
    const variation = (0.94 + Math.random() * 0.12) * (name === 'rock' ? rockPitch : 1);
    const material = { step: 'sand', metalStep: 'metal', shot: 'exhaust', impact: 'stone', rock: 'stone', crystal: 'glass', hurt: 'cloth', death: 'earth', horn: 'breath', buy: 'cloth', message: 'breath', sleep: 'cloth', seat: 'cloth' }[name] || 'cloth';
    const sound = (options) => layer({ ...options, type: options.type || material, pan: position ? spatialPan : (options.pan ?? 0), wet: interfaceSound ? 0 : 1, air: 18000 / (1 + distance / 18 + behind * 1.8), delay: (options.delay ?? 0) + Math.min(0.5, distance / 343), frequency: (options.frequency ?? 200) * variation, gain: (options.gain ?? 0.15) * amount * attenuation * (0.9 + Math.random() * 0.1) });
    const recordedBreak = name === 'rock' ? rockBreakBuffer : name === 'crystal' ? crystalBreakBuffer : null;
    if (recordedBreak) {
      const source = context.createBufferSource(); source.buffer = recordedBreak;
      source.playbackRate.value = name === 'rock' ? rockPitch : 1;
      const gain = context.createGain(); gain.gain.value = 0.85 * amount * attenuation;
      const pan = context.createStereoPanner(); pan.pan.value = spatialPan;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass';
      filter.frequency.value = 18000 / (1 + distance / 18 + behind * 1.8);
      source.connect(filter).connect(gain).connect(pan).connect(master);
      pan.connect(reflections);
      source.start(context.currentTime + Math.min(0.5, distance / 343));
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); };
      return;
    }
    switch (name) {
      case 'step': {
        stepSide *= -1;
        const pan = stepSide * 0.18;
        sound({ duration: 0.12, frequency: 650, end: 180, gain: 0.38, pan });
        sound({ duration: 0.24, frequency: 2100, end: 850, filter: 'bandpass', gain: 0.12, delay: 0.025, pan });
        for (let i = 0; i < 7; i++) sound({ duration: 0.018 + Math.random() * 0.03, frequency: 3200, gain: 0.06, delay: 0.045 + Math.random() * 0.1, pan });
        sound({ type: 'sine', frequency: 78, end: 48, duration: 0.08, gain: 0.09, pan }); break;
      }
      case 'metalStep':
        sound({ duration: 0.07, frequency: 1000, end: 250, gain: 0.23 });
        for (const [i, f] of [143, 327, 571, 914].entries()) sound({ type: 'metal', filter: 'bandpass', q: 5, frequency: f, duration: 0.28 / (1 + i * 0.3), gain: 0.07 / (i + 1) });
        sound({ duration: 0.13, frequency: 2100, filter: 'bandpass', delay: 0.07, gain: 0.06 }); break;
      case 'shot':
        // A fast electrical crack, pressure body and short resonant discharge.
        sound({ type: 'noise', filter: 'highpass', frequency: 3200, duration: 0.022, attack: 0.001, gain: 0.19 });
        sound({ type: 'exhaust', frequency: 950, end: 180, duration: 0.12, attack: 0.002, gain: 0.25 });
        sound({ type: 'sine', frequency: 155, end: 65, duration: 0.085, gain: 0.13 });
        sound({ type: 'triangle', frequency: 720, end: 430, duration: 0.075, gain: 0.045, delay: 0.008, body: 1600 });
        sound({ type: 'breath', filter: 'bandpass', frequency: 2400, end: 1100, duration: 0.17, gain: 0.065, delay: 0.025 }); break;
      case 'beamStart':
        sound({ type: 'noise', filter: 'highpass', frequency: 2500, duration: 0.025, gain: 0.1, attack: 0.001 });
        sound({ type: 'triangle', frequency: 240, end: 610, duration: 0.11, gain: 0.055 }); break;
      case 'beamStop':
        sound({ type: 'exhaust', filter: 'bandpass', frequency: 2200, end: 650, duration: 0.14, gain: 0.07 }); break;
      case 'jetStart':
        sound({ type: 'noise', filter: 'highpass', frequency: 900, end: 1800, duration: 0.16, gain: 0.045, attack: 0.025 });
        sound({ type: 'exhaust', frequency: 450, end: 1250, duration: 0.3, gain: 0.25, attack: 0.035, sustain: 0.25 }); break;
      case 'jetStop':
        sound({ type: 'noise', filter: 'lowpass', frequency: 1500, end: 300, duration: 0.23, gain: 0.055, attack: 0.008 }); break;
      case 'groundImpact':
        sound({ type: 'sand', filter: 'bandpass', frequency: 2600, end: 1100, duration: 0.21, attack: 0.003, gain: 0.38 });
        sound({ type: 'earth', frequency: 420, end: 95, duration: 0.12, gain: 0.26 });
        sound({ type: 'sand', filter: 'highpass', frequency: 1800, duration: 0.14, delay: 0.035, gain: 0.12 }); break;
      case 'impact': sound({ frequency: 1700, end: 280, duration: 0.11, gain: 0.19 }); sound({ type: 'stone', filter: 'bandpass', q: 4, frequency: 240, end: 170, duration: 0.08, gain: 0.06 }); break;
      case 'rock':
        sound({ type: 'earth', duration: 0.22, frequency: 280, end: 65, gain: 0.38 });
        sound({ frequency: 1300, end: 120, duration: 0.65, gain: 0.35 });
        for (let i = 0; i < 11; i++) sound({ frequency: 650 + Math.random() * 2500, duration: 0.035 + Math.random() * 0.09, gain: 0.04 + Math.random() * 0.08, delay: 0.07 + i * 0.07 + Math.random() * 0.08, pan: Math.random() * 1.2 - 0.6 }); break;
      case 'crystal':
        sound({ frequency: 3500, duration: 0.3, gain: 0.17 });
        for (const [i, f] of [1280, 1743, 2390, 3217].entries()) sound({ type: 'glass', filter: 'bandpass', q: 22, frequency: f, duration: 0.38 + Math.random() * 0.5, gain: 0.045, delay: i * 0.035, pan: Math.random() - 0.5 }); break;
      case 'hurt':
        sound({ type: 'earth', frequency: 170, end: 55, duration: 0.11, gain: 0.18 });
        sound({ frequency: 350, end: 70, duration: 0.22, gain: 0.38 }); sound({ filter: 'bandpass', frequency: 900, q: 1.2, duration: 0.38, gain: 0.12, delay: 0.06 }); break;
      case 'death': sound({ type: 'sine', frequency: 110, end: 25, duration: 1.1, gain: 0.16 }); sound({ frequency: 700, end: 60, duration: 0.6, gain: 0.24 }); break;
      case 'horn':
        sound({ type: 'breath', filter: 'bandpass', frequency: 950, q: 1.3, duration: 0.3, gain: 0.075, attack: 0.09 });
        for (const [i, f] of [110, 220, 330, 440].entries()) sound({ type: 'sine', frequency: f * 0.92, end: f, duration: 3.4 - i * 0.09, gain: 0.23 / (i + 1), delay: i * 0.025, attack: 0.22, sustain: 0.65, vibrato: 0.7 * (i + 1) });
        sound({ filter: 'bandpass', frequency: 280, q: 3, duration: 3.1, gain: 0.1, attack: 0.2, sustain: 0.6 }); break;
      case 'buy':
        sound({ duration: 0.04, frequency: 1600, gain: 0.1 });
        [740, 990].forEach((f, i) => sound({ type: 'sine', frequency: f, duration: 0.13, gain: 0.055, delay: 0.08 + i * 0.11 })); break;
      case 'message':
        [610, 915].forEach((f, i) => sound({ type: 'sine', frequency: f, duration: 0.25, gain: 0.08, delay: i * 0.1 })); break;
      case 'sleep':
        sound({ type: 'cloth', frequency: 2600, end: 1000, duration: 0.24, gain: 0.12, delay: 0.12 });
        sound({ filter: 'bandpass', frequency: 1100, end: 400, duration: 0.7, gain: 0.09, attack: 0.1 }); sound({ frequency: 550, duration: 0.9, gain: 0.07, delay: 0.3, attack: 0.18 }); break;
      case 'seat': sound({ frequency: 450, end: 120, duration: 0.19, gain: 0.18 }); sound({ filter: 'bandpass', frequency: 1300, duration: 0.32, gain: 0.07, delay: 0.04 }); sound({ type: 'metal', filter: 'bandpass', q: 4, frequency: 183, end: 166, duration: 0.2, gain: 0.04 }); break;
      default: sound({ frequency: 1600, end: 450, duration: 0.025, gain: 0.055 });
    }
  }
  function loop(name, level, frequency, type = 'noise', pan = 0, filterType = 'lowpass') {
    if (!context || context.state !== 'running') return;
    if (!loops.has(name)) {
      const sampled = type === 'noise' || textures.has(type);
      const source = sampled ? context.createBufferSource() : context.createOscillator();
      if (sampled) { source.buffer = textures.get(type) || noise; source.loop = true; source.playbackRate.value = 0.8 + Math.random() * 0.4; }
      else { source.type = type; source.frequency.value = frequency; }
      const filter = context.createBiquadFilter(); filter.type = filterType; filter.Q.value = 0.5; filter.frequency.value = frequency;
      const gain = context.createGain(); gain.gain.value = 0;
      const panner = context.createStereoPanner();
      if (name === 'beam') {
        const modulation = context.createOscillator();
        const depth = context.createGain();
        modulation.frequency.value = 83; depth.gain.value = 55;
        modulation.connect(depth).connect(source.frequency); modulation.start();
      }
      source.connect(filter).connect(gain).connect(panner).connect(master); source.start(0, sampled ? Math.random() * 2 : 0);
      // Independent slow turbulence prevents a static, unchanging hiss.
      const flutter = context.createBufferSource(); flutter.buffer = noise; flutter.loop = true;
      const turbulence = context.createBiquadFilter(); turbulence.type = 'lowpass';
      turbulence.frequency.value = name.startsWith('jet') ? 34 : name.startsWith('worm') ? 8 : 1.4;
      const depth = context.createGain(); depth.gain.value = 0;
      flutter.connect(turbulence).connect(depth).connect(gain.gain); flutter.start(0, Math.random() * 3);
      loops.set(name, { gain, filter, source, depth, panner });
    }
    const voice = loops.get(name);
    voice.panner.pan.setTargetAtTime(pan, context.currentTime, 0.12);
    voice.gain.gain.setTargetAtTime(level, context.currentTime, 0.09);
    voice.depth.gain.setTargetAtTime(level * 1.3, context.currentTime, 0.1);
    if (type !== 'noise' && !textures.has(type)) voice.source.frequency.setTargetAtTime(frequency, context.currentTime, 0.18);
    voice.filter.frequency.setTargetAtTime(frequency, context.currentTime, 0.15);
  }
  function update({ playing, indoors, jetpack, beam, shake, wormDistance, wormPresent, listenerPosition, listenerRight, wormPosition, moving = false, sprinting = false, storm = 0, stormGust = 1 }) {
    if (listenerPosition && listenerRight) listener = { ...listenerPosition, rightX: listenerRight.x, rightZ: listenerRight.z };
    const offsetX = (wormPosition?.x ?? listener.x) - listener.x;
    const offsetZ = (wormPosition?.z ?? listener.z) - listener.z;
    const wormPan = Math.max(-0.85, Math.min(0.85, (offsetX * listener.rightX + offsetZ * listener.rightZ) / Math.max(1, Math.hypot(offsetX, offsetZ))));
    roomAmount = indoors ? 0.22 : 0.025;
    if (context) reflections.gain.setTargetAtTime(roomAmount, context.currentTime, 0.25);
    const audible = playing && !globalThis.document?.hidden;
    const level = audible ? 1 : 0;
    const t = context?.currentTime ?? 0;
    const dt = Math.min(0.1, Math.max(0, t - lastUpdate)); lastUpdate = t;
    const thrust = Math.max(0, Math.min(1, jetpack || 0));
    // Only action changes during live play trigger ignition/discharge sounds.
    if (audible && wasPlaying) {
      if (!jetFiring && thrust > 0.18) { play('jetStart'); jetFiring = true; }
      if (jetFiring && thrust < 0.08) { play('jetStop'); jetFiring = false; }

    } else jetFiring = thrust > 0.18;
    wasPlaying = audible;
    jetSpool += ((audible ? thrust : 0) - jetSpool) * (1 - Math.exp(-dt / (thrust > jetSpool ? 0.22 : 0.4)));
    updateWind(audible, indoors, storm);
    updateStormAudio(audible ? storm : 0, indoors, stormGust);
    loop('base', level * (indoors ? 0.018 : 0), 65, 'sine');
    loop('ventilation', level * (indoors ? 0.024 : 0), 700, 'noise', 0.3);
    const combustion = thrust * (0.9 + Math.sin(t * 31) * 0.04 + Math.sin(t * 47) * 0.035);
    // Favor low combustion pressure over broadband air hiss.
    loop('jetpack', level * combustion * 0.095, 2400 + jetSpool * 1700, 'noise');
    loop('jetExhaust', level * combustion * 0.15, 750 + jetSpool * 1050, 'exhaust', -0.22);
    loop('jetExhaustRight', level * combustion * 0.13, 820 + jetSpool * 1150, 'exhaust', 0.22);
    loop('jetNozzle', level * combustion * 0.032, 1600, 'breath', -0.12, 'highpass');
    loop('jetBody', level * combustion * 0.12, 260 + jetSpool * 200, 'earth');
    updateRecordedLaser(Boolean(audible && beam), audible ? 0.28 : 0.025);
    updateWalking(Boolean(audible && moving), sprinting, indoors);
    const proximity = wormPresent ? Math.max(0, 1 - wormDistance / 150) : 0;
    loop('worm', level * Math.min(0.4, shake * 0.3 + proximity * 0.07), 95 + Math.min(1, shake) * 200, 'earth', wormPan);
    loop('wormSand', level * Math.min(0.12, shake * 0.12), 1200 / (1 + (wormDistance || 0) / 100), 'sand', wormPan);
    loop('wormBody', level * Math.min(0.08, shake * 0.08), 36, 'sine', wormPan * 0.5);
  }
  function updateRecordedLaser(active, fadeOut = 0.28) {
    if (active && !laserVoice && laserBuffer && context?.state === 'running') {
      const source = context.createBufferSource(); source.buffer = laserBuffer; source.loop = true;
      // Sustain the steady part; exclude the recording's built-in fade at the end.
      source.loopStart = 0.2; source.loopEnd = Math.min(3.1, laserBuffer.duration);
      const gain = context.createGain(); const now = context.currentTime;
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.20, now + 0.012);
      source.connect(gain).connect(master); source.start();
      const hiss = context.createBufferSource(); hiss.buffer = textures.get('breath') || noise; hiss.loop = true;
      const hissFilter = context.createBiquadFilter(); hissFilter.type = 'bandpass';
      hissFilter.frequency.value = 3800; hissFilter.Q.value = 0.65;
      const hissLevel = context.createGain(); hissLevel.gain.value = 0.35;
      // Share the beam envelope so the hiss follows its attack and release exactly.
      hiss.connect(hissFilter).connect(hissLevel).connect(gain); hiss.start(0, Math.random() * 2);
      laserVoice = { source, gain, hiss };
      source.onended = () => {
        source.disconnect(); gain.disconnect(); hiss.disconnect(); hissFilter.disconnect(); hissLevel.disconnect();
      };
    } else if (!active && laserVoice) {
      const { source, gain, hiss } = laserVoice; laserVoice = null;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + fadeOut); source.stop(now + fadeOut + 0.005); hiss.stop(now + fadeOut + 0.005);
    }
  }
  function updateWalking(active, sprinting = false, indoors = false) {
    const buffer = indoors ? indoorWalkingBuffer : walkingBuffer;
    if (walkingVoice && (!active || walkingVoice.source.buffer !== buffer)) {
      const { source, gain } = walkingVoice; walkingVoice = null;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.04); source.stop(now + 0.045);
    }
    if (active && !walkingVoice && buffer && context?.state === 'running') {
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
      source.playbackRate.value = sprinting ? 1.8 : 1;
      const gain = context.createGain(); gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.65, context.currentTime + 0.025);
      source.connect(gain).connect(master); source.start(); walkingVoice = { source, gain };
      source.onended = () => { source.disconnect(); gain.disconnect(); };
    }
    if (active && walkingVoice) walkingVoice.source.playbackRate.setTargetAtTime(sprinting ? 1.8 : 1, context.currentTime, 0.08);
  }
  function updateWind(active, indoors = false, storm = 0) {
    if (active && !windVoice && windBuffer && context?.state === 'running') {
      const source = context.createBufferSource(); source.buffer = windBuffer; source.loop = true;
      const gain = context.createGain(); gain.gain.value = 0;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass';
      source.connect(filter).connect(gain).connect(master); source.start();
      windVoice = { source, gain, filter };
    }
    if (windVoice) {
      windVoice.gain.gain.setTargetAtTime(active ? (indoors ? 0.07 : 0.50) * (1 - storm * 0.8) : 0, context.currentTime, active ? 0.35 : 0.04);
      windVoice.filter.frequency.setTargetAtTime(indoors ? 650 : 16000, context.currentTime, 0.3);
    }
  }
  function updateStormAudio(intensity, indoors = false, gust = 1) {
    if (intensity > 0 && !stormVoice && stormBuffer && context?.state === 'running') {
      const source = context.createBufferSource(); source.buffer = stormBuffer; source.loop = true;
      const gain = context.createGain(); gain.gain.value = 0;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass';
      source.connect(filter).connect(gain).connect(master); source.start(); stormVoice = { source, gain, filter };
    }
    if (stormVoice) {
      stormVoice.gain.gain.setTargetAtTime(intensity * (indoors ? 0.14 : 0.85) * (0.65 + gust * 0.35), context.currentTime, intensity > 0 ? 0.2 : 0.04);
      stormVoice.filter.frequency.setTargetAtTime(indoors ? 850 : 16000, context.currentTime, 0.25);
    }
  }
  function silence() {
    updateStormAudio(0);
    updateWind(false);
    updateWalking(false);
    updateRecordedLaser(false, 0.025);
    if (!context) return;
    for (const voice of loops.values()) {
      voice.gain.gain.setTargetAtTime(0, context.currentTime, 0.03);
      voice.depth.gain.setTargetAtTime(0, context.currentTime, 0.03);
    }
  }
  globalThis.document?.addEventListener('visibilitychange', () => { if (document.hidden) silence(); });
  return { unlock, play, update, silence, setMuted(value) { muted = value; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, context.currentTime, 0.04); } };
}
