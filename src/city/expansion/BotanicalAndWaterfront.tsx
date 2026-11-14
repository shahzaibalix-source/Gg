import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeOfDay } from '../types';
import { SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';
import { ParkBench, ParkFountain, StylizedTree } from '../assets/FoliageAndProps';
import {
  AnimatedWaterPlane,
  InstancedGrassField,
  VenetianGondola,
  generateParkGrassTufts,
} from '../assets/NaturePropsAndWater';

interface BotanicalAndWaterfrontProps {
  timeOfDay: TimeOfDay;
}

/**
 * Renders Grand Central Park & Botanical Conservatory (X in [148..326], Z in [-132..132])
 * and Grand Lindenhof Lake & Venetian Waterfront Island (X in [326..568], Z in [-136..136]).
 */
export const BotanicalAndWaterfront: React.FC<BotanicalAndWaterfrontProps> = ({ timeOfDay }) => {
  const boatARef = useRef<THREE.Group>(null);
  const boatBRef = useRef<THREE.Group>(null);
  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';

  const botanicalGrass = useMemo(
    () =>
      generateParkGrassTufts({
        cx: 0,
        cz: 0,
        y: SIDEWALK_HEIGHT + 0.02,
        width: 156,
        depth: 230,
        count: 640,
        seed: 2360,
        excludeFn: (lx, lz) => {
          // Exclude main cross paths and conservatory footprint
          if (Math.abs(lx) < 5.2 || Math.abs(lz) < 5.2) return true;
          if (Math.hypot(lx, lz) < 22) return true;
          if (Math.abs(lz) < 8 && Math.abs(lx) < 33) return true;
          // Exclude floral parterres
          if (
            Math.abs(Math.abs(lx) - 38) < 16 &&
            (Math.abs(Math.abs(lz) - 56) < 13 || Math.abs(Math.abs(lz) - 94) < 13)
          ) {
            return true;
          }
          return false;
        },
      }),
    [],
  );

  const islandGrass = useMemo(
    () =>
      generateParkGrassTufts({
        cx: 22,
        cz: 0,
        y: SIDEWALK_HEIGHT + 0.42,
        width: 38,
        depth: 52,
        count: 130,
        seed: 4680,
        excludeFn: (lx, lz) => {
          if (Math.hypot(lx - 22, lz) < 8.5) return true;
          if (Math.abs(lz) < 3.6) return true;
          return false;
        },
      }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (boatARef.current) {
      boatARef.current.position.y = 0.08 + Math.sin(t * 1.4) * 0.06;
      boatARef.current.rotation.z = Math.sin(t * 1.1) * 0.03;
    }
    if (boatBRef.current) {
      boatBRef.current.position.y = 0.08 + Math.cos(t * 1.3 + 1.2) * 0.06;
      boatBRef.current.rotation.z = Math.cos(t * 1.0 + 0.8) * 0.03;
    }
  });

  return (
    <group>
      {/* ===================================================================== */}
      {/* GRAND CENTRAL PARK & BOTANICAL GARDENS (Center: x = 236, z = 0)       */}
      {/* ===================================================================== */}
      <group position={[236, 0, 0]}>
        {/* Sculpted Botanical Park Lawn */}
        <mesh position={[0, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
          <boxGeometry args={[168, SIDEWALK_HEIGHT, 244]} />
          <meshStandardMaterial color="#679b52" roughness={0.93} polygonOffset polygonOffsetFactor={1} />
        </mesh>

        {/* Cross Axial Decomposed-Granite Garden Paths */}
        <mesh position={[0, SIDEWALK_HEIGHT + 0.018, 0]} receiveShadow>
          <boxGeometry args={[160, 0.03, 7.2]} />
          <meshStandardMaterial color="#d8cfb8" roughness={0.9} />
        </mesh>
        <mesh position={[0, SIDEWALK_HEIGHT + 0.026, 0]} receiveShadow>
          <boxGeometry args={[7.2, 0.03, 236]} />
          <meshStandardMaterial color="#d8cfb8" roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
        </mesh>

        {/* Grand Victorian Botanical Conservatory Dome (Center) */}
        <group position={[0, SIDEWALK_HEIGHT + 0.03, 0]}>
          <mesh position={[0, 0.4, 0]} receiveShadow>
            <cylinderGeometry args={[20, 21, 0.8, 24]} />
            <meshStandardMaterial color="#ddd6c7" roughness={0.8} />
          </mesh>
          <mesh position={[0, 4.2, 0]}>
            <cylinderGeometry args={[15.5, 16.5, 7.0, 20]} />
            <meshStandardMaterial
              color="#b9e2f5"
              transparent
              opacity={0.56}
              roughness={0.12}
              metalness={0.18}
              depthWrite={false}
              emissive={isEvening ? '#ffd88a' : '#000000'}
              emissiveIntensity={isEvening ? 0.35 : 0}
            />
          </mesh>
          <mesh position={[0, 8.2, 0]}>
            <sphereGeometry args={[15.5, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color="#cdecfb"
              transparent
              opacity={0.6}
              roughness={0.12}
              metalness={0.2}
              depthWrite={false}
            />
          </mesh>
          {/* Side Conservatory Glass Wings */}
          {[-23, 23].map((wx) => (
            <group key={wx} position={[wx, 0, 0]}>
              <mesh position={[0, 2.8, 0]}>
                <boxGeometry args={[14, 5.2, 10]} />
                <meshStandardMaterial
                  color="#b9e2f5"
                  transparent
                  opacity={0.56}
                  roughness={0.12}
                  metalness={0.15}
                  depthWrite={false}
                  emissive={isEvening ? '#ffd88a' : '#000000'}
                  emissiveIntensity={isEvening ? 0.25 : 0}
                />
              </mesh>
              <mesh position={[0, 5.5, 0]}>
                <boxGeometry args={[14.4, 0.35, 10.4]} />
                <meshStandardMaterial color="#3c5449" roughness={0.5} metalness={0.3} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Eight Symmetrical Floral Parterres */}
        {[
          [-38, -56, '#f472b6'],
          [38, -56, '#facc15'],
          [-38, 56, '#fb7185'],
          [38, 56, '#a78bfa'],
          [-38, -94, '#fb923c'],
          [38, -94, '#f472b6'],
          [-38, 94, '#60a5fa'],
          [38, 94, '#facc15'],
        ].map(([px, pz, flowerCol], i) => (
          <group key={i} position={[px as number, SIDEWALK_HEIGHT, pz as number]}>
            <mesh position={[0, 0.22, 0]} receiveShadow>
              <boxGeometry args={[28, 0.44, 22]} />
              <meshStandardMaterial color="#3b6b38" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[6.5, 7.2, 0.35, 16]} />
              <meshStandardMaterial color={flowerCol as string} roughness={0.78} />
            </mesh>
            <mesh position={[0, 2.2, 0]} castShadow>
              <coneGeometry args={[1.6, 3.8, 8]} />
              <meshStandardMaterial color="#2f5e36" roughness={0.86} />
            </mesh>
          </group>
        ))}

        {/* Wind-Swaying 3D Grass Tufts Across Botanical Lawns */}
        <InstancedGrassField tufts={botanicalGrass} />

        {/* Scenic Park Benches & Shade Trees */}
        {[
          [-6.2, -36, Math.PI / 2],
          [6.2, -36, -Math.PI / 2],
          [-6.2, 36, Math.PI / 2],
          [6.2, 36, -Math.PI / 2],
          [-56, -6.2, 0],
          [56, -6.2, 0],
        ].map(([bx, bz, rot], bi) => (
          <ParkBench key={bi} position={[bx, SIDEWALK_HEIGHT + 0.03, bz]} rotationY={rot} />
        ))}
        {[
          [-68, -108, 'broadleaf', 1.25],
          [68, -108, 'broadleaf', 1.2],
          [-68, 108, 'broadleaf', 1.22],
          [68, 108, 'broadleaf', 1.25],
          [-68, -22, 'cypress', 1.15],
          [68, 22, 'cypress', 1.15],
        ].map(([tx, tz, variant, sc], ti) => (
          <StylizedTree
            key={ti}
            position={[tx as number, SIDEWALK_HEIGHT + 0.02, tz as number]}
            variant={variant as 'broadleaf' | 'cypress'}
            scale={sc as number}
          />
        ))}
      </group>

      {/* ===================================================================== */}
      {/* GRAND LAKE, GARDEN ISLAND & VENETIAN LAGOON (Center: x = 446, z = 0)  */}
      {/* ===================================================================== */}
      <group position={[446, 0, 0]}>
        {/* Waterfront Stone Quay Frame */}
        <mesh position={[0, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
          <boxGeometry args={[224, SIDEWALK_HEIGHT, 286]} />
          <meshStandardMaterial color="#cbc3b2" roughness={0.84} polygonOffset polygonOffsetFactor={1} />
        </mesh>

        {/* Deep Teal Stone Lakebed Below 3D Waves */}
        <mesh position={[8, SIDEWALK_HEIGHT + 0.01, 0]} receiveShadow>
          <boxGeometry args={[174, 0.04, 240]} />
          <meshStandardMaterial color="#0f3444" roughness={0.92} />
        </mesh>

        {/* Grand Crystal Blue Lindenhof Lake — Animated 3D GLSL Water */}
        <AnimatedWaterPlane
          position={[8, SIDEWALK_HEIGHT + 0.11, 0]}
          width={174}
          depth={240}
          segmentsX={28}
          segmentsZ={36}
          baseColor="#1c7397"
          crestColor="#9ae2f5"
          waveAmp={0.04}
          rippleScale={0.95}
          tag="grand-waterfront-lake"
        />

        {/* Western Timber Harbor Boardwalk */}
        <mesh position={[-86, SIDEWALK_HEIGHT + 0.24, 0]} receiveShadow>
          <boxGeometry args={[14, 0.32, 248]} />
          <meshStandardMaterial color="#8f6845" roughness={0.84} />
        </mesh>

        {/* Lakeside Timber Benches Along Boardwalk */}
        {[-82, -24, 24, 82].map((bz, bi) => (
          <ParkBench
            key={bi}
            position={[-84, SIDEWALK_HEIGHT + 0.4, bz]}
            rotationY={Math.PI / 2}
          />
        ))}

        {/* Two Scenic Wooden Harbor Piers Extending Into the Lake */}
        {[-44, 44].map((pz) => (
          <group key={pz} position={[-66, SIDEWALK_HEIGHT + 0.28, pz]}>
            <mesh receiveShadow>
              <boxGeometry args={[28, 0.28, 5.4]} />
              <meshStandardMaterial color="#8f6845" roughness={0.82} />
            </mesh>
            {[-12, 0, 12].map((px) => (
              <mesh key={px} position={[px, 0.45, -2.5]}>
                <cylinderGeometry args={[0.16, 0.18, 1.1, 8]} />
                <meshStandardMaterial color="#593f2b" roughness={0.88} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Arched Footbridges Linking Boardwalk -> Central Garden Island -> East Quay (Z = 0) */}
        <group position={[-39.5, SIDEWALK_HEIGHT + 0.34, 0]}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[80, 0.28, 5.4]} />
            <meshStandardMaterial color="#8f6845" roughness={0.82} />
          </mesh>
          <mesh position={[0, 0.56, -2.5]}>
            <boxGeometry args={[79, 0.72, 0.18]} />
            <meshStandardMaterial color="#5b412c" roughness={0.84} />
          </mesh>
          <mesh position={[0, 0.56, 2.5]}>
            <boxGeometry args={[79, 0.72, 0.18]} />
            <meshStandardMaterial color="#5b412c" roughness={0.84} />
          </mesh>
        </group>

        <group position={[69.5, SIDEWALK_HEIGHT + 0.34, 0]}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[52, 0.28, 5.4]} />
            <meshStandardMaterial color="#8f6845" roughness={0.82} />
          </mesh>
          <mesh position={[0, 0.56, -2.5]}>
            <boxGeometry args={[51, 0.72, 0.18]} />
            <meshStandardMaterial color="#5b412c" roughness={0.84} />
          </mesh>
          <mesh position={[0, 0.56, 2.5]}>
            <boxGeometry args={[51, 0.72, 0.18]} />
            <meshStandardMaterial color="#5b412c" roughness={0.84} />
          </mesh>
        </group>

        {/* Central Scenic Garden Island Inside Grand Lake (local X = 22, world X = 468) */}
        <group position={[22, 0, 0]}>
          <mesh position={[0, SIDEWALK_HEIGHT + 0.18, 0]} receiveShadow>
            <boxGeometry args={[44, 0.44, 58]} />
            <meshStandardMaterial color="#d2cab9" roughness={0.82} />
          </mesh>
          <mesh position={[0, SIDEWALK_HEIGHT + 0.4, 0]} receiveShadow>
            <boxGeometry args={[40, 0.06, 54]} />
            <meshStandardMaterial color="#679b4e" roughness={0.93} />
          </mesh>
          <mesh position={[0, SIDEWALK_HEIGHT + 0.43, 0]} receiveShadow>
            <boxGeometry args={[40, 0.04, 4.6]} />
            <meshStandardMaterial color="#dfd7c6" roughness={0.88} />
          </mesh>
          <ParkFountain position={[0, SIDEWALK_HEIGHT + 0.44, 0]} />
          {[
            [-14, -20],
            [14, -20],
            [-14, 20],
            [14, 20],
          ].map(([ix, iz], idx) => (
            <StylizedTree
              key={idx}
              position={[ix, SIDEWALK_HEIGHT + 0.43, iz]}
              variant={idx % 2 === 0 ? 'cypress' : 'ornamental'}
              scale={1.15}
            />
          ))}
          <ParkBench position={[-6.5, SIDEWALK_HEIGHT + 0.44, -9]} rotationY={0} />
          <ParkBench position={[6.5, SIDEWALK_HEIGHT + 0.44, 9]} rotationY={Math.PI} />
        </group>

        {/* 3D Grass Tufts on Scenic Island */}
        <InstancedGrassField tufts={islandGrass} />

        {/* Two Moored European Sailboats Gently Bobbing */}
        <group ref={boatARef} position={[-38, 0.1, -68]}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[6.4, 0.9, 2.4]} />
            <meshStandardMaterial color="#f5f1e8" roughness={0.5} />
          </mesh>
          <mesh position={[0, 3.8, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 6.2, 8]} />
            <meshStandardMaterial color="#8c6239" roughness={0.7} />
          </mesh>
          <mesh position={[0.9, 3.9, 0]}>
            <coneGeometry args={[1.6, 5.2, 3]} />
            <meshStandardMaterial color="#ffffff" roughness={0.65} />
          </mesh>
        </group>

        <group ref={boatBRef} position={[-34, 0.1, 70]} rotation={[0, 0.4, 0]}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[5.8, 0.85, 2.2]} />
            <meshStandardMaterial color="#1d3557" roughness={0.48} />
          </mesh>
          <mesh position={[0, 3.5, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 5.6, 8]} />
            <meshStandardMaterial color="#8c6239" roughness={0.7} />
          </mesh>
          <mesh position={[0.8, 3.6, 0]}>
            <coneGeometry args={[1.45, 4.8, 3]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.65} />
          </mesh>
        </group>

        {/* Moored Venetian Gondolas Beside Harbor Piers */}
        <VenetianGondola
          position={[-58, SIDEWALK_HEIGHT + 0.1, -35]}
          rotationY={Math.PI / 2 + 0.12}
          phase={0.5}
          accentColor="#9b1c1c"
        />
        <VenetianGondola
          position={[-56, SIDEWALK_HEIGHT + 0.1, 35]}
          rotationY={Math.PI / 2 - 0.1}
          phase={1.8}
          accentColor="#1e3a8a"
        />
      </group>
    </group>
  );
};
