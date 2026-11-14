import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeOfDay } from '../types';

export type CarBodyStyle = 'sedan' | 'hatchback' | 'wagon';

interface CarMeshProps {
  color: string;
  style: CarBodyStyle;
  timeOfDay: TimeOfDay;
  speedRef?: React.MutableRefObject<number>;
  steerRef?: React.MutableRefObject<number>;
  isBraking?: boolean;
}

// -----------------------------------------------------------------------------
// Module-Level Shared Vehicle Geometries & Wheel/Trim Materials
// -----------------------------------------------------------------------------
const BODY_GEO_CACHE = new Map<CarBodyStyle, { bodyGeo: THREE.BufferGeometry; cabinGeo: THREE.BufferGeometry }>();

function getVehicleGeometries(style: CarBodyStyle) {
  const existing = BODY_GEO_CACHE.get(style);
  if (existing) return existing;

  const s = new THREE.Shape();
  s.moveTo(-2.06, 0.24);
  s.lineTo(2.02, 0.24);
  s.lineTo(2.12, 0.44);
  s.lineTo(2.05, 0.74);
  s.lineTo(1.22, 0.86);
  if (style === 'hatchback') {
    s.lineTo(0.75, 1.38);
    s.lineTo(-1.35, 1.42);
    s.lineTo(-1.92, 0.88);
  } else if (style === 'wagon') {
    s.lineTo(0.7, 1.38);
    s.lineTo(-1.68, 1.36);
    s.lineTo(-2.04, 0.84);
  } else {
    s.lineTo(0.68, 1.36);
    s.lineTo(-0.98, 1.36);
    s.lineTo(-1.55, 0.92);
    s.lineTo(-2.06, 0.84);
  }
  s.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: 1.66,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  bodyGeo.translate(0, 0, -0.83);
  bodyGeo.rotateY(-Math.PI / 2);
  bodyGeo.computeVertexNormals();

  const cs = new THREE.Shape();
  cs.moveTo(1.12, 0.82);
  cs.lineTo(0.64, 1.31);
  if (style === 'hatchback') {
    cs.lineTo(-1.25, 1.34);
    cs.lineTo(-1.74, 0.88);
  } else if (style === 'wagon') {
    cs.lineTo(-1.56, 1.29);
    cs.lineTo(-1.86, 0.84);
  } else {
    cs.lineTo(-0.92, 1.3);
    cs.lineTo(-1.42, 0.88);
  }
  cs.closePath();

  const cabinGeo = new THREE.ExtrudeGeometry(cs, {
    depth: 1.52,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  cabinGeo.translate(0, 0, -0.76);
  cabinGeo.rotateY(-Math.PI / 2);
  cabinGeo.computeVertexNormals();

  const entry = { bodyGeo, cabinGeo };
  BODY_GEO_CACHE.set(style, entry);
  return entry;
}

const WHEEL_GEOS = {
  tire: new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18),
  rim: new THREE.CylinderGeometry(0.21, 0.21, 0.25, 12),
  hub: new THREE.CylinderGeometry(0.07, 0.07, 0.265, 10),
};

const CAR_SHARED_MATERIALS = {
  tire: new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: 0.86, metalness: 0.05 }),
  rim: new THREE.MeshStandardMaterial({ color: '#cfd5dc', roughness: 0.26, metalness: 0.85 }),
  hub: new THREE.MeshStandardMaterial({ color: '#2f353c', roughness: 0.35, metalness: 0.7 }),
  grille: new THREE.MeshStandardMaterial({ color: '#1f2328', roughness: 0.55, metalness: 0.4 }),
  bumper: new THREE.MeshStandardMaterial({ color: '#23272c', roughness: 0.65, metalness: 0.2 }),
  cabin: new THREE.MeshPhysicalMaterial({
    color: '#1f2933',
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1.0,
    envMapIntensity: 1.6,
  }),
};

/**
 * Stylized-realistic European vehicle assembly (length ~4.25m, width ~1.84m).
 * Local +Z is forward, origin (y=0) sits flush on road surface.
 */
