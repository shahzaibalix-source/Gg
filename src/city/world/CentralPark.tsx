import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CityTextureSet } from '../materials/proceduralTextures';
import { ParkBench, ParkFountain, StylizedTree } from '../assets/FoliageAndProps';
import { SIDEWALK_HEIGHT, TOWN_BENCHES } from './MasterTownBlueprint';

interface CentralParkProps {
  textures: CityTextureSet;
  activeBenchId?: string | null;
  onSelectBench?: (benchId: string) => void;
}

/**
 * Renders the Central Town Square plaza & grand fountain, District 3 Central Park
 * (lake with arched footbridge, tennis court, fountain plaza, children's playground,
 * walking paths, benches, flowerbeds & trees), and District 2 Commercial Promenade.
 */
export const CentralPark: React.FC<CentralParkProps> = ({
  textures,
  activeBenchId,
  onSelectBench,
}) => {
  const lakeWaterRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (lakeWaterRef.current) {
      lakeWaterRef.current.roughness = 0.14 + Math.sin(state.clock.elapsedTime * 1.4) * 0.04;
    }
  });

  const parkTrees: Array<{
    x: number;
    z: number;
    scale: number;
    variant: 'broadleaf' | 'cypress' | 'ornamental';
  }> = [
    { x: 36.2, z: -15.8, scale: 1.12, variant: 'broadleaf' },
    { x: 48.2, z: -15.6, scale: 1.05, variant: 'ornamental' },
    { x: 67.8, z: -15.5, scale: 1.15, variant: 'broadleaf' },
    { x: 68.0, z: -1.5, scale: 1.0, variant: 'cypress' },
    { x: 36.2, z: 4.5, scale: 1.05, variant: 'broadleaf' },
    { x: 49.0, z: 15.6, scale: 0.95, variant: 'ornamental' },
    { x: 36.2, z: 15.6, scale: 1.1, variant: 'broadleaf' },
  ];

  const squareTrees: Array<{ x: number; z: number; variant: 'broadleaf' | 'cypress' | 'ornamental' }> = [
    { x: -14.8, z: -14.8, variant: 'ornamental' },
    { x: 14.8, z: -14.8, variant: 'ornamental' },
    { x: -14.8, z: 14.8, variant: 'broadleaf' },
    { x: 14.8, z: 14.8, variant: 'broadleaf' },
    { x: -14.8, z: 3.5, variant: 'cypress' },
    { x: 14.8, z: 3.5, variant: 'cypress' },
  ];

  return (
    <group>
      {/* ===================================================================== */}
      {/* CENTRAL TOWN SQUARE (X in [-17.95, 17.95], Z in [-17.95, 17.95])       */}
      {/* ===================================================================== */}
      <group>
        <mesh position={[0, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
          <boxGeometry args={[35.9, SIDEWALK_HEIGHT, 35.9]} />
          <meshStandardMaterial map={textures.cobblestone} color="#d4cbbd" roughness={0.84} />
        </mesh>

        {/* Decorative Stone Plaza Border around Fountain */}
        <mesh position={[0, SIDEWALK_HEIGHT + 0.014, 8.8]} receiveShadow>
          <cylinderGeometry args={[6.4, 6.4, 0.025, 32]} />
          <meshStandardMaterial map={textures.sidewalkStone} color="#e2dacb" roughness={0.8} />
        </mesh>

        {/* Grand Civic Fountain */}
        <ParkFountain position={[0, SIDEWALK_HEIGHT, 8.8]} />

        {squareTrees.map((t, i) => (
          <StylizedTree
            key={`sq-tree-${i}`}
            position={[t.x, SIDEWALK_HEIGHT, t.z]}
            scale={0.95}
            variant={t.variant}
            rotationY={i * 1.1}
          />
        ))}
      </group>

      {/* ===================================================================== */}
      {/* DISTRICT 3 — CENTRAL PARK, LAKE, TENNIS & PLAYGROUND                  */}
      {/* ===================================================================== */}
      <group>
        {/* Park Lawn Base Pad */}
        <mesh position={[52.375, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
          <boxGeometry args={[36.65, SIDEWALK_HEIGHT, 35.9]} />
          <meshStandardMaterial map={textures.grass} color="#76a35e" roughness={0.92} />
        </mesh>

        {/* Decomposed Granite Walking Paths */}
        <group position={[0, SIDEWALK_HEIGHT + 0.012, 0]}>
          <mesh position={[48.6, 0, 0]} receiveShadow>
            <boxGeometry args={[2.3, 0.024, 35.5]} />
            <meshStandardMaterial map={textures.parkGravel} color="#ddd2bc" roughness={0.9} />
          </mesh>
          <mesh position={[52.3, 0, -1.0]} receiveShadow>
            <boxGeometry args={[36.2, 0.024, 2.3]} />
            <meshStandardMaterial map={textures.parkGravel} color="#ddd2bc" roughness={0.9} />
          </mesh>
          {/* Fountain Circular Stone Plaza */}
          <mesh position={[42.2, 0.005, -1.0]} receiveShadow>
            <cylinderGeometry args={[4.6, 4.6, 0.028, 28]} />
            <meshStandardMaterial map={textures.cobblestone} color="#cec5b5" roughness={0.85} />
          </mesh>
        </group>

        {/* Park Tiered Fountain */}
        <group position={[42.2, SIDEWALK_HEIGHT, -1.0]} scale={0.78}>
          <ParkFountain position={[0, 0, 0]} />
        </group>

        {/* Scenic Park Lake + Stone Shore + Arched Timber Footbridge */}
        <group position={[58.0, SIDEWALK_HEIGHT, -8.5]}>
          {/* Natural Stone Coping Rim */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <boxGeometry args={[15.8, 0.08, 10.6]} />
            <meshStandardMaterial map={textures.cobblestone} color="#b9b2a4" roughness={0.88} />
          </mesh>
          {/* Water Surface */}
          <mesh position={[0, 0.09, 0]}>
            <boxGeometry args={[14.6, 0.04, 9.4]} />
            <meshPhysicalMaterial
              ref={lakeWaterRef}
              color="#327b94"
              roughness={0.1}
              metalness={0.18}
              clearcoat={0.92}
              envMapIntensity={1.4}
            />
          </mesh>
          {/* Wooden Pier & Arched Footbridge */}
          <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.1, 0.16, 10.2]} />
            <meshStandardMaterial map={textures.timber} color="#8c613e" roughness={0.82} />
          </mesh>
          {[-0.95, 0.95].map((rx, ri) => (
            <mesh key={ri} position={[rx, 0.85, 0]} castShadow>
              <boxGeometry args={[0.1, 0.72, 10.0]} />
              <meshStandardMaterial color="#6e4b2f" roughness={0.85} />
            </mesh>
          ))}
        </group>

        {/* Community Tennis Court (North-West Park Quadrant) */}
        <group position={[41.2, SIDEWALK_HEIGHT + 0.02, -11.5]}>
          <mesh receiveShadow>
            <boxGeometry args={[9.6, 0.04, 6.2]} />
            <meshStandardMaterial color="#3c6e57" roughness={0.85} />
          </mesh>
          {/* Court Lines */}
          <mesh position={[0, 0.025, 0]}>
            <boxGeometry args={[8.8, 0.01, 0.08]} />
            <meshStandardMaterial color="#f3f2ed" polygonOffset polygonOffsetFactor={-1} />
          </mesh>
          <mesh position={[0, 0.025, -2.7]}>
            <boxGeometry args={[8.8, 0.01, 0.08]} />
            <meshStandardMaterial color="#f3f2ed" polygonOffset polygonOffsetFactor={-1} />
          </mesh>
          <mesh position={[0, 0.025, 2.7]}>
            <boxGeometry args={[8.8, 0.01, 0.08]} />
            <meshStandardMaterial color="#f3f2ed" polygonOffset polygonOffsetFactor={-1} />
          </mesh>
          {/* Net Posts, Mesh & Headband */}
          <mesh position={[0, 0.38, -2.75]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.72, 8]} />
            <meshStandardMaterial color="#272c33" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.38, 2.75]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.72, 8]} />
            <meshStandardMaterial color="#272c33" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.34, 0]}>
            <boxGeometry args={[0.03, 0.62, 5.45]} />
            <meshStandardMaterial color="#e7e5e4" transparent opacity={0.42} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.66, 0]}>
            <boxGeometry args={[0.06, 0.06, 5.5]} />
            <meshStandardMaterial color="#f5f5f4" roughness={0.4} />
          </mesh>
        </group>

        {/* Children's Playground (South-West Park Quadrant) */}
        <group position={[42.2, SIDEWALK_HEIGHT, 10.5]}>
          {/* Cushioned Sand / Woodchip Pad */}
          <mesh position={[0, 0.02, 0]} receiveShadow>
            <boxGeometry args={[10.2, 0.04, 9.0]} />
            <meshStandardMaterial color="#dfd1b2" roughness={0.95} />
          </mesh>
          {/* Timber Border */}
          <mesh position={[0, 0.12, -4.45]} castShadow>
            <boxGeometry args={[10.2, 0.2, 0.2]} />
            <meshStandardMaterial color="#7b583b" roughness={0.88} />
          </mesh>
          {/* Swing Frame */}
          <group position={[-2.6, 0, -1.2]}>
            <mesh position={[-1.1, 1.35, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.09, 2.7, 8]} />
              <meshStandardMaterial color="#8c6239" roughness={0.8} />
            </mesh>
            <mesh position={[1.1, 1.35, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.09, 2.7, 8]} />
              <meshStandardMaterial color="#8c6239" roughness={0.8} />
            </mesh>
            <mesh position={[0, 2.65, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.07, 0.07, 2.5, 8]} />
              <meshStandardMaterial color="#c94b3b" roughness={0.6} />
            </mesh>
            {[-0.45, 0.45].map((sx, si) => (
              <mesh key={si} position={[sx, 0.72, 0]} castShadow>
                <boxGeometry args={[0.45, 0.06, 0.25]} />
                <meshStandardMaterial color="#e5b84b" roughness={0.6} />
              </mesh>
            ))}
          </group>
          {/* Climbing Tower & Slide */}
          <group position={[2.2, 0, 0.8]}>
            <mesh position={[0, 1.1, 0]} castShadow>
              <boxGeometry args={[1.6, 2.2, 1.6]} />
              <meshStandardMaterial color="#9e5a3c" roughness={0.8} />
            </mesh>
            <mesh position={[0, 2.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
              <coneGeometry args={[1.35, 0.9, 4]} />
              <meshStandardMaterial color="#c94b3b" roughness={0.7} />
            </mesh>
            <mesh position={[1.45, 0.75, 0]} rotation={[0, 0, -0.58]} castShadow>
              <boxGeometry args={[2.1, 0.1, 0.7]} />
              <meshStandardMaterial color="#eab308" roughness={0.45} />
            </mesh>
          </group>
          {/* Seesaw */}
          <group position={[-1.4, 0.35, 2.3]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <cylinderGeometry args={[0.14, 0.22, 0.4, 8]} />
              <meshStandardMaterial color="#3b5e82" roughness={0.6} />
            </mesh>
            <mesh rotation={[0, 0, 0.14]} castShadow>
              <boxGeometry args={[2.8, 0.1, 0.34]} />
              <meshStandardMaterial color="#4b8352" roughness={0.65} />
            </mesh>
          </group>
        </group>

        {/* Park Trees */}
        {parkTrees.map((t, i) => (
          <StylizedTree
            key={`park-tree-${i}`}
            position={[t.x, SIDEWALK_HEIGHT, t.z]}
            scale={t.scale}
            variant={t.variant}
            rotationY={i * 0.9}
          />
        ))}
      </group>

      {/* ===================================================================== */}
      {/* DISTRICT 2 — COMMERCIAL SHOPPING PROMENADE (X in [-5.1, 5.1])         */}
      {/* ===================================================================== */}
      <group>
        <mesh position={[0, SIDEWALK_HEIGHT / 2, 52.375]} receiveShadow>
          <boxGeometry args={[35.9, SIDEWALK_HEIGHT, 36.65]} />
          <meshStandardMaterial map={textures.cobblestone} color="#cec6b8" roughness={0.84} />
        </mesh>
        {/* Promenade Ornamental Planter Strip */}
        {[40.5, 52.4, 64.2].map((pz, idx) => (
          <group key={idx} position={[0, SIDEWALK_HEIGHT, pz]}>
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.6, 0.4, 1.6]} />
              <meshStandardMaterial color="#a69e90" roughness={0.85} />
            </mesh>
            <StylizedTree position={[0, 0.4, 0]} scale={0.72} variant="ornamental" rotationY={idx} />
          </group>
        ))}
      </group>

      {/* ===================================================================== */}
      {/* ALL 15 INTERACTIVE TOWN BENCHES (Single Source: TOWN_BENCHES)          */}
      {/* ===================================================================== */}
      {TOWN_BENCHES.map((bench) => (
        <group
          key={bench.id}
          onClick={(e) => {
            if (!onSelectBench) return;
            e.stopPropagation();
            onSelectBench(bench.id);
          }}
        >
          <ParkBench position={[bench.x, bench.y, bench.z]} rotationY={bench.rotationY} />
          {activeBenchId === bench.id && (
            <mesh position={[bench.x, bench.y + 0.03, bench.z]} rotation={[0, bench.rotationY, 0]}>
              <boxGeometry args={[2.0, 0.03, 0.85]} />
              <meshBasicMaterial color="#e5b84b" transparent opacity={0.55} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
};
