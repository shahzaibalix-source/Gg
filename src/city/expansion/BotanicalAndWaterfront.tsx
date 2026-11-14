import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeOfDay } from '../types';
import { SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';
import { ParkBench, ParkFountain, StylizedTree } from '../assets/FoliageAndProps';
import {
  GrandCommunityFountain,
  ParkFlowerbed,
  ParkInfoBoard,
  ParkLampPost,
  ParkLitterBin,
  ParkPicnicSet,
  ParkPlanterPot,
  ParkStoneBollard,
  PlaygroundAlpha,
  PlaygroundBeta,
  WindingStonePathway,
} from '../assets/CommunityParkProps';
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

  const westLoopPath: Array<[number, number]> = useMemo(
    () => [
      [-64, -3.5],
      [-56, -15],
      [-44, -18],
      [-26, -24],
      [-12, -32],
      [-3.5, -34],
    ],
    [],
  );

  const westSouthPath: Array<[number, number]> = useMemo(
    () => [
      [-64, 3.5],
      [-58, 14],
      [-44, 17],
      [-25, 28],
      [-10, 34],
      [-3.5, 34],
    ],
    [],
  );

  const eastLoopPath: Array<[number, number]> = useMemo(
    () => [
      [64, -3.5],
      [56, -15],
      [44, -18],
      [26, -24],
      [12, -32],
      [3.5, -34],
    ],
    [],
  );

  const eastSouthPath: Array<[number, number]> = useMemo(
    () => [
      [64, 3.5],
      [58, 14],
      [44, 17],
      [25, 28],
      [10, 34],
      [3.5, 34],
    ],
    [],
  );

  const botanicalGrass = useMemo(
    () =>
      generateParkGrassTufts({
        cx: 0,
        cz: 0,
        y: SIDEWALK_HEIGHT + 0.02,
        width: 156,
        depth: 230,
        count: 680,
        seed: 2360,
        excludeFn: (lx, lz) => {
          // Exclude main cross paths, fountain plaza, and conservatory footprint
          if (Math.abs(lx) < 5.2 || Math.abs(lz) < 5.2) return true;
          if (Math.hypot(lx, lz) < 22) return true;
          if (Math.hypot(lx, lz - 34) < 7.8) return true;
          if (Math.abs(lz) < 8 && Math.abs(lx) < 33) return true;
          // Exclude Playground A (-44, 24) & Playground B (44, 24)
          if (Math.abs(Math.abs(lx) - 44) < 7.8 && Math.abs(lz - 24) < 6.8) return true;
          // Exclude Picnic Groves (-44, -24) & (44, -24)
          if (Math.abs(Math.abs(lx) - 44) < 7.2 && Math.abs(lz + 24) < 5.5) return true;
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

        {/* Winding Curved Stone Pedestrian Trails Linking Lawns, Fountain & Playgrounds */}
        <WindingStonePathway points={westLoopPath} width={2.4} y={SIDEWALK_HEIGHT + 0.03} />
        <WindingStonePathway points={westSouthPath} width={2.4} y={SIDEWALK_HEIGHT + 0.03} />
        <WindingStonePathway points={eastLoopPath} width={2.4} y={SIDEWALK_HEIGHT + 0.03} />
        <WindingStonePathway points={eastSouthPath} width={2.4} y={SIDEWALK_HEIGHT + 0.03} />

        {/* Grand Circular Fountain Plaza on South Promenade (local 0, 34) */}
        <mesh position={[0, SIDEWALK_HEIGHT + 0.032, 34]} receiveShadow>
          <cylinderGeometry args={[7.4, 7.5, 0.035, 32]} />
          <meshStandardMaterial color="#dcd4c3" roughness={0.85} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
        <GrandCommunityFountain
          position={[0, SIDEWALK_HEIGHT + 0.04, 34]}
          scale={1.06}
          timeOfDay={timeOfDay}
        />

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

        {/* PLAYGROUND ALPHA — South-West Open Lawn (-44, 24) */}
        <PlaygroundAlpha position={[-44, SIDEWALK_HEIGHT + 0.02, 24]} scale={1.32} />

        {/* PLAYGROUND BETA — South-East Open Lawn (+44, 24) */}
        <PlaygroundBeta position={[44, SIDEWALK_HEIGHT + 0.02, 24]} scale={1.32} />

        {/* TWO SHADED PICNIC & FAMILY SOCIAL GROVES — North Lawns (-44, -24 & +44, -24) */}
        {[-44, 44].map((gx) => (
          <group key={`picnic-grove-${gx}`} position={[gx, SIDEWALK_HEIGHT + 0.02, -24]}>
            <mesh position={[0, 0.014, 0]} receiveShadow>
              <boxGeometry args={[12.8, 0.028, 9.2]} />
              <meshStandardMaterial color="#ddd4c2" roughness={0.86} />
            </mesh>
            <ParkPicnicSet position={[-3.0, 0.02, 0]} umbrellaColor={gx < 0 ? '#b91c1c' : '#0f766e'} />
            <ParkPicnicSet
              position={[3.0, 0.02, 0]}
              rotationY={Math.PI / 8}
              umbrellaColor={gx < 0 ? '#1d4ed8' : '#d97706'}
            />
            <ParkLitterBin position={[5.6, 0.02, 3.6]} />
            <ParkFlowerbed position={[0, 0.02, -3.6]} width={4.2} depth={1.4} />
          </group>
        ))}

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

        {/* Decorative Park Flowerbeds, Planter Pots & Map Information Boards */}
        <ParkFlowerbed position={[-9.5, SIDEWALK_HEIGHT, 34]} circular width={2.8} depth={2.8} />
        <ParkFlowerbed position={[9.5, SIDEWALK_HEIGHT, 34]} circular width={2.8} depth={2.8} />
        <ParkFlowerbed position={[-14, SIDEWALK_HEIGHT, 24]} width={3.6} depth={1.5} />
        <ParkFlowerbed position={[14, SIDEWALK_HEIGHT, 24]} width={3.6} depth={1.5} />
        <ParkFlowerbed position={[-14, SIDEWALK_HEIGHT, -24]} width={3.6} depth={1.5} />
        <ParkFlowerbed position={[14, SIDEWALK_HEIGHT, -24]} width={3.6} depth={1.5} />

        <ParkInfoBoard position={[-6.4, SIDEWALK_HEIGHT + 0.02, -26]} rotationY={Math.PI / 4} title="BOTANICAL PARK MAP" />
        <ParkInfoBoard position={[6.4, SIDEWALK_HEIGHT + 0.02, 26]} rotationY={-Math.PI * 0.75} title="GRAND CENTRAL PARK" />

        <ParkPlanterPot position={[-4.8, SIDEWALK_HEIGHT + 0.02, 28.5]} flowerVariant="pink" />
        <ParkPlanterPot position={[4.8, SIDEWALK_HEIGHT + 0.02, 28.5]} flowerVariant="gold" />
        <ParkPlanterPot position={[-4.8, SIDEWALK_HEIGHT + 0.02, 39.5]} flowerVariant="violet" />
        <ParkPlanterPot position={[4.8, SIDEWALK_HEIGHT + 0.02, 39.5]} flowerVariant="coral" />

        {/* Classic Park Globe Lamp Posts Illuminating at Sunset & Night */}
        {[
          [-5.0, -46],
          [5.0, -46],
          [-5.0, -76],
          [5.0, -76],
          [-5.0, 46],
          [5.0, 46],
          [-5.0, 76],
          [5.0, 76],
          [-58, -5.0],
          [58, -5.0],
          [-34, 16],
          [34, 16],
        ].map(([lx, lz], li) => (
          <ParkLampPost key={`bot-lamp-${li}`} position={[lx, SIDEWALK_HEIGHT, lz]} timeOfDay={timeOfDay} />
        ))}

        {/* Litter Bins & Entrance Bollards */}
        {[
          [-36.5, 24],
          [36.5, 24],
          [-6.6, 30.5],
          [6.6, 37.5],
        ].map(([bx, bz], bi) => (
          <ParkLitterBin key={`bot-bin-${bi}`} position={[bx, SIDEWALK_HEIGHT + 0.02, bz]} />
        ))}
        {[
          [-78, -4.4],
          [-78, 4.4],
          [78, -4.4],
          [78, 4.4],
          [-4.4, -114],
          [4.4, -114],
          [-4.4, 114],
          [4.4, 114],
        ].map(([bx, bz], bi) => (
          <ParkStoneBollard key={`bot-bol-${bi}`} position={[bx, SIDEWALK_HEIGHT, bz]} timeOfDay={timeOfDay} />
        ))}

        {/* Wind-Swaying 3D Grass Tufts Across Botanical Lawns */}
        <InstancedGrassField tufts={botanicalGrass} />

        {/* Scenic Park Benches & Shade Trees */}
        {[
          [-6.2, -36, Math.PI / 2],
          [6.2, -36, -Math.PI / 2],
          [-6.2, 34, Math.PI / 2],
          [6.2, 34, -Math.PI / 2],
          [-56, -6.2, 0],
          [56, -6.2, 0],
          [-36.2, 24, -Math.PI / 2],
          [36.2, 24, Math.PI / 2],
        ].map(([bx, bz, rot], bi) => (
          <ParkBench key={bi} position={[bx, SIDEWALK_HEIGHT + 0.03, bz]} rotationY={rot} />
        ))}
        {[
          [-68, -108, 'broadleaf', 1.25],
          [68, -108, 'broadleaf', 1.2],
          [-68, 108, 'broadleaf', 1.22],
          [68, 108, 'broadleaf', 1.25],
          [-68, -22, 'cypress', 1.15],
          [68, -22, 'cypress', 1.15],
          [-68, 22, 'ornamental', 1.12],
          [68, 22, 'ornamental', 1.12],
          [-22, -74, 'broadleaf', 1.18],
          [22, -74, 'broadleaf', 1.18],
          [-22, 74, 'ornamental', 1.14],
          [22, 74, 'ornamental', 1.14],
        ].map(([tx, tz, variant, sc], ti) => (
          <StylizedTree
            key={ti}
            position={[tx as number, SIDEWALK_HEIGHT + 0.02, tz as number]}
            variant={variant as 'broadleaf' | 'cypress' | 'ornamental'}
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

        {/* Twin Grand Red Steel Arch/Truss Bridges Linking Boardwalk -> Central Island -> East Quay */}
        {[
          { cx: -39.5, len: 80 },
          { cx: 69.5, len: 52 },
        ].map((span, sIdx) => {
          const halfSpan = span.len / 2;
          const archR = halfSpan - 2.0;
          const archScaleY = sIdx === 0 ? 0.24 : 0.32;
          const postCount = sIdx === 0 ? 9 : 7;
          const postOffsets: number[] = [];
          for (let i = 1; i < postCount; i++) {
            postOffsets.push(-archR + (i / postCount) * (archR * 2));
          }
          const isNight = timeOfDay === 'night' || timeOfDay === 'sunset';
          return (
            <group key={`red-lake-bridge-${sIdx}`} position={[span.cx, SIDEWALK_HEIGHT + 0.34, 0]}>
              {/* Heavy Timber & Steel Deck */}
              <mesh receiveShadow castShadow>
                <boxGeometry args={[span.len, 0.28, 5.4]} />
                <meshStandardMaterial color="#8f6845" roughness={0.82} />
              </mesh>
              {/* Twin Red Steel Arch Truss Sides */}
              {[-2.55, 2.55].map((rz, ri) => (
                <group key={`rb-side-${ri}`} position={[0, 0.14, rz]}>
                  {/* Red Steel Lower & Handrail Chords */}
                  <mesh position={[0, 0.22, 0]} castShadow>
                    <boxGeometry args={[span.len - 0.6, 0.22, 0.22]} />
                    <meshStandardMaterial color="#b91c1c" roughness={0.36} metalness={0.62} />
                  </mesh>
                  <mesh position={[0, 0.88, 0]} castShadow>
                    <boxGeometry args={[span.len - 0.6, 0.12, 0.18]} />
                    <meshStandardMaterial color="#dc2626" roughness={0.34} metalness={0.64} />
                  </mesh>
                  {/* Sweeping Red Parabolic Arch Rib */}
                  <mesh position={[0, 0, 0]} scale={[1, archScaleY, 1]} castShadow>
                    <torusGeometry args={[archR, 0.22, 8, 28, Math.PI]} />
                    <meshStandardMaterial color="#b91c1c" roughness={0.32} metalness={0.66} />
                  </mesh>
                  {/* Vertical Red Steel Suspender Struts */}
                  {postOffsets.map((px, pi) => {
                    const h = Math.sqrt(Math.max(0, archR * archR - px * px)) * archScaleY;
                    return (
                      <mesh key={`rs-${pi}`} position={[px, h / 2 + 0.1, 0]} castShadow>
                        <boxGeometry args={[0.14, Math.max(0.8, h), 0.14]} />
                        <meshStandardMaterial color="#991b1b" roughness={0.38} metalness={0.62} />
                      </mesh>
                    );
                  })}
                  {/* Corner Steel Pylons with Warm Lantern Globes */}
                  {[-halfSpan + 1.4, halfSpan - 1.4].map((lx, li) => (
                    <group key={`bl-${li}`} position={[lx, 1.35, 0]}>
                      <mesh castShadow>
                        <boxGeometry args={[0.32, 1.35, 0.32]} />
                        <meshStandardMaterial color="#7f1d1d" roughness={0.42} metalness={0.65} />
                      </mesh>
                      <mesh position={[0, 0.82, 0]}>
                        <sphereGeometry args={[0.24, 10, 10]} />
                        <meshStandardMaterial
                          color="#fff3d1"
                          emissive="#ffae34"
                          emissiveIntensity={isNight ? 2.4 : 0.25}
                          roughness={0.2}
                        />
                      </mesh>
                    </group>
                  ))}
                </group>
              ))}

              {/* Overhead Cross-Portal Portal Bracing between Twin Arches */}
              {[-archR * 0.48, -archR * 0.24, 0, archR * 0.24, archR * 0.48].map((bx, bi) => {
                const bh = 0.14 + Math.sqrt(Math.max(0, archR * archR - bx * bx)) * archScaleY;
                return (
                  <mesh key={`xtie-${bi}`} position={[bx, bh, 0]} castShadow>
                    <boxGeometry args={[0.22, 0.22, 5.3]} />
                    <meshStandardMaterial color="#b91c1c" roughness={0.35} metalness={0.64} />
                  </mesh>
                );
              })}
            </group>
          );
        })}

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
