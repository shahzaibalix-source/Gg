import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeOfDay } from '../types';
import {
  createGrassBladeMaterial,
  createGrassTuftGeo,
  createRealisticWaterMaterial,
} from '../materials/realisticNature';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

// Shared module-level grass geometry & material so all parks/meadows share 1 GPU buffer + 1 shader
let sharedGrassGeo: THREE.BufferGeometry | null = null;
let sharedGrassMat: THREE.MeshStandardMaterial | null = null;

function getSharedGrassResources() {
  if (!sharedGrassGeo) sharedGrassGeo = createGrassTuftGeo();
  if (!sharedGrassMat) sharedGrassMat = createGrassBladeMaterial('shared');
  return { geo: sharedGrassGeo, mat: sharedGrassMat };
}

export interface GrassTuftPlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  tint: string;
}

/**
 * Renders thousands of wind-animated 3D grass blade tufts in a single frustum-culled draw call.
 */
export const InstancedGrassField: React.FC<{
  tufts: GrassTuftPlacement[];
}> = React.memo(({ tufts }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { geo, mat } = useMemo(() => getSharedGrassResources(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || tufts.length === 0) return;

    for (let i = 0; i < tufts.length; i++) {
      const t = tufts[i];
      _dummy.position.set(t.x, t.y, t.z);
      _dummy.rotation.set(0, t.rotY, 0);
      _dummy.scale.set(t.scale, t.scale * 0.95, t.scale);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      _color.set(t.tint);
      mesh.setColorAt(i, _color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [tufts]);

  if (tufts.length === 0) return null;

  return <instancedMesh ref={meshRef} args={[geo, mat, tufts.length]} frustumCulled />;
});

/**
 * Deterministic generator for lush 3D grass tufts inside a rectangular park lawn.
 */
export function generateParkGrassTufts(opts: {
  cx: number;
  cz: number;
  y: number;
  width: number;
  depth: number;
  count: number;
  seed: number;
  excludeFn?: (x: number, z: number) => boolean;
}): GrassTuftPlacement[] {
  let s = opts.seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const tints = ['#629b45', '#74ad52', '#52893b', '#81ba5c', '#5d9344'];
  const out: GrassTuftPlacement[] = [];

  for (let i = 0; i < opts.count * 2 && out.length < opts.count; i++) {
    const x = opts.cx + (rand() - 0.5) * opts.width;
    const z = opts.cz + (rand() - 0.5) * opts.depth;
    if (opts.excludeFn && opts.excludeFn(x, z)) continue;
    out.push({
      x,
      y: opts.y,
      z,
      scale: 0.72 + rand() * 0.65,
      rotY: rand() * Math.PI * 2,
      tint: tints[out.length % tints.length],
    });
  }
  return out;
}

/**
 * Animated 3D GLSL wave-rippled water surface (supports canals, lakes, and ponds).
 */
export const AnimatedWaterPlane: React.FC<{
  position: [number, number, number];
  width: number;
  depth: number;
  segmentsX?: number;
  segmentsZ?: number;
  baseColor?: string;
  crestColor?: string;
  waveAmp?: number;
  rippleScale?: number;
  tag?: string;
}> = React.memo(
  ({
    position,
    width,
    depth,
    segmentsX = 24,
    segmentsZ = 24,
    baseColor = '#1b6e8f',
    crestColor = '#93def2',
    waveAmp = 0.032,
    rippleScale = 1.0,
    tag = 'water',
  }) => {
    const geo = useMemo(() => {
      const g = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
      g.rotateX(-Math.PI / 2);
      g.computeBoundingSphere();
      return g;
    }, [width, depth, segmentsX, segmentsZ]);

    const mat = useMemo(
      () =>
        createRealisticWaterMaterial({
          baseColor,
          crestColor,
          waveAmp,
          rippleScale,
          opacity: 0.94,
          tag,
        }),
      [baseColor, crestColor, waveAmp, rippleScale, tag],
    );

    useEffect(() => {
      return () => {
        geo.dispose();
        mat.dispose();
      };
    }, [geo, mat]);

    return <mesh position={position} geometry={geo} material={mat} receiveShadow />;
  },
);

const BUS_STOP_MATS = {
  steel: new THREE.MeshStandardMaterial({ color: '#26303d', roughness: 0.42, metalness: 0.68 }),
  roof: new THREE.MeshStandardMaterial({ color: '#3b4a5e', roughness: 0.48, metalness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({
    color: '#bae6fd',
    transparent: true,
    opacity: 0.46,
    roughness: 0.12,
    depthWrite: false,
  }),
  wood: new THREE.MeshStandardMaterial({ color: '#8f5d38', roughness: 0.74 }),
  signYellow: new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.38, metalness: 0.25 }),
  signSlate: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 }),
};

/**
 * European covered glass-and-iron bus stop shelter with seating bench and route totem.
 */
