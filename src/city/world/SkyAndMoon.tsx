import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeOfDay, WeatherMode } from '../types';

interface SkyAndMoonProps {
  timeOfDay: TimeOfDay;
  weather: WeatherMode;
  skyHorizonColor: string;
  lightDirection: [number, number, number];
}

const SKY_PALETTES: Record<
  TimeOfDay,
  {
    mid: string;
    zenith: string;
    glow: string;
    glowPower: number;
    glowStrength: number;
  }
> = {
  morning: {
    mid: '#b8d9f0',
    zenith: '#6aa8de',
    glow: '#ffe4b5',
    glowPower: 10,
    glowStrength: 0.45,
  },
  afternoon: {
    mid: '#8fc0ea',
    zenith: '#468bd1',
    glow: '#fff8e0',
    glowPower: 14,
    glowStrength: 0.3,
  },
  sunset: {
    mid: '#b0788c',
    zenith: '#2c3d6b',
    glow: '#ff964f',
    glowPower: 7,
    glowStrength: 0.65,
  },
  night: {
    mid: '#050915',
    zenith: '#010308',
    glow: '#7ca9eb',
    glowPower: 12,
    glowStrength: 0.28,
  },
};

function createMoonSurfaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(112, 108, 12, 128, 128, 128);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.65, '#edf3ff');
  grad.addColorStop(1, '#c5d7f5');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle lunar maria patches for realistic texture
  const patches = [
    { x: 95, y: 92, r: 34, a: 0.14 },
    { x: 146, y: 86, r: 28, a: 0.12 },
    { x: 118, y: 145, r: 40, a: 0.11 },
    { x: 162, y: 138, r: 24, a: 0.14 },
    { x: 78, y: 140, r: 20, a: 0.1 },
    { x: 135, y: 115, r: 18, a: 0.08 },
  ];
  for (const p of patches) {
    const pg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r);
    pg.addColorStop(0, `rgba(110, 130, 165, ${p.a})`);
    pg.addColorStop(1, 'rgba(110, 130, 165, 0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createMoonHaloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(225, 240, 255, 0.85)');
  grad.addColorStop(0.24, 'rgba(175, 208, 255, 0.42)');
  grad.addColorStop(0.55, 'rgba(110, 155, 230, 0.14)');
  grad.addColorStop(1, 'rgba(70, 110, 190, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural atmospheric sky dome, starry night canopy, and luminous full moon
 * aligned with the scene's directional light vector.
 */
export const SkyAndMoon: React.FC<SkyAndMoonProps> = ({
  timeOfDay,
  weather,
  skyHorizonColor,
  lightDirection,
}) => {
  const haloRef = useRef<THREE.Mesh>(null);
  const starMatRef = useRef<THREE.ShaderMaterial>(null);
  const cloudMeshRef = useRef<THREE.InstancedMesh>(null);
  const birdBodyRef = useRef<THREE.InstancedMesh>(null);
  const birdWingLRef = useRef<THREE.InstancedMesh>(null);
  const birdWingRRef = useRef<THREE.InstancedMesh>(null);

  const palette = SKY_PALETTES[timeOfDay];
  const isMutedWeather = weather === 'cloudy' || weather === 'rainy' || weather === 'foggy';

  const skyShaderMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uHorizon: { value: new THREE.Color('#d6e7f4') },
        uMid: { value: new THREE.Color('#8fc0ea') },
        uZenith: { value: new THREE.Color('#468bd1') },
        uLightDir: { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() },
        uGlowColor: { value: new THREE.Color('#fff8e0') },
        uGlowPower: { value: 12 },
        uGlowStrength: { value: 0.3 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uHorizon;
        uniform vec3 uMid;
        uniform vec3 uZenith;
        uniform vec3 uLightDir;
        uniform vec3 uGlowColor;
        uniform float uGlowPower;
        uniform float uGlowStrength;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.24, h));
          col = mix(col, uZenith, smoothstep(0.18, 0.78, h));
          float sunAmt = max(dot(dir, normalize(uLightDir)), 0.0);
          float halo = pow(sunAmt, uGlowPower) * uGlowStrength;
          col += uGlowColor * halo;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);

  useEffect(() => {
    const horizon = new THREE.Color(skyHorizonColor);
    const mid = new THREE.Color(palette.mid);
    const zenith = new THREE.Color(palette.zenith);

    if (isMutedWeather) {
      const blend = weather === 'foggy' ? 0.68 : weather === 'rainy' ? 0.58 : 0.44;
      mid.lerp(horizon, blend);
      zenith.lerp(horizon, blend * 0.82);
    }

    skyShaderMat.uniforms.uHorizon.value.copy(horizon);
    skyShaderMat.uniforms.uMid.value.copy(mid);
    skyShaderMat.uniforms.uZenith.value.copy(zenith);
    skyShaderMat.uniforms.uLightDir.value
      .set(lightDirection[0], lightDirection[1], lightDirection[2])
      .normalize();
    skyShaderMat.uniforms.uGlowColor.value.set(palette.glow);
    skyShaderMat.uniforms.uGlowPower.value = palette.glowPower;
    skyShaderMat.uniforms.uGlowStrength.value = isMutedWeather
      ? palette.glowStrength * 0.28
      : palette.glowStrength;
  }, [skyShaderMat, skyHorizonColor, palette, lightDirection, isMutedWeather, weather]);

  useEffect(() => () => skyShaderMat.dispose(), [skyShaderMat]);

  // Procedural starfield on upper celestial hemisphere
  const { starGeo, starShaderMat } = useMemo(() => {
    const count = 720;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    let seed = 4209;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const cool = new THREE.Color('#cfe4ff');
    const warm = new THREE.Color('#fff2d6');
    const pure = new THREE.Color('#ffffff');
    const tmp = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2;
      const u = 0.06 + rand() * 0.94; // above horizon
      const phi = Math.acos(u);
      const r = 2200 + rand() * 140;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const tintPick = rand();
      tmp.copy(tintPick < 0.35 ? cool : tintPick < 0.65 ? warm : pure);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;

      sizes[i] = 1.6 + Math.pow(rand(), 2.2) * 3.6;
      phases[i] = rand() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        uniform float uOpacity;
        void main() {
          vColor = aColor;
          float twinkle = 0.72 + 0.28 * sin(uTime * 1.8 + aPhase);
          vAlpha = twinkle * uOpacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (280.0 / max(100.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c) * 2.0;
          if (d > 1.0) discard;
          float core = pow(1.0 - d, 1.8);
          gl_FragColor = vec4(vColor, core * vAlpha);
        }
      `,
    });

    return { starGeo: geo, starShaderMat: mat };
  }, []);

  useEffect(() => {
    return () => {
      starGeo.dispose();
      starShaderMat.dispose();
    };
  }, [starGeo, starShaderMat]);

  const { moonTex, haloTex } = useMemo(
    () => ({
      moonTex: createMoonSurfaceTexture(),
      haloTex: createMoonHaloTexture(),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      moonTex.dispose();
      haloTex.dispose();
    };
  }, [moonTex, haloTex]);

  const moonPosition = useMemo<[number, number, number]>(() => {
    const v = new THREE.Vector3(lightDirection[0], lightDirection[1], lightDirection[2])
      .normalize()
      .multiplyScalar(1950);
    return [v.x, v.y, v.z];
  }, [lightDirection]);

  const showStars = timeOfDay === 'night' || timeOfDay === 'sunset';
  const starOpacity =
    timeOfDay === 'night'
      ? weather === 'rainy'
        ? 0.08
        : weather === 'cloudy'
          ? 0.18
          : weather === 'foggy'
            ? 0.38
            : 0.96
      : weather === 'sunny'
        ? 0.22
        : 0;

  useFrame((state) => {
    if (starMatRef.current) {
      starMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      starMatRef.current.uniforms.uOpacity.value = starOpacity;
    }
    if (haloRef.current) {
      haloRef.current.quaternion.copy(state.camera.quaternion);
    }
  });

  const moonOpacity =
    weather === 'rainy' ? 0.35 : weather === 'cloudy' ? 0.55 : weather === 'foggy' ? 0.65 : 1.0;

  // Drifting multi-puff clouds & soaring bird flocks
  const cloudDummy = useMemo(() => new THREE.Object3D(), []);
  const clouds = useMemo(() => {
    let seed = 7721;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const puffs: Array<{
      clusterX: number;
      clusterZ: number;
      ox: number;
      oy: number;
      oz: number;
      y: number;
      sx: number;
      sy: number;
      sz: number;
      speed: number;
    }> = [];
    for (let c = 0; c < 24; c++) {
      const cx = (rand() - 0.5) * 2400;
      const cz = (rand() - 0.5) * 1900;
      const cy = 205 + rand() * 68;
      const speed = 3.2 + rand() * 3.8;
      for (let p = 0; p < 4; p++) {
        puffs.push({
          clusterX: cx,
          clusterZ: cz,
          ox: (p - 1.5) * (16 + rand() * 8),
          oy: p === 1 || p === 2 ? 4 + rand() * 4 : 0,
          oz: (rand() - 0.5) * 14,
          y: cy,
          sx: 24 + rand() * 18,
          sy: 9 + rand() * 5,
          sz: 18 + rand() * 12,
          speed,
        });
      }
    }
    return puffs;
  }, []);

  const birds = useMemo(() => {
    let seed = 3191;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: 18 }, (_, i) => {
      const flock = i % 3;
      const baseCx = flock === 0 ? 58 : flock === 1 ? 236 : 460;
      const baseCz = flock === 0 ? -8 : flock === 1 ? 0 : -15;
      return {
        cx: baseCx + (rand() - 0.5) * 35,
        cz: baseCz + (rand() - 0.5) * 35,
        radiusX: 48 + rand() * 55,
        radiusZ: 38 + rand() * 48,
        y: 36 + rand() * 28,
        speed: 0.14 + rand() * 0.1,
        phase: rand() * Math.PI * 2,
        flapSpeed: 7.2 + rand() * 2.4,
      };
    });
  }, []);

  const cloudColor =
    timeOfDay === 'night'
      ? '#1d2942'
      : timeOfDay === 'sunset'
        ? '#f6b99c'
        : weather === 'rainy'
          ? '#7c8b9b'
          : '#f8fafc';
  const cloudOpacity =
    timeOfDay === 'night'
      ? 0.34
      : weather === 'cloudy' || weather === 'rainy'
        ? 0.84
        : 0.72;
  const showBirds = timeOfDay !== 'night' && weather !== 'rainy';

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (cloudMeshRef.current) {
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        const x = (((c.clusterX + t * c.speed + 1400) % 2800) - 1400) + c.ox;
        cloudDummy.position.set(x, c.y + c.oy, c.clusterZ + c.oz);
        cloudDummy.rotation.set(0, 0, 0);
        cloudDummy.scale.set(c.sx, c.sy, c.sz);
        cloudDummy.updateMatrix();
        cloudMeshRef.current.setMatrixAt(i, cloudDummy.matrix);
      }
      cloudMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (
      showBirds &&
      birdBodyRef.current &&
      birdWingLRef.current &&
      birdWingRRef.current
    ) {
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        const ang = t * b.speed + b.phase;
        const bx = b.cx + Math.cos(ang) * b.radiusX;
        const bz = b.cz + Math.sin(ang) * b.radiusZ;
        const vx = -Math.sin(ang) * b.radiusX * b.speed;
        const vz = Math.cos(ang) * b.radiusZ * b.speed;
        const yaw = Math.atan2(vx, vz);
        const by = b.y + Math.sin(t * 1.4 + b.phase) * 1.6;
        const flap = Math.sin(t * b.flapSpeed + b.phase) * 0.58;

        cloudDummy.position.set(bx, by, bz);
        cloudDummy.rotation.set(0, yaw, 0);
        cloudDummy.scale.set(0.22, 0.16, 0.72);
        cloudDummy.updateMatrix();
        birdBodyRef.current.setMatrixAt(i, cloudDummy.matrix);

        cloudDummy.position.set(
          bx - Math.cos(yaw) * 0.34,
          by + Math.sin(flap) * 0.14,
          bz + Math.sin(yaw) * 0.34,
        );
        cloudDummy.rotation.set(0, yaw, -flap);
        cloudDummy.scale.set(0.68, 0.05, 0.24);
        cloudDummy.updateMatrix();
        birdWingLRef.current.setMatrixAt(i, cloudDummy.matrix);

        cloudDummy.position.set(
          bx + Math.cos(yaw) * 0.34,
          by + Math.sin(flap) * 0.14,
          bz - Math.sin(yaw) * 0.34,
        );
        cloudDummy.rotation.set(0, yaw, flap);
        cloudDummy.scale.set(0.68, 0.05, 0.24);
        cloudDummy.updateMatrix();
        birdWingRRef.current.setMatrixAt(i, cloudDummy.matrix);
      }
      birdBodyRef.current.instanceMatrix.needsUpdate = true;
      birdWingLRef.current.instanceMatrix.needsUpdate = true;
      birdWingRRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Seamless Atmospheric Gradient Sky Dome */}
      <mesh material={skyShaderMat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[2650, 32, 20]} />
      </mesh>

      {/* Crisp Night Starfield */}
      {showStars && starOpacity > 0.01 && (
        <points geometry={starGeo} renderOrder={-9} frustumCulled={false}>
          <primitive object={starShaderMat} ref={starMatRef} attach="material" />
        </points>
      )}

      {/* Soft Drifting Multi-Puff Sky Clouds */}
      <instancedMesh
        ref={cloudMeshRef}
        args={[undefined, undefined, clouds.length]}
        frustumCulled={false}
        renderOrder={-5}
      >
        <dodecahedronGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={cloudColor}
          transparent
          opacity={cloudOpacity}
          fog={false}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Soaring Animated Bird Flocks */}
      {showBirds && (
        <group>
          <instancedMesh
            ref={birdBodyRef}
            args={[undefined, undefined, birds.length]}
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
          </instancedMesh>
          <instancedMesh
            ref={birdWingLRef}
            args={[undefined, undefined, birds.length]}
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </instancedMesh>
          <instancedMesh
            ref={birdWingRRef}
            args={[undefined, undefined, birds.length]}
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </instancedMesh>
        </group>
      )}

      {/* Luminous Full Moon + Soft Corona Aligned with Moonlight Shadows */}
      {timeOfDay === 'night' && (
        <group position={moonPosition}>
          <mesh renderOrder={-8}>
            <sphereGeometry args={[44, 24, 24]} />
            <meshBasicMaterial
              map={moonTex}
              color="#f5f9ff"
              transparent={moonOpacity < 0.99}
              opacity={moonOpacity}
              fog={false}
              toneMapped={false}
            />
          </mesh>
          <mesh ref={haloRef} renderOrder={-7}>
            <planeGeometry args={[260, 260]} />
            <meshBasicMaterial
              map={haloTex}
              color="#d8e9ff"
              transparent
              opacity={0.78 * moonOpacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              fog={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};
