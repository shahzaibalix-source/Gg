import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeOfDay } from '../types';
import { globalWindUniform } from '../materials/realisticNature';

function createSwayBlossomMat(color: string, roughness = 0.78): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = globalWindUniform;
    shader.vertexShader =
      `uniform float uWindTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec4 wPos = modelMatrix * vec4(transformed, 1.0);
        float sway = clamp(position.y + 0.25, 0.0, 1.2);
        transformed.x += sin(uWindTime * 1.9 + wPos.x * 0.6 + wPos.z * 0.5) * 0.032 * sway;
        transformed.z += cos(uWindTime * 1.6 + wPos.z * 0.7) * 0.028 * sway;
        `,
      );
  };
  mat.customProgramCacheKey = () => `sway_blossom_${color}`;
  return mat;
}

const PARK_MATS = {
  stoneLight: new THREE.MeshStandardMaterial({ color: '#ddd5c6', roughness: 0.82 }),
  stoneMid: new THREE.MeshStandardMaterial({ color: '#bfb7a8', roughness: 0.86 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: '#8f8779', roughness: 0.88 }),
  soil: new THREE.MeshStandardMaterial({ color: '#4c3626', roughness: 0.96 }),
  timber: new THREE.MeshStandardMaterial({ color: '#8c613e', roughness: 0.8 }),
  timberDark: new THREE.MeshStandardMaterial({ color: '#614228', roughness: 0.84 }),
  iron: new THREE.MeshStandardMaterial({ color: '#22272e', roughness: 0.42, metalness: 0.76 }),
  steelSilver: new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.3, metalness: 0.8 }),
  epdmTerracotta: new THREE.MeshStandardMaterial({ color: '#c46c50', roughness: 0.92 }),
  epdmSage: new THREE.MeshStandardMaterial({ color: '#588267', roughness: 0.92 }),
  epdmSand: new THREE.MeshStandardMaterial({ color: '#d8c59e', roughness: 0.92 }),
  epdmSlateTeal: new THREE.MeshStandardMaterial({ color: '#456b73', roughness: 0.92 }),
  red: new THREE.MeshStandardMaterial({ color: '#d9483b', roughness: 0.52 }),
  yellow: new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.4 }),
  blue: new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.46 }),
  teal: new THREE.MeshStandardMaterial({ color: '#0d9488', roughness: 0.44 }),
  coral: new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.44 }),
  bushGreen: createSwayBlossomMat('#3f783b', 0.88),
  bushLight: createSwayBlossomMat('#558f48', 0.86),
  flowerPink: createSwayBlossomMat('#f43f5e', 0.74),
  flowerGold: createSwayBlossomMat('#facc15', 0.74),
  flowerViolet: createSwayBlossomMat('#a855f7', 0.74),
  flowerCoral: createSwayBlossomMat('#fb7185', 0.74),
  flowerBlue: createSwayBlossomMat('#60a5fa', 0.74),
  lampGlowOn: new THREE.MeshStandardMaterial({
    color: '#fff3cf',
    emissive: '#ffad38',
    emissiveIntensity: 2.8,
    roughness: 0.2,
  }),
  lampGlowOff: new THREE.MeshStandardMaterial({
    color: '#ebe6da',
    emissive: '#ffb84d',
    emissiveIntensity: 0.08,
    roughness: 0.25,
  }),
  lampPool: new THREE.MeshBasicMaterial({
    color: '#ffd27d',
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
};

// ============================================================================
// 1. GRAND CENTRAL FOUNTAIN (Stepped Stone Basin, Water Arcs, Animated Ripples)
// ============================================================================
export const GrandCommunityFountain: React.FC<{
  position: [number, number, number];
  scale?: number;
  timeOfDay: TimeOfDay;
}> = ({ position, scale = 1, timeOfDay }) => {
  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';
  const rippleARef = useRef<THREE.Mesh>(null);
  const rippleBRef = useRef<THREE.Mesh>(null);
  const jetGroupRef = useRef<THREE.Group>(null);
  const plumeRef = useRef<THREE.Mesh>(null);

  const { bowlGeo, arcGeos } = useMemo(() => {
    // Classic European Lathe silhouette for upper central fountain bowl
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.45, 0.0),
      new THREE.Vector2(0.32, 0.45),
      new THREE.Vector2(0.38, 0.85),
      new THREE.Vector2(1.22, 1.15),
      new THREE.Vector2(1.32, 1.24),
      new THREE.Vector2(1.18, 1.28),
      new THREE.Vector2(0.28, 1.05),
      new THREE.Vector2(0.24, 1.55),
      new THREE.Vector2(0.42, 1.72),
      new THREE.Vector2(0.14, 2.02),
      new THREE.Vector2(0.0, 2.15),
    ];
    const bGeo = new THREE.LatheGeometry(pts, 20);
    bGeo.computeVertexNormals();

    // 8 radial parabolic water arc streams from central spire into outer basin
    const arcs: THREE.TubeGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cos * 0.25, 1.72, sin * 0.25),
        new THREE.Vector3(cos * 0.95, 2.05, sin * 0.95),
        new THREE.Vector3(cos * 1.75, 1.45, sin * 1.75),
        new THREE.Vector3(cos * 2.25, 0.56, sin * 2.25),
      ]);
      arcs.push(new THREE.TubeGeometry(curve, 14, 0.032, 6, false));
    }

    return { bowlGeo: bGeo, arcGeos: arcs };
  }, []);

  useEffect(() => {
    return () => {
      bowlGeo.dispose();
      arcGeos.forEach((g) => g.dispose());
    };
  }, [bowlGeo, arcGeos]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (rippleARef.current) {
      const p = (t * 0.45) % 1;
      const s = 0.35 + p * 0.72;
      rippleARef.current.scale.set(s, s, 1);
      (rippleARef.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.45;
    }
    if (rippleBRef.current) {
      const p = ((t * 0.45) + 0.5) % 1;
      const s = 0.35 + p * 0.72;
      rippleBRef.current.scale.set(s, s, 1);
      (rippleBRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.45;
    }
    if (plumeRef.current) {
      const sy = 0.88 + Math.sin(t * 5.2) * 0.14;
      plumeRef.current.scale.set(0.95 + Math.cos(t * 4.1) * 0.08, sy, 0.95 + Math.cos(t * 4.1) * 0.08);
    }
    if (jetGroupRef.current) {
      const pulse = 0.97 + Math.sin(t * 3.6) * 0.03;
      jetGroupRef.current.scale.set(pulse, 1, pulse);
    }
  });

  return (
    <group position={position} scale={scale}>
      {/* Stepped Circular Stone Plinth */}
      <mesh position={[0, 0.05, 0]} material={PARK_MATS.stoneMid} receiveShadow>
        <cylinderGeometry args={[4.05, 4.2, 0.1, 28]} />
      </mesh>
      <mesh position={[0, 0.14, 0]} material={PARK_MATS.stoneLight} receiveShadow>
        <cylinderGeometry args={[3.55, 3.68, 0.1, 28]} />
      </mesh>

      {/* Outer Sculpted Stone Basin Rim */}
      <mesh position={[0, 0.38, 0]} material={PARK_MATS.stoneMid} castShadow receiveShadow>
        <cylinderGeometry args={[3.18, 3.3, 0.44, 24]} />
      </mesh>
      <mesh position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]} material={PARK_MATS.stoneLight} castShadow>
        <torusGeometry args={[3.14, 0.13, 10, 28]} />
      </mesh>

      {/* Deep Fountain Interior Floor & Shimmering Reflective Water Surface */}
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[2.98, 2.98, 0.08, 24]} />
        <meshStandardMaterial color="#1f4e5f" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.54, 0]} receiveShadow>
        <cylinderGeometry args={[3.0, 3.0, 0.05, 28]} />
        <meshPhysicalMaterial
          color="#3b93b2"
          roughness={0.07}
          metalness={0.14}
          clearcoat={0.96}
          envMapIntensity={1.5}
          transparent
          opacity={0.86}
        />
      </mesh>

      {/* Animated Expanding Surface Ripples */}
      <mesh ref={rippleARef} position={[0, 0.572, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.9, 2.04, 28]} />
        <meshBasicMaterial color="#d9f4ff" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh ref={rippleBRef} position={[0, 0.573, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.9, 2.04, 28]} />
        <meshBasicMaterial color="#d9f4ff" transparent opacity={0.4} depthWrite={false} />
      </mesh>

      {/* Carved Lathe Center Pedestal, Bowl & Finial */}
      <mesh position={[0, 0.45, 0]} geometry={bowlGeo} material={PARK_MATS.stoneLight} castShadow />

      {/* Central Vertical Plume & 8 Radial Parabolic Water Arcs */}
      <mesh ref={plumeRef} position={[0, 2.95, 0]}>
        <coneGeometry args={[0.32, 0.85, 10, 1, true]} />
        <meshStandardMaterial
          color="#d8f3ff"
          transparent
          opacity={0.62}
          roughness={0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <group ref={jetGroupRef}>
        {arcGeos.map((geo, idx) => (
          <mesh key={idx} geometry={geo}>
            <meshStandardMaterial
              color="#cbeeff"
              transparent
              opacity={0.68}
              roughness={0.1}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* 4 Low Stone Perimeter Accent Lights Glowing at Sunset/Night */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} position={[Math.cos(a) * 3.72, 0.18, Math.sin(a) * 3.72]}>
            <mesh position={[0, 0.16, 0]} material={PARK_MATS.stoneDark} castShadow>
              <cylinderGeometry args={[0.1, 0.12, 0.32, 8]} />
            </mesh>
            <mesh
              position={[0, 0.35, 0]}
              material={isEvening ? PARK_MATS.lampGlowOn : PARK_MATS.lampGlowOff}
            >
              <sphereGeometry args={[0.09, 8, 8]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// ============================================================================
// 2. PLAYGROUND ALPHA — Multi-Level Tower, Curved 3D Slide, Rock Wall & Swings
// ============================================================================
export const PlaygroundAlpha: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}> = ({ position, rotationY = 0, scale = 1 }) => {
  const swingARef = useRef<THREE.Group>(null);
  const swingBRef = useRef<THREE.Group>(null);

  const slideGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.75, 1.48, 0),
      new THREE.Vector3(1.55, 1.35, 0.38),
      new THREE.Vector3(2.35, 0.78, 0.92),
      new THREE.Vector3(3.05, 0.24, 1.15),
    ]);
    return new THREE.TubeGeometry(curve, 18, 0.28, 10, false);
  }, []);

  useEffect(() => () => slideGeo.dispose(), [slideGeo]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (swingARef.current) swingARef.current.rotation.x = Math.sin(t * 2.1) * 0.26;
    if (swingBRef.current) swingBRef.current.rotation.x = Math.sin(t * 2.1 + 1.8) * 0.2;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Cushioned EPDM Safety Flooring & Rounded Timber Curb */}
      <mesh position={[0, 0.02, 0]} material={PARK_MATS.epdmSand} receiveShadow>
        <boxGeometry args={[9.8, 0.04, 8.6]} />
      </mesh>
      <mesh position={[-2.1, 0.032, 0.2]} material={PARK_MATS.epdmTerracotta} receiveShadow>
        <boxGeometry args={[4.4, 0.022, 6.2]} />
      </mesh>
      <mesh position={[2.2, 0.032, -0.2]} material={PARK_MATS.epdmSage} receiveShadow>
        <boxGeometry args={[4.2, 0.022, 6.4]} />
      </mesh>
      {/* Timber Perimeter Border */}
      <mesh position={[0, 0.1, -4.25]} material={PARK_MATS.timberDark} castShadow>
        <boxGeometry args={[9.8, 0.16, 0.16]} />
      </mesh>
      <mesh position={[0, 0.1, 4.25]} material={PARK_MATS.timberDark} castShadow>
        <boxGeometry args={[9.8, 0.16, 0.16]} />
      </mesh>
      <mesh position={[-4.85, 0.1, 0]} material={PARK_MATS.timberDark} castShadow>
        <boxGeometry args={[0.16, 0.16, 8.5]} />
      </mesh>
      <mesh position={[4.85, 0.1, 0]} material={PARK_MATS.timberDark} castShadow>
        <boxGeometry args={[0.16, 0.16, 8.5]} />
      </mesh>

      {/* Multi-Level Play Tower + Gabled Roof + Curved Tubular Slide */}
      <group position={[1.3, 0.04, -0.8]}>
        {/* 4 Corner Timber Support Posts */}
        {[
          [-0.75, -0.75],
          [0.75, -0.75],
          [-0.75, 0.75],
          [0.75, 0.75],
        ].map(([px, pz], idx) => (
          <mesh key={idx} position={[px, 1.45, pz]} material={PARK_MATS.timber} castShadow>
            <boxGeometry args={[0.14, 2.9, 0.14]} />
          </mesh>
        ))}
        {/* Upper Play Deck & Lower Step Deck */}
        <mesh position={[0, 1.44, 0]} material={PARK_MATS.timberDark} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.12, 1.7]} />
        </mesh>
        <mesh position={[-1.15, 0.85, 0]} material={PARK_MATS.timberDark} castShadow receiveShadow>
          <boxGeometry args={[0.85, 0.1, 1.25]} />
        </mesh>
        {/* Colorful Safety Guardrails */}
        <mesh position={[0, 1.88, -0.78]} material={PARK_MATS.blue} castShadow>
          <boxGeometry args={[1.5, 0.55, 0.08]} />
        </mesh>
        <mesh position={[0, 1.88, 0.78]} material={PARK_MATS.blue} castShadow>
          <boxGeometry args={[1.5, 0.55, 0.08]} />
        </mesh>
        {/* Pitched Roof + Finial */}
        <mesh position={[0, 3.32, 0]} rotation={[0, Math.PI / 4, 0]} material={PARK_MATS.red} castShadow>
          <coneGeometry args={[1.42, 0.96, 4]} />
        </mesh>
        {/* Access Rung Ladder (Back) */}
        <group position={[0, 0.72, -1.05]} rotation={[0.32, 0, 0]}>
          {[-0.25, 0.25].map((lx, li) => (
            <mesh key={li} position={[lx, 0, 0]} material={PARK_MATS.steelSilver} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 1.55, 6]} />
            </mesh>
          ))}
          {[-0.45, -0.15, 0.15, 0.45].map((ry, ri) => (
            <mesh key={ri} position={[0, ry, 0]} rotation={[0, 0, Math.PI / 2]} material={PARK_MATS.yellow}>
              <cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />
            </mesh>
          ))}
        </group>
        {/* Rock Climbing Ramp with Colorful Handholds (West side) */}
        <group position={[-1.55, 0.55, 0]} rotation={[0, 0, 0.68]}>
          <mesh material={PARK_MATS.timber} castShadow>
            <boxGeometry args={[1.45, 0.1, 0.95]} />
          </mesh>
          {[
            [-0.4, 0.08, -0.22],
            [0.0, 0.08, 0.2],
            [0.35, 0.08, -0.15],
            [-0.18, 0.08, 0.0],
          ].map(([hx, hy, hz], hi) => (
            <mesh
              key={hi}
              position={[hx, hy, hz]}
              material={hi % 2 === 0 ? PARK_MATS.red : PARK_MATS.yellow}
            >
              <dodecahedronGeometry args={[0.075, 0]} />
            </mesh>
          ))}
        </group>
        {/* Real Curved 3D Tubular Slide */}
        <mesh geometry={slideGeo} material={PARK_MATS.yellow} castShadow />
        <mesh position={[3.1, 0.12, 1.15]} material={PARK_MATS.red} castShadow>
          <cylinderGeometry args={[0.32, 0.34, 0.12, 10]} />
        </mesh>
      </group>

      {/* A-Frame Double Swing Set with Chains & Gently Oscillating Seats */}
      <group position={[-2.4, 0.04, 0.2]}>
        {[-1.25, 1.25].map((sx, si) => (
          <group key={si} position={[sx, 0, 0]}>
            <mesh position={[0, 1.32, -0.52]} rotation={[0.36, 0, 0]} material={PARK_MATS.blue} castShadow>
              <cylinderGeometry args={[0.055, 0.065, 2.85, 8]} />
            </mesh>
            <mesh position={[0, 1.32, 0.52]} rotation={[-0.36, 0, 0]} material={PARK_MATS.blue} castShadow>
              <cylinderGeometry args={[0.055, 0.065, 2.85, 8]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 2.58, 0]} rotation={[0, 0, Math.PI / 2]} material={PARK_MATS.red} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 2.7, 8]} />
        </mesh>

        {/* Swing Seat A */}
        <group ref={swingARef} position={[-0.5, 2.58, 0]}>
          {[-0.22, 0.22].map((cx, ci) => (
            <mesh key={ci} position={[cx, -0.96, 0]} material={PARK_MATS.steelSilver}>
              <cylinderGeometry args={[0.014, 0.014, 1.92, 5]} />
            </mesh>
          ))}
          <mesh position={[0, -1.92, 0]} material={PARK_MATS.yellow} castShadow>
            <boxGeometry args={[0.52, 0.06, 0.26]} />
          </mesh>
        </group>

        {/* Swing Seat B */}
        <group ref={swingBRef} position={[0.5, 2.58, 0]}>
          {[-0.22, 0.22].map((cx, ci) => (
            <mesh key={ci} position={[cx, -0.96, 0]} material={PARK_MATS.steelSilver}>
              <cylinderGeometry args={[0.014, 0.014, 1.92, 5]} />
            </mesh>
          ))}
          <mesh position={[0, -1.92, 0]} material={PARK_MATS.red} castShadow>
            <boxGeometry args={[0.52, 0.06, 0.26]} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