export const BusStopShelter: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  timeOfDay: TimeOfDay;
}> = React.memo(({ position, rotationY = 0, timeOfDay }) => {
  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Base granite curb pad */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[4.4, 0.08, 1.85]} />
        <meshStandardMaterial color="#c8c2b6" roughness={0.86} />
      </mesh>
      {/* Left/Right/Center Iron Pillars */}
      {[-1.85, 0, 1.85].map((px) => (
        <mesh key={px} position={[px, 1.25, -0.68]} material={BUS_STOP_MATS.steel} castShadow>
          <boxGeometry args={[0.1, 2.4, 0.1]} />
        </mesh>
      ))}
      {[-1.85, 1.85].map((px) => (
        <mesh key={`f-${px}`} position={[px, 1.25, 0.58]} material={BUS_STOP_MATS.steel} castShadow>
          <boxGeometry args={[0.09, 2.4, 0.09]} />
        </mesh>
      ))}
      {/* Back & Side Glass Windscreens */}
      <mesh position={[0, 1.25, -0.66]} material={BUS_STOP_MATS.glass}>
        <boxGeometry args={[3.6, 2.05, 0.04]} />
      </mesh>
      <mesh position={[-1.85, 1.25, -0.05]} material={BUS_STOP_MATS.glass}>
        <boxGeometry args={[0.04, 2.05, 1.18]} />
      </mesh>
      {/* Sloped Shelter Roof Canopy */}
      <mesh position={[0, 2.52, -0.02]} rotation={[0.08, 0, 0]} material={BUS_STOP_MATS.roof} castShadow>
        <boxGeometry args={[4.2, 0.12, 1.75]} />
      </mesh>
      {/* Ceiling Warm Strip Light */}
      <mesh position={[0, 2.43, 0]}>
        <boxGeometry args={[2.8, 0.04, 0.14]} />
        <meshStandardMaterial
          color="#fff4d6"
          emissive="#ffbe55"
          emissiveIntensity={isEvening ? 1.8 : 0.08}
        />
      </mesh>
      {/* Slatted Timber Bench Inside Shelter */}
      <mesh position={[-0.2, 0.48, -0.25]} material={BUS_STOP_MATS.wood} castShadow>
        <boxGeometry args={[2.3, 0.08, 0.45]} />
      </mesh>
      <mesh position={[-1.1, 0.24, -0.25]} material={BUS_STOP_MATS.steel}>
        <boxGeometry args={[0.08, 0.46, 0.42]} />
      </mesh>
      <mesh position={[0.7, 0.24, -0.25]} material={BUS_STOP_MATS.steel}>
        <boxGeometry args={[0.08, 0.46, 0.42]} />
      </mesh>
      {/* Transit Route Totem Pole Beside Shelter */}
      <mesh position={[2.4, 1.45, 0.2]} material={BUS_STOP_MATS.steel} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 2.8, 8]} />
      </mesh>
      <mesh position={[2.4, 2.45, 0.2]} material={BUS_STOP_MATS.signYellow}>
        <cylinderGeometry args={[0.26, 0.26, 0.07, 14]} />
      </mesh>
      <mesh position={[2.4, 1.9, 0.2]} material={BUS_STOP_MATS.signSlate}>
        <boxGeometry args={[0.38, 0.62, 0.08]} />
      </mesh>
    </group>
  );
});

/**
 * Venetian-style mahogany & brass canal gondola with subtle water bobbing animation.
 */
export const VenetianGondola: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  phase?: number;
  accentColor?: string;
}> = ({ position, rotationY = 0, phase = 0, accentColor = '#9b1c1c' }) => {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime + phase;
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(t * 1.4) * 0.04;
      ref.current.rotation.z = Math.sin(t * 1.1) * 0.025;
      ref.current.rotation.x = Math.cos(t * 0.9) * 0.015;
    }
  });

  return (
    <group ref={ref} position={position} rotation={[0, rotationY, 0]}>
      {/* Glossy Ebony Mahogany Hull */}
      <mesh position={[0, 0.24, 0]} castShadow>
        <boxGeometry args={[1.25, 0.46, 7.2]} />
        <meshStandardMaterial color="#18181b" roughness={0.28} metalness={0.18} />
      </mesh>
      {/* Upturned Prow & Stern Tips */}
      <mesh position={[0, 0.66, 3.6]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[0.38, 0.92, 0.52]} />
        <meshStandardMaterial color="#18181b" roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.62, -3.55]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.36, 0.8, 0.48]} />
        <meshStandardMaterial color="#18181b" roughness={0.28} />
      </mesh>
      {/* Metallic Silver Ferro Nose Ornament */}
      <mesh position={[0, 1.04, 3.85]}>
        <boxGeometry args={[0.08, 0.48, 0.24]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.85} />
      </mesh>
      {/* Velvet Cabin Cushions */}
      <mesh position={[0, 0.44, -0.3]}>
        <boxGeometry args={[0.92, 0.22, 2.2]} />
        <meshStandardMaterial color={accentColor} roughness={0.68} />
      </mesh>
      {/* Gold Trim Gunwales */}
      <mesh position={[-0.6, 0.49, 0]}>
        <boxGeometry args={[0.06, 0.06, 5.8]} />
        <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.75} />
      </mesh>
      <mesh position={[0.6, 0.49, 0]}>
        <boxGeometry args={[0.06, 0.06, 5.8]} />
        <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.75} />
      </mesh>
    </group>
  );
};