export const CarMesh: React.FC<CarMeshProps> = ({
  color,
  style,
  timeOfDay,
  speedRef,
  steerRef,
  isBraking = false,
}) => {
  const wheelFL = useRef<THREE.Group>(null);
  const wheelFR = useRef<THREE.Group>(null);
  const wheelRL = useRef<THREE.Group>(null);
  const wheelRR = useRef<THREE.Group>(null);
  const steerFL = useRef<THREE.Group>(null);
  const steerFR = useRef<THREE.Group>(null);
  const wheelAngleRef = useRef(0);

  const { bodyGeo, cabinGeo } = getVehicleGeometries(style);

  // Sync wheel rotation & front steering cleanly inside R3F's render loop (no rogue rAF loops)
  useFrame((_, delta) => {
    if (!speedRef) return;
    const dt = Math.min(delta, 0.05);
    wheelAngleRef.current += (speedRef.current / 0.34) * dt;
    const rot = wheelAngleRef.current;
    if (wheelFL.current) wheelFL.current.rotation.x = rot;
    if (wheelFR.current) wheelFR.current.rotation.x = rot;
    if (wheelRL.current) wheelRL.current.rotation.x = rot;
    if (wheelRR.current) wheelRR.current.rotation.x = rot;
    const steer = steerRef?.current ?? 0;
    if (steerFL.current) steerFL.current.rotation.y = steer;
    if (steerFR.current) steerFR.current.rotation.y = steer;
  });

  const headlightsOn = timeOfDay === 'night' || timeOfDay === 'sunset';
  const headlightEmissive = headlightsOn ? 2.4 : 0.35;

  return (
    <group>
      {/* Main Painted Car Body */}
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={color}
          roughness={0.28}
          metalness={0.42}
          clearcoat={0.85}
          clearcoatRoughness={0.14}
        />
      </mesh>

      {/* Dark Tinted Window Cabin */}
      <mesh geometry={cabinGeo} scale={[1.015, 0.985, 0.985]} material={CAR_SHARED_MATERIALS.cabin} />

      {/* Front Grille & Rear Bumper Trim */}
      <mesh position={[0, 0.44, 2.1]} material={CAR_SHARED_MATERIALS.grille}>
        <boxGeometry args={[1.48, 0.22, 0.08]} />
      </mesh>
      <mesh position={[0, 0.36, -2.08]} material={CAR_SHARED_MATERIALS.bumper}>
        <boxGeometry args={[1.54, 0.2, 0.08]} />
      </mesh>

      {/* Headlights */}
      <mesh position={[-0.62, 0.58, 2.11]}>
        <boxGeometry args={[0.28, 0.13, 0.06]} />
        <meshStandardMaterial
          color="#fff7de"
          emissive="#ffefc2"
          emissiveIntensity={headlightEmissive}
          roughness={0.15}
        />
      </mesh>
      <mesh position={[0.62, 0.58, 2.11]}>
        <boxGeometry args={[0.28, 0.13, 0.06]} />
        <meshStandardMaterial
          color="#fff7de"
          emissive="#ffefc2"
          emissiveIntensity={headlightEmissive}
          roughness={0.15}
        />
      </mesh>

      {/* Taillights */}
      <mesh position={[-0.64, 0.68, -2.09]}>
        <boxGeometry args={[0.28, 0.12, 0.06]} />
        <meshStandardMaterial
          color="#cc2222"
          emissive="#ff2a2a"
          emissiveIntensity={isBraking ? 2.8 : headlightsOn ? 1.4 : 0.4}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0.64, 0.68, -2.09]}>
        <boxGeometry args={[0.28, 0.12, 0.06]} />
        <meshStandardMaterial
          color="#cc2222"
          emissive="#ff2a2a"
          emissiveIntensity={isBraking ? 2.8 : headlightsOn ? 1.4 : 0.4}
          roughness={0.2}
        />
      </mesh>

      {/* Side Mirrors */}
      <mesh position={[-0.93, 0.88, 0.72]}>
        <boxGeometry args={[0.16, 0.1, 0.14]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.35} />
      </mesh>
      <mesh position={[0.93, 0.88, 0.72]}>
        <boxGeometry args={[0.16, 0.1, 0.14]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.35} />
      </mesh>

      {/* 4 Wheels with Tires & Alloy Rims */}
      <group position={[-0.84, 0.34, 1.3]} ref={steerFL}>
        <group ref={wheelFL}>
          <WheelAssembly />
        </group>
      </group>
      <group position={[0.84, 0.34, 1.3]} ref={steerFR}>
        <group ref={wheelFR}>
          <WheelAssembly />
        </group>
      </group>
      <group position={[-0.84, 0.34, -1.28]} ref={wheelRL}>
        <WheelAssembly />
      </group>
      <group position={[0.84, 0.34, -1.28]} ref={wheelRR}>
        <WheelAssembly />
      </group>
    </group>
  );
};

const WheelAssembly: React.FC = () => (
  <group rotation={[0, 0, Math.PI / 2]}>
    <mesh geometry={WHEEL_GEOS.tire} material={CAR_SHARED_MATERIALS.tire} castShadow />
    <mesh geometry={WHEEL_GEOS.rim} material={CAR_SHARED_MATERIALS.rim} />
    <mesh geometry={WHEEL_GEOS.hub} material={CAR_SHARED_MATERIALS.hub} />
  </group>
);