// ============================================================================
// 3. PLAYGROUND BETA — Double Slides, Playhouse, Climbing Dome, Seesaw & Swings
// ============================================================================
export const PlaygroundBeta: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}> = ({ position, rotationY = 0, scale = 1 }) => {
  const swingLRef = useRef<THREE.Group>(null);
  const swingRRef = useRef<THREE.Group>(null);
  const seesawRef = useRef<THREE.Group>(null);

  const { slideLeftGeo, slideRightGeo } = useMemo(() => {
    const mkSlide = (zOffset: number) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.75, 1.32, zOffset),
        new THREE.Vector3(1.5, 1.15, zOffset),
        new THREE.Vector3(2.25, 0.56, zOffset),
        new THREE.Vector3(2.85, 0.16, zOffset),
      ]);
      return new THREE.TubeGeometry(curve, 14, 0.22, 8, false);
    };
    return { slideLeftGeo: mkSlide(-0.36), slideRightGeo: mkSlide(0.36) };
  }, []);

  useEffect(() => {
    return () => {
      slideLeftGeo.dispose();
      slideRightGeo.dispose();
    };
  }, [slideLeftGeo, slideRightGeo]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (swingLRef.current) swingLRef.current.rotation.x = Math.sin(t * 1.9 + 0.6) * 0.22;
    if (swingRRef.current) swingRRef.current.rotation.x = Math.sin(t * 1.9 + 2.5) * 0.18;
    if (seesawRef.current) seesawRef.current.rotation.z = Math.sin(t * 1.45) * 0.18;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Dual-Tone Safety Flooring & Timber Curb */}
      <mesh position={[0, 0.02, 0]} material={PARK_MATS.epdmSlateTeal} receiveShadow>
        <boxGeometry args={[10.2, 0.04, 8.6]} />
      </mesh>
      <mesh position={[0, 0.032, 0]} material={PARK_MATS.epdmSand} receiveShadow>
        <boxGeometry args={[7.8, 0.022, 6.4]} />
      </mesh>
      <mesh position={[0, 0.1, -4.25]} material={PARK_MATS.stoneMid} castShadow>
        <boxGeometry args={[10.2, 0.16, 0.16]} />
      </mesh>
      <mesh position={[0, 0.1, 4.25]} material={PARK_MATS.stoneMid} castShadow>
        <boxGeometry args={[10.2, 0.16, 0.16]} />
      </mesh>

      {/* Double-Slide Adventure Platform (North-West) */}
      <group position={[-2.2, 0.04, -1.6]}>
        {[
          [-0.65, -0.65],
          [0.65, -0.65],
          [-0.65, 0.65],
          [0.65, 0.65],
        ].map(([px, pz], idx) => (
          <mesh key={idx} position={[px, 1.15, pz]} material={PARK_MATS.timber} castShadow>
            <cylinderGeometry args={[0.075, 0.085, 2.3, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 1.3, 0]} material={PARK_MATS.timberDark} castShadow receiveShadow>
          <boxGeometry args={[1.55, 0.12, 1.55]} />
        </mesh>
        {/* Flat Sun Canopy */}
        <mesh position={[0, 2.35, 0]} material={PARK_MATS.teal} castShadow>
          <boxGeometry args={[1.75, 0.12, 1.75]} />
        </mesh>
        {/* Wooden Entry Steps */}
        {[-0.35, -0.65, -0.95].map((sx, si) => (
          <mesh key={si} position={[sx - 0.75, 1.0 - si * 0.32, 0]} material={PARK_MATS.timber} castShadow>
            <boxGeometry args={[0.32, 0.1, 0.9]} />
          </mesh>
        ))}
        {/* Double Parallel 3D Slides */}
        <mesh geometry={slideLeftGeo} material={PARK_MATS.teal} castShadow />
        <mesh geometry={slideRightGeo} material={PARK_MATS.coral} castShadow />
      </group>

      {/* 2-Seat Swing Set (North-East) */}
      <group position={[2.8, 0.04, -1.8]}>
        {[-1.2, 1.2].map((sx, si) => (
          <group key={si} position={[sx, 0, 0]}>
            <mesh position={[0, 1.25, -0.45]} rotation={[0.32, 0, 0]} material={PARK_MATS.teal} castShadow>
              <cylinderGeometry args={[0.05, 0.06, 2.65, 8]} />
            </mesh>
            <mesh position={[0, 1.25, 0.45]} rotation={[-0.32, 0, 0]} material={PARK_MATS.teal} castShadow>
              <cylinderGeometry args={[0.05, 0.06, 2.65, 8]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 2.45, 0]} rotation={[0, 0, Math.PI / 2]} material={PARK_MATS.coral} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 2.6, 8]} />
        </mesh>
        <group ref={swingLRef} position={[-0.48, 2.45, 0]}>
          {[-0.2, 0.2].map((cx, ci) => (
            <mesh key={ci} position={[cx, -0.92, 0]} material={PARK_MATS.steelSilver}>
              <cylinderGeometry args={[0.014, 0.014, 1.84, 5]} />
            </mesh>
          ))}
          <mesh position={[0, -1.84, 0]} material={PARK_MATS.coral} castShadow>
            <boxGeometry args={[0.48, 0.06, 0.25]} />
          </mesh>
        </group>
        <group ref={swingRRef} position={[0.48, 2.45, 0]}>
          {[-0.2, 0.2].map((cx, ci) => (
            <mesh key={ci} position={[cx, -0.92, 0]} material={PARK_MATS.steelSilver}>
              <cylinderGeometry args={[0.014, 0.014, 1.84, 5]} />
            </mesh>
          ))}
          <mesh position={[0, -1.84, 0]} material={PARK_MATS.teal} castShadow>
            <boxGeometry args={[0.48, 0.06, 0.25]} />
          </mesh>
        </group>
      </group>

      {/* Miniature Gable-Roofed Wooden Playhouse (South-West) */}
      <group position={[-2.9, 0.04, 2.1]}>
        <mesh position={[0, 0.72, 0]} material={PARK_MATS.timber} castShadow receiveShadow>
          <boxGeometry args={[1.65, 1.44, 1.45]} />
        </mesh>
        <mesh position={[0, 1.72, 0]} rotation={[0, Math.PI / 4, 0]} material={PARK_MATS.coral} castShadow>
          <coneGeometry args={[1.38, 0.76, 4]} />
        </mesh>
        {/* Doorway & Window */}
        <mesh position={[0, 0.55, 0.74]} material={PARK_MATS.timberDark}>
          <boxGeometry args={[0.52, 1.05, 0.05]} />
        </mesh>
        <mesh position={[0.84, 0.85, 0]}>
          <boxGeometry args={[0.05, 0.44, 0.44]} />
          <meshStandardMaterial color="#fef08a" roughness={0.35} />
        </mesh>
      </group>

      {/* Geodesic Climbing Dome / Monkey-Bar Frame (Center-South) */}
      <group position={[0.1, 0.04, 2.0]}>
        <mesh position={[0, 0.05, 0]} material={PARK_MATS.teal} castShadow>
          <sphereGeometry args={[1.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[1.18, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#facc15" wireframe />
        </mesh>
      </group>

      {/* Animated Seesaw + Spring Rider (South-East) */}
      <group position={[2.8, 0.04, 2.1]}>
        <mesh position={[0, 0.22, 0]} material={PARK_MATS.steelSilver} castShadow>
          <cylinderGeometry args={[0.12, 0.2, 0.44, 8]} />
        </mesh>
        <group ref={seesawRef} position={[0, 0.44, 0]}>
          <mesh material={PARK_MATS.coral} castShadow>
            <boxGeometry args={[2.5, 0.08, 0.28]} />
          </mesh>
          {[-1.08, 1.08].map((hx, hi) => (
            <mesh key={hi} position={[hx, 0.14, 0]} material={PARK_MATS.yellow}>
              <boxGeometry args={[0.18, 0.22, 0.28]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
};

// ============================================================================
// 4. WINDING CURVED STONE WALKWAY RIBBON WITH STONE BORDER CURBS
// ============================================================================
export const WindingStonePathway: React.FC<{
  points: Array<[number, number]>;
  width?: number;
  y: number;
  color?: string;
}> = React.memo(({ points, width = 2.0, y, color = '#dbd2c1' }) => {
  const { pathGeo, curbLeftGeo, curbRightGeo } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([px, pz]) => new THREE.Vector3(px, 0, pz)),
      false,
      'catmullrom',
      0.5,
    );
    const steps = Math.max(20, points.length * 10);
    const halfW = width * 0.5;
    const curbW = 0.14;

    const buildRibbon = (innerOff: number, outerOff: number) => {
      const positions: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pt = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        const nx = -tan.z;
        const nz = tan.x;
        const nLen = Math.hypot(nx, nz) || 1;
        const ux = nx / nLen;
        const uz = nz / nLen;

        positions.push(pt.x + ux * innerOff, 0, pt.z + uz * innerOff);
        positions.push(pt.x + ux * outerOff, 0, pt.z + uz * outerOff);
        if (i < steps) {
          const b = i * 2;
          indices.push(b, b + 2, b + 1);
          indices.push(b + 1, b + 2, b + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      return g;
    };

    return {
      pathGeo: buildRibbon(-halfW, halfW),
      curbLeftGeo: buildRibbon(-halfW - curbW, -halfW),
      curbRightGeo: buildRibbon(halfW, halfW + curbW),
    };
  }, [points, width]);

  useEffect(() => {
    return () => {
      pathGeo.dispose();
      curbLeftGeo.dispose();
      curbRightGeo.dispose();
    };
  }, [pathGeo, curbLeftGeo, curbRightGeo]);

  return (
    <group position={[0, y, 0]}>
      <mesh geometry={pathGeo} receiveShadow>
        <meshStandardMaterial
          color={color}
          roughness={0.86}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      <mesh position={[0, 0.012, 0]} geometry={curbLeftGeo} material={PARK_MATS.stoneMid} receiveShadow />
      <mesh position={[0, 0.012, 0]} geometry={curbRightGeo} material={PARK_MATS.stoneMid} receiveShadow />
    </group>
  );
});

// ============================================================================
// 5. PARK LANDSCAPING & FURNITURE PROPS
// ============================================================================
export const ParkFlowerbed: React.FC<{
  position: [number, number, number];
  width?: number;
  depth?: number;
  rotationY?: number;
  circular?: boolean;
}> = ({ position, width = 3.2, depth = 1.6, rotationY = 0, circular = false }) => {
  const flowerMats = [
    PARK_MATS.flowerPink,
    PARK_MATS.flowerGold,
    PARK_MATS.flowerViolet,
    PARK_MATS.flowerCoral,
    PARK_MATS.flowerBlue,
  ];

  if (circular) {
    const r = Math.min(width, depth) * 0.5;
    return (
      <group position={position}>
        <mesh position={[0, 0.1, 0]} material={PARK_MATS.stoneMid} receiveShadow castShadow>
          <cylinderGeometry args={[r, r + 0.08, 0.2, 16]} />
        </mesh>
        <mesh position={[0, 0.16, 0]} material={PARK_MATS.soil} receiveShadow>
          <cylinderGeometry args={[r - 0.14, r - 0.14, 0.14, 16]} />
        </mesh>
        <mesh position={[0, 0.34, 0]} material={PARK_MATS.bushGreen} castShadow>
          <dodecahedronGeometry args={[r * 0.42, 0]} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * r * 0.58, 0.28, Math.sin(a) * r * 0.58]}
              material={flowerMats[i % flowerMats.length]}
              castShadow
            >
              <dodecahedronGeometry args={[0.16, 0]} />
            </mesh>
          );
        })}
      </group>
    );
  }

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.1, 0]} material={PARK_MATS.stoneMid} castShadow receiveShadow>
        <boxGeometry args={[width, 0.2, depth]} />
      </mesh>
      <mesh position={[0, 0.16, 0]} material={PARK_MATS.soil} receiveShadow>
        <boxGeometry args={[width - 0.22, 0.14, depth - 0.22]} />
      </mesh>
      {[-0.32, 0, 0.32].map((fx, i) => (
        <group key={i} position={[fx * width, 0.28, 0]}>
          <mesh material={i === 1 ? PARK_MATS.bushLight : PARK_MATS.bushGreen} castShadow>
            <dodecahedronGeometry args={[0.26, 0]} />
          </mesh>
          <mesh position={[0.08, 0.15, 0.08]} material={flowerMats[i % flowerMats.length]}>
            <sphereGeometry args={[0.11, 6, 6]} />
          </mesh>
          <mesh position={[-0.09, 0.14, -0.06]} material={flowerMats[(i + 2) % flowerMats.length]}>
            <sphereGeometry args={[0.09, 6, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export const ParkLampPost: React.FC<{
  position: [number, number, number];
  timeOfDay: TimeOfDay;
}> = ({ position, timeOfDay }) => {
  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';
  return (
    <group position={position}>
      <mesh position={[0, 0.22, 0]} material={PARK_MATS.iron} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 0.44, 8]} />
      </mesh>
      <mesh position={[0, 1.75, 0]} material={PARK_MATS.iron} castShadow>
        <cylinderGeometry args={[0.045, 0.075, 2.75, 8]} />
      </mesh>
      <mesh
        position={[0, 3.22, 0]}
        material={isEvening ? PARK_MATS.lampGlowOn : PARK_MATS.lampGlowOff}
      >
        <sphereGeometry args={[0.2, 10, 10]} />
      </mesh>
      <mesh position={[0, 3.42, 0]} material={PARK_MATS.iron}>
        <coneGeometry args={[0.24, 0.18, 8]} />
      </mesh>
      {isEvening && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} material={PARK_MATS.lampPool}>
          <circleGeometry args={[3.2, 16]} />
        </mesh>
      )}
    </group>
  );
};

export const ParkLitterBin: React.FC<{
  position: [number, number, number];
  rotationY?: number;
}> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[0, 0.36, 0]} material={PARK_MATS.timberDark} castShadow>
      <cylinderGeometry args={[0.22, 0.2, 0.68, 10]} />
    </mesh>
    <mesh position={[0, 0.76, 0]} material={PARK_MATS.iron} castShadow>
      <cylinderGeometry args={[0.24, 0.24, 0.14, 10]} />
    </mesh>
  </group>
);

