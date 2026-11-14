import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BusinessSpec, TimeOfDay } from '../types';
import { CityTextureSet } from '../materials/proceduralTextures';
import { CarMesh } from './VehicleModels';

interface CommercialBuildingProps {
  spec: BusinessSpec;
  textures: CityTextureSet;
  timeOfDay: TimeOfDay;
  doorOpen?: boolean;
}

/**
 * Multi-part European commercial building (Bistro, Café, Supermarket, Boutique, Dealership, Office).
 * Local +Z faces the commercial street promenade.
 */
export const CommercialBuilding: React.FC<CommercialBuildingProps> = ({
  spec,
  textures,
  timeOfDay,
  doorOpen = false,
}) => {
  const signRef = useRef<THREE.MeshStandardMaterial>(null);
  const doorHingeRef = useRef<THREE.Group>(null);
  const { width, depth, height, primaryColor, accentColor, category, hasOutdoorSeating, name } =
    spec;

  const isNight = timeOfDay === 'night' || timeOfDay === 'sunset';

  const signTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#e7d5a8';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 112);

    ctx.fillStyle = '#fcfaf4';
    ctx.font = '700 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 22), 256, 66);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [name, accentColor]);

  useEffect(() => () => signTexture.dispose(), [signTexture]);

  useFrame((state, delta) => {
    if (signRef.current) {
      const base = isNight ? 1.55 : 0.32;
      const shimmer = Math.sin(state.clock.elapsedTime * 2.2) * (isNight ? 0.25 : 0.05);
      signRef.current.emissiveIntensity = base + shimmer;
    }
    if (doorHingeRef.current) {
      const targetAngle = doorOpen ? Math.PI * 0.46 : 0;
      doorHingeRef.current.rotation.y = THREE.MathUtils.damp(
        doorHingeRef.current.rotation.y,
        targetAngle,
        9,
        Math.min(delta, 0.05),
      );
    }
  });

  const frontZ = depth / 2;

  return (
    <group>
      {/* Stone Plinth */}
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.25, 0.28, depth + 0.25]} />
        <meshStandardMaterial color="#6e6a64" roughness={0.9} />
      </mesh>

      {/* Main Facade Volume */}
      <mesh position={[0, height / 2 + 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          map={category === 'office' ? textures.plaster : textures.brick}
          color={primaryColor}
          roughness={0.82}
        />
      </mesh>

      {/* Upper Cornice Parapet */}
      <mesh position={[0, height + 0.26, 0]} castShadow>
        <boxGeometry args={[width + 0.45, 0.34, depth + 0.45]} />
        <meshStandardMaterial color={accentColor} roughness={0.62} />
      </mesh>

      {/* Ground Floor Storefront Glass Vitrine */}
      <mesh position={[0, 1.5, frontZ + 0.04]}>
        <boxGeometry args={[width - 1.2, 2.3, 0.1]} />
        <meshPhysicalMaterial
          color="#a8cde0"
          emissive={isNight ? '#ffcb7d' : '#2d414e'}
          emissiveIntensity={isNight ? 0.85 : 0.12}
          roughness={0.08}
          metalness={0.2}
          clearcoat={0.9}
        />
      </mesh>

      {/* Storefront Frame & Hinged Entrance Door */}
      <mesh position={[0, 1.35, frontZ + 0.09]} castShadow>
        <boxGeometry args={[1.45, 2.35, 0.12]} />
        <meshStandardMaterial color="#272c33" roughness={0.4} metalness={0.55} />
      </mesh>
      <mesh position={[0, 1.32, frontZ + 0.06]}>
        <boxGeometry args={[1.12, 2.12, 0.04]} />
        <meshStandardMaterial
          color="#3b2f24"
          emissive="#ffd694"
          emissiveIntensity={doorOpen ? 0.75 : 0.06}
          roughness={0.8}
        />
      </mesh>
      <group ref={doorHingeRef} position={[-0.57, 1.32, frontZ + 0.12]}>
        <mesh position={[0.57, 0, 0]}>
          <boxGeometry args={[1.15, 2.15, 0.08]} />
          <meshStandardMaterial
            color="#8fb4c9"
            emissive={isNight ? '#ffcf86' : '#1b2b36'}
            emissiveIntensity={isNight ? 0.9 : 0.05}
            roughness={0.1}
          />
        </mesh>
      </group>

      {/* Awning / Storefront Canopy */}
      <mesh position={[0, 2.82, frontZ + 0.72]} rotation={[0.28, 0, 0]} castShadow>
        <boxGeometry args={[width - 0.8, 0.12, 1.55]} />
        <meshStandardMaterial color={accentColor} roughness={0.78} />
      </mesh>

      {/* Animated Illuminated Shop Sign */}
      <mesh position={[0, 3.45, frontZ + 0.14]} castShadow>
        <boxGeometry args={[Math.min(width - 0.8, 5.8), 1.05, 0.18]} />
        <meshStandardMaterial color="#22262c" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 3.45, frontZ + 0.25]}>
        <planeGeometry args={[Math.min(width - 1.1, 5.5), 0.92]} />
        <meshStandardMaterial
          ref={signRef}
          map={signTexture}
          emissive="#ffffff"
          emissiveMap={signTexture}
          emissiveIntensity={isNight ? 1.5 : 0.3}
          roughness={0.35}
        />
      </mesh>

      {/* Upper Floor Windows */}
      {[-width * 0.28, 0, width * 0.28].map((wx, i) => (
        <mesh key={i} position={[wx, height * 0.76, frontZ + 0.04]}>
          <boxGeometry args={[1.35, 1.45, 0.08]} />
          <meshStandardMaterial
            color="#6f8da1"
            emissive={isNight ? '#ffc470' : '#23313d'}
            emissiveIntensity={isNight ? 1.05 : 0.06}
            roughness={0.12}
            metalness={0.25}
          />
        </mesh>
      ))}

      {/* Dealership Indoor Display Car Showcase */}
      {category === 'dealership' && (
        <group position={[0, 0.25, frontZ + 1.8]} rotation={[0, Math.PI / 5, 0]} scale={0.72}>
          <CarMesh color="#d44035" style="sedan" timeOfDay={timeOfDay} />
        </group>
      )}

      {/* Outdoor Bistro / Café Terrace Tables & Parasols */}
      {hasOutdoorSeating && (
        <group position={[0, 0, frontZ + 1.85]}>
          {[-2.2, 2.2].map((tx, idx) => (
            <group key={idx} position={[tx, 0, 0]}>
              {/* Table */}
              <mesh position={[0, 0.72, 0]} castShadow>
                <cylinderGeometry args={[0.52, 0.52, 0.06, 14]} />
                <meshStandardMaterial color="#f0ece3" roughness={0.45} />
              </mesh>
              <mesh position={[0, 0.36, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.18, 0.72, 8]} />
                <meshStandardMaterial color="#272b30" roughness={0.4} metalness={0.6} />
              </mesh>
              {/* Chairs */}
              {[-0.7, 0.7].map((cx, ci) => (
                <mesh key={ci} position={[cx, 0.38, 0]} castShadow>
                  <boxGeometry args={[0.38, 0.44, 0.38]} />
                  <meshStandardMaterial color="#7d5336" roughness={0.75} />
                </mesh>
              ))}
              {/* Café Umbrella */}
              <mesh position={[0, 1.35, 0]} castShadow>
                <cylinderGeometry args={[0.03, 0.03, 1.3, 8]} />
                <meshStandardMaterial color="#59402e" roughness={0.8} />
              </mesh>
              <mesh position={[0, 2.02, 0]} castShadow>
                <coneGeometry args={[1.05, 0.42, 8]} />
                <meshStandardMaterial color={idx === 0 ? accentColor : '#d9cfc0'} roughness={0.82} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
};
