import * as THREE from 'three';

// Camera-facing dust volumes share a single draw call per funnel.
const flowShader = /* glsl */ `
  uniform float time;
  uniform float variation;
  vec3 vortex(vec4 seed, out float height, out float fade) {
    bool skirt = seed.w > 0.76;
    float rise = fract(seed.x + time * (skirt ? 0.085 : 0.07 + seed.z * 0.045));
    height = skirt ? rise * 0.13 : rise;
    float angle = seed.y * 6.28318 + time * (4.8 - height * 2.7) - height * 15.0;
    float radius = skirt ? (2.5 + rise * 12.0) : (1.0 + pow(height, 1.65) * 7.5);
    radius *= 0.64 + seed.z * 0.5;
    radius *= 1.0 + sin(angle * 3.0 + height * 19.0 + time * 1.7) * 0.13;
    vec2 bend = vec2(sin(height * 3.8 + time * 0.45 + variation),
      cos(height * 4.5 - time * 0.35 + variation)) * height * height * 4.5;
    fade = skirt ? sin(rise * 3.14159) : smoothstep(0.0, 0.06, rise) * (1.0 - smoothstep(0.8, 1.0, rise));
    return vec3(cos(angle) * radius + bend.x, height * 34.0, sin(angle) * radius + bend.y);
  }
`;
const noiseShader = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
      mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
      mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  float billows(vec3 p) {
    return noise(p) * 0.57 + noise(p * 2.07 + 13.0) * 0.28 + noise(p * 4.13 + 7.0) * 0.15;
  }
`;

export function createTornadoVisual(index) {
  const group = new THREE.Group();
  group.name = `sand-tornado-${index}`;
  const uniforms = {
    time: { value: 0 }, variation: { value: index * 3.71 },
    strength: { value: 0 }, dustColor: { value: new THREE.Color(0x987352) },
  };
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.attributes.position = base.attributes.position;
  geometry.attributes.uv = base.attributes.uv;
  const count = 640;
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = (i * 0.618034) % 1;
    seeds[i * 4 + 1] = (i * 0.754877 + index * 0.23) % 1;
    seeds[i * 4 + 2] = (i * 0.56984) % 1;
    seeds[i * 4 + 3] = i / count;
  }
  geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 4));
  geometry.instanceCount = count;
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      varying vec2 dustUv;
      varying vec3 noiseOrigin;
      varying float opacity, viewDepth, cloudHeight, shade;
      ${flowShader}
      void main() {
        float height, fade;
        vec3 center = vortex(seed, height, fade);
        vec4 viewCenter = modelViewMatrix * vec4(center, 1.0);
        float size = seed.w > 0.76 ? 5.0 + seed.z * 5.0 : 3.0 + height * 5.5 + seed.z * 2.0;
        float angle = seed.y * 6.28318 + time * (0.25 + seed.z * 0.25);
        mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 corner = rotation * position.xy;
        viewCenter.xy += corner * vec2(size, size * 0.8);
        gl_Position = projectionMatrix * viewCenter;
        dustUv = uv;
        noiseOrigin = vec3(seed.xy * 21.0, time * 0.22 + seed.z * 10.0);
        opacity = fade * smoothstep(0.4, 2.5, -viewCenter.z);
        viewDepth = -viewCenter.z;
        cloudHeight = height;
        shade = 0.75 + cos(atan(center.z, center.x) - 0.7) * 0.2;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float strength;
      uniform vec3 dustColor;
      varying vec2 dustUv;
      varying vec3 noiseOrigin;
      varying float opacity, viewDepth, cloudHeight, shade;
      ${noiseShader}
      void main() {
        vec2 p = dustUv * 2.0 - 1.0;
        float r = dot(p,p);
        if (r > 1.0) discard;
        vec3 q = vec3(p * 2.5, 0.0) + noiseOrigin;
        float turbulence = billows(q + billows(q * 0.65) * 1.5);
        float edge = pow(max(0.0, 1.0 - r), 1.6);
        float density = smoothstep(0.18, 0.8, turbulence) * edge;
        float alpha = density * opacity * strength * 0.38;
        if (alpha < 0.003) discard;
        float lighting = shade * (0.58 + turbulence * 0.7) + pow(r, 2.0) * 0.12;
        vec3 color = dustColor * lighting;
        // The dense column still silhouettes against the surrounding airborne sand.
        float haze = (1.0 - exp(-viewDepth * 0.014)) * 0.65;
        color = mix(color, dustColor, haze);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const cloud = new THREE.Mesh(geometry, dustMaterial);
  cloud.frustumCulled = false;
  cloud.name = 'tornado-dust-volume';
  group.add(cloud);

  // Fine sand has a rounded silhouette and never turns into large bright squares.
  const gritGeometry = new THREE.BufferGeometry();
  gritGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(1200 * 3), 3));
  const gritSeeds = new Float32Array(1200 * 4);
  for (let i = 0; i < 1200; i++) for (let j = 0; j < 4; j++) gritSeeds[i * 4 + j] = (i * [0.618034, 0.754877, 0.56984, 0.43858][j]) % 1;
  gritGeometry.setAttribute('seed', new THREE.BufferAttribute(gritSeeds, 4));
  const gritMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      varying float opacity;
      ${flowShader}
      void main() {
        float height, fade;
        vec3 center = vortex(seed, height, fade);
        vec4 viewCenter = modelViewMatrix * vec4(center, 1.0);
        gl_Position = projectionMatrix * viewCenter;
        gl_PointSize = clamp((16.0 + seed.z * 18.0) / max(1.0, -viewCenter.z), 0.6, 2.2);
        opacity = fade * smoothstep(0.6, 2.0, -viewCenter.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float strength;
      uniform vec3 dustColor;
      varying float opacity;
      void main() {
        float radius = length(gl_PointCoord * 2.0 - 1.0);
        float alpha = (1.0 - smoothstep(0.25, 1.0, radius)) * opacity * strength * 0.45;
        gl_FragColor = vec4(dustColor * 1.15, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const grit = new THREE.Points(gritGeometry, gritMaterial);
  grit.frustumCulled = false; group.add(grit);
  group.visible = false;
  return {
    group, placed: false, radius: 6, height: 34,
    update(time, strength) {
      uniforms.time.value = time;
      uniforms.strength.value = strength;
    },
    setAtmosphere(color) { uniforms.dustColor.value.copy(color); },
  };
}