export const ParkStoneBollard: React.FC<{
  position: [number, number, number];
  timeOfDay: TimeOfDay;
}> = ({ position, timeOfDay }) => {
  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';
  return (
    <group position={position}>
      <mesh position={[0, 0.36, 0]} material={PARK_MATS.stoneMid} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 0.72, 10]} />
      </mesh>
      <mesh
        position={[0, 0.62, 0]}
        material={isEvening ? PARK_MATS.lampGlowOn : PARK_MATS.stoneLight}
      >
        <cylinderGeometry args={[0.135, 0.135, 0.08, 10]} />
      </mesh>
    </group>
  );
};

export const ParkPicnicSet: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  umbrellaColor?: string;
}> = ({ position, rotationY = 0, umbrellaColor = '#b91c1c' }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {/* Table Top & Twin Benches */}
    <mesh position={[0, 0.72, 0]} material={PARK_MATS.timber} castShadow receiveShadow>
      <boxGeometry args={[1.9, 0.08, 0.92]} />
    </mesh>
    {[-0.68, 0.68].map((bz, i) => (
      <mesh key={i} position={[0, 0.42, bz]} material={PARK_MATS.timberDark} castShadow receiveShadow>
        <boxGeometry args={[1.85, 0.07, 0.34]} />
      </mesh>
    ))}
    {[-0.68, 0.68].map((lx, i) => (
      <mesh key={i} position={[lx, 0.36, 0]} material={PARK_MATS.iron} castShadow>
        <boxGeometry args={[0.08, 0.72, 1.48]} />
      </mesh>
    ))}
    {/* Sun Parasol Umbrella */}
    <mesh position={[0, 1.38, 0]} material={PARK_MATS.timberDark} castShadow>
      <cylinderGeometry args={[0.035, 0.04, 2.1, 8]} />
    </mesh>
    <mesh position={[0, 2.38, 0]} castShadow>
      <coneGeometry args={[1.38, 0.56, 8]} />
      <meshStandardMaterial color={umbrellaColor} roughness={0.78} side={THREE.DoubleSide} />
    </mesh>
  </group>
);

