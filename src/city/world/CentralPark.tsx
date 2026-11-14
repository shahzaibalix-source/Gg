import React, { useMemo } from 'react';
import { CityTextureSet } from '../materials/proceduralTextures';
import { TimeOfDay } from '../types';
import { ParkBench, StylizedTree } from '../assets/FoliageAndProps';
import {
  GrandCommunityFountain,
  LowParkBorderFence,
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
  generateParkGrassTufts,
} from '../assets/NaturePropsAndWater';
import { SIDEWALK_HEIGHT, TOWN_BENCHES } from './MasterTownBlueprint';

interface CentralParkProps {
  textures: CityTextureSet;
  timeOfDay: TimeOfDay;
  activeBenchId?: string | null;
  onSelectBench?: (benchId: string) => void;
}

/**
 * Renders Central Town Square, District 3 Community Central Park
 * (Grand Stone Fountain, winding stone walkways, TWO distinct playgrounds Playground A & B,
 * shaded picnic grove, lakeside arch bridge, tennis court, flowerbeds, benches, lamp posts,
 * litter bins, info board, bollards & varied trees), and District 2 Commercial Promenade.
 */
export const CentralPark: React.FC<CentralParkProps> = ({
  textures,
  timeOfDay,
  activeBenchId,
  onSelectBench,
}) => {
  // Varied tree clusters carefully spaced (>= 3.4m apart) and strictly clear of paths, playgrounds, lake, court & roads
  const parkTrees: Array<{
    x: number;
    z: number;
    scale: number;
    variant: 'broadleaf' | 'cypress' | 'ornamental';
  }> = [
    { x: 35.8, z: -16.0, scale: 1.08, variant: 'broadleaf' },
    { x: 46.6, z: -16.1, scale: 0.96, variant: 'ornamental' },
    { x: 68.4, z: -15.6, scale: 1.12, variant: 'broadleaf' },
    { x: 68.6, z: -3.8, scale: 1.0, variant: 'cypress' },
    { x: 35.8, z: 4.1, scale: 0.96, variant: 'ornamental' },
    { x: 54.0, z: 1.6, scale: 0.92, variant: 'cypress' },
    { x: 68.6, z: 4.8, scale: 1.05, variant: 'broadleaf' },
    { x: 35.8, z: 16.0, scale: 1.08, variant: 'broadleaf' },
    { x: 52.6, z: 9.2, scale: 0.94, variant: 'ornamental' },
    { x: 68.5, z: 16.0, scale: 1.1, variant: 'cypress' },
  ];

  const squareTrees: Array<{ x: number; z: number; variant: 'broadleaf' | 'cypress' | 'ornamental' }> = [
    { x: -14.8, z: -14.8, variant: 'ornamental' },
    { x: 14.8, z: -14.8, variant: 'ornamental' },
    { x: -14.8, z: 14.8, variant: 'broadleaf' },
    { x: 14.8, z: 14.8, variant: 'broadleaf' },
    { x: -14.8, z: 3.5, variant: 'cypress' },
    { x: 14.8, z: 3.5, variant: 'cypress' },
  ];

  const windingEastLoop: Array<[number, number]> = useMemo(
    () => [
      [48.6, -1.0],
      [51.2, 2.2],
      [54.4, 5.2],
      [61.2, 5.6],
      [66.6, 2.8],
      [68.0, -0.8],
      [70.3, -1.0],
    ],
    [],
  );

  const windingSouthLoop: Array<[number, number]> = useMemo(
    () => [
      [35.2, 1.5],
      [39.8, 4.4],
      [46.2, 4.8],
      [49.8, 8.8],
      [51.4, 14.8],
      [48.6, 17.5],
    ],
    [],
  );

  const coreParkGrass = useMemo(
    () =>
      generateParkGrassTufts({
        cx: 52.3,
        cz: 0,
        y: SIDEWALK_HEIGHT,
        width: 34.4,
        depth: 33.4,
        count: 540,
        seed: 4120,
        excludeFn: (x, z) => {
          // Keep axial walkways, fountain plaza, lake, tennis court, playgrounds A & B, and picnic deck clear
          if (Math.abs(x - 48.6) < 1.6) return true;
          if (Math.abs(z + 1.0) < 1.6) return true;
          if (Math.hypot(x - 42.2, z + 1.0) < 5.2) return true;
          if (x >= 49.4 && x <= 66.6 && z >= -14.4 && z <= -2.6) return true;
          if (x >= 35.8 && x <= 46.6 && z >= -15.2 && z <= -7.8) return true;
          // Playground A (SW quadrant)
          if (x >= 36.2 && x <= 46.8 && z >= 6.0 && z <= 15.2) return true;
          // Playground B (SE quadrant)
          if (x >= 55.2 && x <= 65.8 && z >= 7.0 && z <= 15.8) return true;
          // Picnic patio
          if (x >= 56.5 && x <= 66.2 && z >= 0.4 && z <= 5.2) return true;
          return false;
        },
      }),
    [],
  );

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
        <GrandCommunityFountain position={[0, SIDEWALK_HEIGHT, 8.8]} timeOfDay={timeOfDay} />

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
      {/* DISTRICT 3 — COMMUNITY CENTRAL PARK (X in [34.05, 70.7], Z [-18..18]) */}
      {/* ===================================================================== */}
      <group>
        {/* Park Lawn Base Pad */}
        <mesh position={[52.375, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
          <boxGeometry args={[36.65, SIDEWALK_HEIGHT, 35.9]} />
          <meshStandardMaterial
            map={textures.grass}
            color="#73a25a"
            roughness={0.92}
            polygonOffset
            polygonOffsetFactor={1}
          />
        </mesh>

        {/* Primary Stone & Granite Cross Walkways */}
        <group position={[0, SIDEWALK_HEIGHT + 0.015, 0]}>
          <mesh position={[48.6, 0, 0]} receiveShadow>
            <boxGeometry args={[2.3, 0.024, 35.5]} />
            <meshStandardMaterial map={textures.parkGravel} color="#ddd2bc" roughness={0.9} />
          </mesh>
          <mesh position={[52.3, 0.005, -1.0]} receiveShadow>
            <boxGeometry args={[36.2, 0.024, 2.3]} />
            <meshStandardMaterial
              map={textures.parkGravel}
              color="#ddd2bc"
              roughness={0.9}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>
          {/* Fountain Circular Stone Plaza */}
          <mesh position={[42.2, 0.01, -1.0]} receiveShadow>
            <cylinderGeometry args={[4.75, 4.85, 0.028, 32]} />
            <meshStandardMaterial
              map={textures.cobblestone}
              color="#d4cbb8"
              roughness={0.84}
              polygonOffset
              polygonOffsetFactor={-2}
            />
          </mesh>
          {/* Paved Picnic Patio Deck (South-East) */}
          <mesh position={[61.4, 0.008, 2.6]} receiveShadow>
            <boxGeometry args={[9.2, 0.022, 4.2]} />
            <meshStandardMaterial
              map={textures.sidewalkStone}
              color="#dcd4c4"
              roughness={0.86}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>
        </group>

        {/* Winding Curved Stone Pedestrian Loops connecting Fountain, Playgrounds A & B & Picnic Area */}
        <WindingStonePathway points={windingEastLoop} width={1.8} y={SIDEWALK_HEIGHT + 0.026} />
        <WindingStonePathway points={windingSouthLoop} width={1.8} y={SIDEWALK_HEIGHT + 0.026} />

        {/* Grand Central Community Fountain (with stepped rim, water arcs & ripples) */}
        <GrandCommunityFountain
          position={[42.2, SIDEWALK_HEIGHT, -1.0]}
          scale={0.78}
          timeOfDay={timeOfDay}
        />

        {/* Scenic Park Lake + Stone Shore + Red Steel Arch Footbridge */}
        <group position={[58.0, SIDEWALK_HEIGHT, -8.5]}>
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <boxGeometry args={[15.8, 0.08, 10.6]} />
            <meshStandardMaterial map={textures.cobblestone} color="#b9b2a4" roughness={0.88} />
          </mesh>
          <AnimatedWaterPlane
            position={[0, 0.11, 0]}
            width={14.6}
            depth={9.4}
            segmentsX={14}
            segmentsZ={10}
            baseColor="#26738e"
            crestColor="#92ddf0"
            waveAmp={0.022}
            rippleScale={1.45}
            tag="core-park-lake"
          />
          <group>
            <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.2, 0.16, 10.4]} />
              <meshStandardMaterial map={textures.timber} color="#8c613e" roughness={0.8} />
            </mesh>
            {[-4.95, 4.95].map((az, ai) => (
              <mesh key={`abut-${ai}`} position={[0, 0.24, az]} receiveShadow castShadow>
                <boxGeometry args={[2.5, 0.44, 0.7]} />
                <meshStandardMaterial color="#b9b2a4" roughness={0.86} />
              </mesh>
            ))}
            {[-1.02, 1.02].map((rx, ri) => (
              <group key={`arch-side-${ri}`} position={[rx, 0.48, 0]}>
                <mesh position={[0, 0.36, 0]} castShadow>
                  <boxGeometry args={[0.1, 0.12, 10.2]} />
                  <meshStandardMaterial color="#b91c1c" roughness={0.38} metalness={0.58} />
                </mesh>
                <mesh position={[0, 0.72, 0]} castShadow>
                  <boxGeometry args={[0.08, 0.08, 10.2]} />
                  <meshStandardMaterial color="#dc2626" roughness={0.35} metalness={0.62} />
                </mesh>
                <mesh
                  position={[0, 0.02, 0]}
                  rotation={[0, Math.PI / 2, 0]}
                  scale={[1, 0.42, 1]}
                  castShadow
                >
                  <torusGeometry args={[4.6, 0.09, 8, 20, Math.PI]} />
                  <meshStandardMaterial color="#b91c1c" roughness={0.34} metalness={0.64} />
                </mesh>
                {[-3.2, -1.6, 0, 1.6, 3.2].map((rz, si) => {
                  const archH = Math.sqrt(Math.max(0, 4.6 * 4.6 - rz * rz)) * 0.42;
                  return (
                    <mesh key={`rod-${si}`} position={[0, archH / 2 + 0.04, rz]} castShadow>
                      <cylinderGeometry args={[0.035, 0.035, Math.max(0.4, archH), 6]} />
                      <meshStandardMaterial color="#991b1b" roughness={0.4} metalness={0.6} />
                    </mesh>
                  );
                })}
                {[-4.7, 4.7].map((lz, li) => (
                  <group key={`lan-${li}`} position={[0, 0.96, lz]}>
                    <mesh castShadow>
                      <cylinderGeometry args={[0.05, 0.06, 0.5, 8]} />
                      <meshStandardMaterial color="#7f1d1d" roughness={0.42} metalness={0.65} />
                    </mesh>
                    <mesh position={[0, 0.32, 0]}>
                      <sphereGeometry args={[0.12, 8, 8]} />
                      <meshStandardMaterial
                        color="#fff3d1"
                        emissive="#ffae34"
                        emissiveIntensity={1.15}
                        roughness={0.2}
                      />
                    </mesh>
                  </group>
                ))}
              </group>
            ))}
            {[-1.5, 0, 1.5].map((cz, ci) => {
              const braceY = 0.48 + Math.sqrt(Math.max(0, 4.6 * 4.6 - cz * cz)) * 0.42;
              return (
                <mesh key={`brace-${ci}`} position={[0, braceY, cz]} castShadow>
                  <boxGeometry args={[2.12, 0.08, 0.1]} />
                  <meshStandardMaterial color="#b91c1c" roughness={0.36} metalness={0.62} />
                </mesh>
              );
            })}
          </group>
        </group>

        {/* Community Tennis Court (North-West Park Quadrant) */}
        <group position={[41.2, SIDEWALK_HEIGHT + 0.02, -11.5]}>
          <mesh receiveShadow>
            <boxGeometry args={[9.6, 0.04, 6.2]} />
            <meshStandardMaterial color="#3c6e57" roughness={0.85} />
          </mesh>
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

        {/* PLAYGROUND A — South-West Quadrant (Multi-Level Tower, Curved 3D Slide, Rock Wall, Swings) */}
        <PlaygroundAlpha position={[41.5, SIDEWALK_HEIGHT, 10.6]} scale={0.94} />

        {/* PLAYGROUND B — South-East Quadrant (Double Slides, Swing Set, Playhouse, Climbing Dome, Seesaw) */}
        <PlaygroundBeta position={[60.5, SIDEWALK_HEIGHT, 11.4]} scale={0.92} />

        {/* Shaded Picnic & Family Social Area (North of Playground B) */}
        <ParkPicnicSet position={[59.2, SIDEWALK_HEIGHT + 0.02, 2.6]} umbrellaColor="#b91c1c" />
        <ParkPicnicSet
          position={[63.8, SIDEWALK_HEIGHT + 0.02, 2.6]}
          rotationY={Math.PI / 6}
          umbrellaColor="#1e40af"
        />

        {/* Decorative Park Benches beside Playgrounds & Winding Walkways */}
        <ParkBench position={[54.2, SIDEWALK_HEIGHT + 0.02, 10.6]} rotationY={Math.PI / 2} />
        <ParkBench position={[47.2, SIDEWALK_HEIGHT + 0.02, 12.0]} rotationY={-Math.PI / 2} />

        {/* Glass-Fronted Park Map Information Boards */}
        <ParkInfoBoard position={[46.8, SIDEWALK_HEIGHT + 0.02, -16.4]} rotationY={0} />
        <ParkInfoBoard position={[50.4, SIDEWALK_HEIGHT + 0.02, 16.4]} rotationY={Math.PI} />

        {/* Sculpted Flowerbeds with Soil & Stone Edging */}
        <ParkFlowerbed position={[36.4, SIDEWALK_HEIGHT, -4.6]} width={2.8} depth={1.4} />
        <ParkFlowerbed position={[45.6, SIDEWALK_HEIGHT, -4.8]} width={2.4} depth={1.3} />
        <ParkFlowerbed position={[53.8, SIDEWALK_HEIGHT, -15.8]} width={3.6} depth={1.4} />
        <ParkFlowerbed position={[66.8, SIDEWALK_HEIGHT, -15.6]} circular width={2.2} depth={2.2} />
        <ParkFlowerbed position={[54.5, SIDEWALK_HEIGHT, 16.6]} width={3.2} depth={1.2} />

        {/* Decorative Terracotta & Stone Planter Pots */}
        <ParkPlanterPot position={[35.2, SIDEWALK_HEIGHT, -2.5]} flowerVariant="pink" />
        <ParkPlanterPot position={[35.2, SIDEWALK_HEIGHT, 0.5]} flowerVariant="gold" />
        <ParkPlanterPot position={[69.5, SIDEWALK_HEIGHT, -2.5]} flowerVariant="violet" />
        <ParkPlanterPot position={[69.5, SIDEWALK_HEIGHT, 0.5]} flowerVariant="coral" />

        {/* Traditional Park Lamp Posts (Illuminate Automatically at Sunset/Night) */}
        {[
          [36.5, -2.4],
          [47.0, -3.2],
          [50.2, 4.6],
          [47.0, 14.5],
          [54.2, 6.2],
          [66.8, 0.6],
          [66.8, 7.2],
          [50.2, -14.2],
        ].map(([lx, lz], li) => (
          <ParkLampPost key={`plamp-${li}`} position={[lx, SIDEWALK_HEIGHT, lz]} timeOfDay={timeOfDay} />
        ))}

        {/* Decorative Litter Bins & Entrance Bollards */}
        <ParkLitterBin position={[47.2, SIDEWALK_HEIGHT, 3.8]} />
        <ParkLitterBin position={[54.8, SIDEWALK_HEIGHT, 4.2]} />
        <ParkLitterBin position={[50.1, SIDEWALK_HEIGHT, -3.0]} />

        <ParkStoneBollard position={[47.1, SIDEWALK_HEIGHT, -17.5]} timeOfDay={timeOfDay} />
        <ParkStoneBollard position={[50.1, SIDEWALK_HEIGHT, -17.5]} timeOfDay={timeOfDay} />
        <ParkStoneBollard position={[47.1, SIDEWALK_HEIGHT, 17.5]} timeOfDay={timeOfDay} />
        <ParkStoneBollard position={[50.1, SIDEWALK_HEIGHT, 17.5]} timeOfDay={timeOfDay} />

        {/* Low Decorative Wrought-Iron Garden Border Fences Framing Street Sides */}
        <LowParkBorderFence position={[40.6, SIDEWALK_HEIGHT, -17.7]} length={11.0} />
        <LowParkBorderFence position={[60.2, SIDEWALK_HEIGHT, -17.7]} length={18.0} />
        <LowParkBorderFence position={[40.6, SIDEWALK_HEIGHT, 17.7]} length={11.0} />
        <LowParkBorderFence position={[60.2, SIDEWALK_HEIGHT, 17.7]} length={18.0} />

        {/* 3D Animated Park Grass Tufts */}
        <InstancedGrassField tufts={coreParkGrass} />

        {/* Varied Park Tree Clusters */}
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
