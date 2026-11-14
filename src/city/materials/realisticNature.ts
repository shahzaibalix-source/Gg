import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Shared nature animation clock updated once per frame in WindTimeUpdater.
 */
export const globalWindUniform = { value: 0 };

function normalizeGeoForMerge(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIdx = geo.index ? geo.toNonIndexed() : geo;
  if (!nonIdx.attributes.normal) {
    nonIdx.computeVertexNormals();
  }
  // Strip optional uv/tangent differences so mergeGeometries always succeeds
  const clean = new THREE.BufferGeometry();
  clean.setAttribute('position', nonIdx.attributes.position.clone());
  clean.setAttribute('normal', nonIdx.attributes.normal.clone());
  if (nonIdx !== geo) nonIdx.dispose();
  geo.dispose();
  return clean;
}

/**
 * Creates a merged multi-lobed HD broadleaf canopy BufferGeometry (6 organic clusters)
 * for single-draw-call instanced trees across streets, parks, and hillsides.
 */
export function createHdBroadleafCrownGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const specs: Array<[number, number, number, number, number, number, number]> = [
    [1.15, 0, 0.22, 0, 1.05, 0.92, 1.05],
    [0.82, -0.78, -0.15, 0.36, 1.0, 0.88, 1.0],
    [0.8, 0.78, -0.1, -0.34, 1.0, 0.9, 1.0],
    [0.74, 0.14, -0.08, 0.76, 1.0, 0.86, 1.0],
    [0.72, -0.18, -0.12, -0.74, 1.0, 0.88, 1.0],
    [0.78, 0.04, 0.92, 0.05, 1.0, 0.85, 1.0],
  ];

  for (const [r, x, y, z, sx, sy, sz] of specs) {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    parts.push(normalizeGeoForMerge(g));
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Creates a 4-tier layered Alpine pine / cypress canopy BufferGeometry
 * with subtle staggered skirt tiers for crisp HD evergreen silhouettes.
 */
export function createHdPineCrownGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tiers: Array<[number, number, number, number]> = [
    [1.55, 1.75, -0.95, 0],
    [1.28, 1.65, -0.15, 0.35],
    [0.98, 1.5, 0.65, 0.7],
    [0.64, 1.25, 1.38, 1.05],
  ];

  for (const [radius, height, y, rotY] of tiers) {
    const g = new THREE.ConeGeometry(radius, height, 8);
    g.rotateY(rotY);
    g.translate(0, y, 0);
    parts.push(normalizeGeoForMerge(g));
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Creates a flared trunk with Y-forked primary branches for instanced HD trees.
 */
export function createHdTrunkGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  const main = new THREE.CylinderGeometry(0.16, 0.32, 2.2, 8);
  parts.push(normalizeGeoForMerge(main));

  const branchL = new THREE.CylinderGeometry(0.06, 0.11, 1.05, 6);
  branchL.rotateZ(0.46);
  branchL.rotateY(0.35);
  branchL.translate(-0.34, 0.95, 0.14);
  parts.push(normalizeGeoForMerge(branchL));

  const branchR = new THREE.CylinderGeometry(0.06, 0.11, 1.0, 6);
  branchR.rotateZ(-0.42);
  branchR.rotateY(-0.3);
  branchR.translate(0.34, 0.9, -0.12);
  parts.push(normalizeGeoForMerge(branchR));

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Creates a lightweight 4-blade fanned 3D grass tuft BufferGeometry (16 triangles total)
 * designed for 10,000+ instanced meadow grass tufts at 60 FPS.
 */
export function createGrassTuftGeo(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  const addBlade = (ox: number, oz: number, angleY: number, lean: number, height: number, width: number) => {
    const cos = Math.cos(angleY);
    const sin = Math.sin(angleY);
    const hw = width * 0.5;
    const hMid = height * 0.54;

    const pt = (lx: number, ly: number, lz: number): [number, number, number] => [
      ox + lx * cos - lz * sin,
      ly,
      oz + lx * sin + lz * cos,
    ];

    const bL = pt(-hw, 0, 0);
    const bR = pt(hw, 0, 0);
    const mL = pt(-hw * 0.62, hMid, lean * 0.4);
    const mR = pt(hw * 0.62, hMid, lean * 0.4);
    const tip = pt(0, height, lean);

    // Lower quad (2 triangles)
    positions.push(...bL, ...bR, ...mR);
    positions.push(...bL, ...mR, ...mL);
    // Upper tip triangle
    positions.push(...mL, ...mR, ...tip);

    const nx = -sin * 0.25;
    const nz = cos * 0.25;
    for (let k = 0; k < 9; k++) {
      normals.push(nx, 0.94, nz);
    }
  };

  addBlade(-0.08, 0.04, 0.2, 0.14, 0.42, 0.11);
  addBlade(0.08, -0.05, 1.85, 0.16, 0.46, 0.1);
  addBlade(-0.02, -0.09, 3.35, 0.13, 0.37, 0.1);
  addBlade(0.06, 0.09, 4.95, 0.15, 0.4, 0.095);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Wind-animated, height-shaded 3D grass material supporting InstancedMesh.
 */
export function createGrassBladeMaterial(cacheTag = 'default'): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.78,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = globalWindUniform;

    shader.vertexShader =
      `uniform float uWindTime;\nvarying float vGrassH;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vGrassH = clamp(position.y / 0.46, 0.0, 1.0);
        vec4 gLocal = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          gLocal = instanceMatrix * gLocal;
        #endif
        vec4 gWorld = modelMatrix * gLocal;
        float bend = vGrassH * vGrassH;
        float gust = sin(uWindTime * 1.9 + gWorld.x * 0.22 + gWorld.z * 0.18) * 0.115;
        float flutter = cos(uWindTime * 3.7 + gWorld.x * 0.75 - gWorld.z * 0.68) * 0.045;
        transformed.x += (gust + flutter) * bend;
        transformed.z += (gust * 0.65 - flutter) * bend;
        `,
      );

    shader.fragmentShader =
      `varying float vGrassH;\n` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float rootAO = mix(0.56, 1.18, smoothstep(0.0, 1.0, vGrassH));
        diffuseColor.rgb *= rootAO;
        `,
      );
  };

  mat.customProgramCacheKey = () => `lindenhof_3d_grass_${cacheTag}`;
  return mat;
}

/**
 * Animated 3D GLSL water shader extending MeshStandardMaterial so it automatically inherits
 * Lindenhof's sky reflections, directional sunlight, time-of-day fog, and ACES tone mapping.
 */
export function createRealisticWaterMaterial(opts: {
  baseColor?: string;
  crestColor?: string;
  waveAmp?: number;
  rippleScale?: number;
  opacity?: number;
  tag?: string;
} = {}): THREE.MeshStandardMaterial {
  const baseColor = opts.baseColor ?? '#1c6b8c';
  const crestColor = opts.crestColor ?? '#86d6ee';
  const waveAmp = opts.waveAmp ?? 0.032;
  const rippleScale = opts.rippleScale ?? 1.0;
  const opacity = opts.opacity ?? 0.94;
  const tag = opts.tag ?? 'lake';

  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.14,
    metalness: 0.28,
    envMapIntensity: 1.55,
    transparent: opacity < 1,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = globalWindUniform;
    shader.uniforms.uWaveAmp = { value: waveAmp };
    shader.uniforms.uRippleScale = { value: rippleScale };
    shader.uniforms.uCrestTint = { value: new THREE.Color(crestColor) };

    shader.vertexShader =
      `
      uniform float uWaterTime;
      uniform float uWaveAmp;
      varying vec3 vWaterWorldPos;
      varying float vWaterCrest;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec4 wLocal = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wLocal = instanceMatrix * wLocal;
        #endif
        vec4 wWorld = modelMatrix * wLocal;
        float w1 = sin(wWorld.x * 0.34 + uWaterTime * 1.45) * cos(wWorld.z * 0.28 + uWaterTime * 1.15);
        float w2 = sin((wWorld.x + wWorld.z) * 0.66 - uWaterTime * 1.9);
        float waveSum = w1 * 0.65 + w2 * 0.35;
        transformed.y += waveSum * uWaveAmp;
        vWaterWorldPos = wWorld.xyz + vec3(0.0, waveSum * uWaveAmp, 0.0);
        vWaterCrest = waveSum;
        `,
      );

    shader.fragmentShader =
      `
      uniform float uWaterTime;
      uniform float uRippleScale;
      uniform vec3 uCrestTint;
      varying vec3 vWaterWorldPos;
      varying float vWaterCrest;
      ` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          float rippleGlow = sin(vWaterWorldPos.x * 0.9 * uRippleScale + uWaterTime * 1.8)
                           * cos(vWaterWorldPos.z * 0.85 * uRippleScale - uWaterTime * 1.5);
          float crestMix = smoothstep(0.32, 0.98, vWaterCrest * 0.65 + rippleGlow * 0.42);
          diffuseColor.rgb = mix(diffuseColor.rgb, uCrestTint, crestMix * 0.26);
          `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
          #include <normal_fragment_maps>
          float s = uRippleScale;
          float t = uWaterTime;
          vec2 p = vWaterWorldPos.xz;
          float dHx = cos(p.x * 0.85 * s + t * 1.7) * 0.08
                    + cos((p.x + p.y * 0.7) * 1.55 * s - t * 2.3) * 0.055;
          float dHz = sin(p.y * 0.92 * s - t * 1.55) * 0.08
                    + sin((p.y - p.x * 0.6) * 1.75 * s + t * 2.1) * 0.055;
          vec3 rippleWorldN = normalize(vec3(-dHx, 1.0, -dHz));
          vec3 rippleViewN = normalize(mat3(viewMatrix) * rippleWorldN);
          normal = normalize(mix(normal, rippleViewN, 0.68));
          `,
        );
  };

  mat.customProgramCacheKey = () =>
    `lindenhof_water_${tag}_${baseColor}_${waveAmp.toFixed(3)}_${rippleScale.toFixed(2)}`;
  return mat;
}