export const ParkInfoBoard: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  title?: string;
}> = React.memo(({ position, rotationY = 0, title = 'LINDENHOF PARK MAP' }) => {
  const boardTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = '#3f624c';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 244, 148);
    ctx.fillStyle = '#2d4f3c';
    ctx.fillRect(14, 14, 228, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 128, 35, 212);
    // Decorative stylized map elements
    ctx.fillStyle = '#8ec5a8';
    ctx.fillRect(24, 58, 96, 78);
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(174, 88, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d97706';
    ctx.fillRect(136, 118, 86, 18);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [title]);

  useEffect(() => () => boardTex.dispose(), [boardTex]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[-0.62, 0.62].map((px, i) => (
        <mesh key={i} position={[px, 0.88, 0]} material={PARK_MATS.timberDark} castShadow>
          <boxGeometry args={[0.1, 1.76, 0.1]} />
        </mesh>
      ))}
      <mesh position={[0, 1.18, 0]} material={PARK_MATS.timber} castShadow>
        <boxGeometry args={[1.38, 0.88, 0.12]} />
      </mesh>
      <mesh position={[0, 1.18, 0.068]}>
        <planeGeometry args={[1.22, 0.76]} />
        <meshStandardMaterial map={boardTex} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.76, 0]} rotation={[0.2, 0, 0]} material={PARK_MATS.timberDark} castShadow>
        <boxGeometry args={[1.56, 0.1, 0.42]} />
      </mesh>
    </group>
  );
});

export const LowParkBorderFence: React.FC<{
  position: [number, number, number];
  length: number;
  rotationY?: number;
}> = ({ position, length, rotationY = 0 }) => {
  const postCount = Math.max(2, Math.floor(length / 1.8) + 1);
  const posts: number[] = [];
  for (let i = 0; i < postCount; i++) {
    posts.push(-length * 0.5 + (i / (postCount - 1)) * length);
  }
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {posts.map((px, i) => (
        <mesh key={i} position={[px, 0.28, 0]} material={PARK_MATS.iron} castShadow>
          <cylinderGeometry args={[0.035, 0.045, 0.56, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 0.48, 0]} material={PARK_MATS.iron} castShadow>
        <boxGeometry args={[length, 0.045, 0.045]} />
      </mesh>
      <mesh position={[0, 0.22, 0]} material={PARK_MATS.iron}>
        <boxGeometry args={[length, 0.035, 0.035]} />
      </mesh>
    </group>
  );
};

export const ParkPlanterPot: React.FC<{
  position: [number, number, number];
  flowerVariant?: 'pink' | 'gold' | 'violet' | 'coral';
}> = ({ position, flowerVariant = 'pink' }) => {
  const fMat =
    flowerVariant === 'gold'
      ? PARK_MATS.flowerGold
      : flowerVariant === 'violet'
        ? PARK_MATS.flowerViolet
        : flowerVariant === 'coral'
          ? PARK_MATS.flowerCoral
          : PARK_MATS.flowerPink;

  return (
    <group position={position}>
      <mesh position={[0, 0.24, 0]} material={PARK_MATS.stoneLight} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.26, 0.48, 12]} />
      </mesh>
      <mesh position={[0, 0.52, 0]} material={PARK_MATS.bushGreen} castShadow>
        <dodecahedronGeometry args={[0.3, 0]} />
      </mesh>
      <mesh position={[0.1, 0.68, 0.06]} material={fMat}>
        <sphereGeometry args={[0.13, 6, 6]} />
      </mesh>
      <mesh position={[-0.1, 0.65, -0.08]} material={fMat}>
        <sphereGeometry args={[0.11, 6, 6]} />
      </mesh>
    </group>
  );
};
