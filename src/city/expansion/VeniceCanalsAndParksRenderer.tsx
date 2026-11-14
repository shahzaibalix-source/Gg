import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeOfDay } from '../types';
import { ROAD_SURFACE_Y, SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';
import { ParkBench, ParkFountain, StylizedTree } from '../assets/FoliageAndProps';
import {
  GrandCommunityFountain,
  ParkFlowerbed,
  ParkInfoBoard,
  ParkLampPost,
  ParkLitterBin,
  ParkPicnicSet,
  PlaygroundAlpha,
  PlaygroundBeta,
} from '../assets/CommunityParkProps';
import {
  AnimatedWaterPlane,
  BusStopShelter,
  InstancedGrassField,
  VenetianGondola,
  generateParkGrassTufts,
} from '../assets/NaturePropsAndWater';
import { ExpansionCityWorld } from './ExpansionMasterPlan';
import {
  DistrictParkSpec,
  ExpansionBridgeSpec,
  ExpansionCanalSpec,
  OgPocketGardenSpec,
} from './types';

interface VeniceCanalsAndParksRendererProps {
  world: ExpansionCityWorld;
  timeOfDay: TimeOfDay;
}

const _dummy = new THREE.Object3D();

const STONE_QUAY_MAT = new THREE.MeshStandardMaterial({
  color: '#d4ccbc',
  roughness: 0.82,
  polygonOffset: true,
  polygonOffsetFactor: 1,
});
const STONE_BED_MAT = new THREE.MeshStandardMaterial({
  color: '#0e2c3a',
  roughness: 0.94,
});
const BRIDGE_DECK_MAT = new THREE.MeshStandardMaterial({
  color: '#3f454e',
  roughness: 0.84,
});
const BRIDGE_STONE_MAT = new THREE.MeshStandardMaterial({
  color: '#cfc7b8',
  roughness: 0.78,
});
const BRIDGE_WOOD_MAT = new THREE.MeshStandardMaterial({
  color: '#885b37',
  roughness: 0.78,
});
const BRIDGE_IRON_MAT = new THREE.MeshStandardMaterial({
  color: '#252b33',
  roughness: 0.42,
  metalness: 0.7,
});
const GOLD_STRIPE_MAT = new THREE.MeshStandardMaterial({
  color: '#e5b84b',
  roughness: 0.68,
});

// -----------------------------------------------------------------------------
// Instanced Collector-Road Benches (85 HD slatted timber & iron benches)
// -----------------------------------------------------------------------------
const InstancedStreetBenches: React.FC<{
  benches: Array<{ id: string; x: number; z: number; rotY: number }>;
}> = React.memo(({ benches }) => {
  const seatRef = useRef<THREE.InstancedMesh>(null);
  const backRef = useRef<THREE.InstancedMesh>(null);
  const legLRef = useRef<THREE.InstancedMesh>(null);
  const legRRef = useRef<THREE.InstancedMesh>(null);

  const geos = useMemo(
    () => ({
      seat: new THREE.BoxGeometry(1.82, 0.08, 0.44),
      back: new THREE.BoxGeometry(1.82, 0.34, 0.06),
      leg: new THREE.BoxGeometry(0.08, 0.46, 0.48),
    }),
    [],
  );

  const mats = useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({ color: '#94613a', roughness: 0.74 }),
      iron: new THREE.MeshStandardMaterial({ color: '#22272e', roughness: 0.44, metalness: 0.74 }),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      geos.seat.dispose();
      geos.back.dispose();
      geos.leg.dispose();
      mats.wood.dispose();
      mats.iron.dispose();
    };
  }, [geos, mats]);

  useEffect(() => {
    if (benches.length === 0) return;
    benches.forEach((b, i) => {
      const sin = Math.sin(b.rotY);
      const cos = Math.cos(b.rotY);

      if (seatRef.current) {
        _dummy.position.set(b.x, SIDEWALK_HEIGHT + 0.44, b.z);
        _dummy.rotation.set(0, b.rotY, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        seatRef.current.setMatrixAt(i, _dummy.matrix);
      }

      if (backRef.current) {
        _dummy.position.set(b.x - 0.21 * sin, SIDEWALK_HEIGHT + 0.68, b.z - 0.21 * cos);
        _dummy.rotation.set(-0.22, b.rotY, 0);
        _dummy.updateMatrix();
        backRef.current.setMatrixAt(i, _dummy.matrix);
      }

      if (legLRef.current) {
        _dummy.position.set(b.x - 0.76 * cos, SIDEWALK_HEIGHT + 0.23, b.z + 0.76 * sin);
        _dummy.rotation.set(0, b.rotY, 0);
        _dummy.updateMatrix();
        legLRef.current.setMatrixAt(i, _dummy.matrix);
      }

      if (legRRef.current) {
        _dummy.position.set(b.x + 0.76 * cos, SIDEWALK_HEIGHT + 0.23, b.z - 0.76 * sin);
        _dummy.rotation.set(0, b.rotY, 0);
        _dummy.updateMatrix();
        legRRef.current.setMatrixAt(i, _dummy.matrix);
      }
    });

    [seatRef.current, backRef.current, legLRef.current, legRRef.current].forEach((m) => {
      if (m) {
        m.instanceMatrix.needsUpdate = true;
        m.computeBoundingSphere();
      }
    });
  }, [benches]);

  if (benches.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={seatRef} args={[geos.seat, mats.wood, benches.length]} frustumCulled />
      <instancedMesh ref={backRef} args={[geos.back, mats.wood, benches.length]} frustumCulled />
      <instancedMesh ref={legLRef} args={[geos.leg, mats.iron, benches.length]} frustumCulled />
      <instancedMesh ref={legRRef} args={[geos.leg, mats.iron, benches.length]} frustumCulled />
    </group>
  );
});

// -----------------------------------------------------------------------------
// Venice Canal Channel with Quay Embankments, Mooring Posts & Animated 3D Water
// -----------------------------------------------------------------------------
const VeniceCanalMesh: React.FC<{ canal: ExpansionCanalSpec; idx: number }> = React.memo(
  ({ canal, idx }) => {
    const cx = (canal.x1 + canal.x2) / 2;
    const cz = (canal.z1 + canal.z2) / 2;
    const dx = canal.x2 - canal.x1;
    const dz = canal.z2 - canal.z1;
    const len = Math.hypot(dx, dz);
    const isNS = Math.abs(dz) > Math.abs(dx);

    // Slight Y stagger between N-S and E-W canals prevents coplanar Z-fighting at intersections
    const waterY = isNS ? 0.035 : 0.028;
    const quayY = isNS ? SIDEWALK_HEIGHT / 2 + 0.04 : SIDEWALK_HEIGHT / 2 + 0.032;

    const mooringOffsets = useMemo(() => {
      const count = Math.floor(len / 140);
      const pts: number[] = [];
      for (let i = 1; i < count; i++) {
        pts.push(-len / 2 + i * 140);
      }
      return pts;
    }, [len]);

    return (
      <group position={[cx, 0, cz]} rotation={[0, isNS ? 0 : Math.PI / 2, 0]}>
        {/* Deep Stone Canal Bed */}
        <mesh position={[0, -0.14, 0]} material={STONE_BED_MAT} receiveShadow>
          <boxGeometry args={[canal.width + 0.6, 0.2, len]} />
        </mesh>

        {/* Animated 3D GLSL Canal Water */}
        <AnimatedWaterPlane
          position={[0, waterY, 0]}
          width={canal.width}
          depth={len}
          segmentsX={10}
          segmentsZ={56}
          baseColor="#146a87"
          crestColor="#8adcf0"
          waveAmp={0.028}
          rippleScale={1.15}
          tag={`canal-${idx}`}
        />

        {/* Travertine Stone Canal Quay Embankments (Left & Right) */}
        <mesh
          position={[-(canal.width / 2 + 0.75), quayY, 0]}
          material={STONE_QUAY_MAT}
          receiveShadow
        >
          <boxGeometry args={[1.5, SIDEWALK_HEIGHT + 0.16, len + 2]} />
        </mesh>
        <mesh
          position={[canal.width / 2 + 0.75, quayY, 0]}
          material={STONE_QUAY_MAT}
          receiveShadow
        >
          <boxGeometry args={[1.5, SIDEWALK_HEIGHT + 0.16, len + 2]} />
        </mesh>

        {/* Venetian Striped Gondola Mooring Posts (Pali da Casada) */}
        {mooringOffsets.map((mz, mIdx) => (
          <group key={mIdx} position={[(mIdx % 2 === 0 ? -1 : 1) * (canal.width / 2 - 2.1), 0, mz]}>
            <mesh position={[0, 0.72, 0]} castShadow>
              <cylinderGeometry args={[0.13, 0.15, 1.55, 8]} />
              <meshStandardMaterial
                color={mIdx % 2 === 0 ? '#9b2226' : '#1d4e89'}
                roughness={0.62}
              />
            </mesh>
            <mesh position={[0, 1.52, 0]}>
              <sphereGeometry args={[0.14, 8, 8]} />
              <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.7} />
            </mesh>
          </group>
        ))}
      </group>
    );
  },
);

// -----------------------------------------------------------------------------
// Venetian Arched Road & Pedestrian Bridges
// -----------------------------------------------------------------------------
const VeniceBridgeMesh: React.FC<{ bridge: ExpansionBridgeSpec; timeOfDay: TimeOfDay }> =
  React.memo(({ bridge, timeOfDay }) => {
    const isPed = bridge.kind === 'pedestrian';
    const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';
    const halfLen = bridge.length / 2;
    const halfW = bridge.width / 2;

    if (isPed) {
      return (
        <group position={[bridge.x, 0, bridge.z]} rotation={[0, bridge.rotY, 0]}>
          {/* Stone Bridge Abutments */}
          <mesh position={[-halfLen + 2.2, 0.36, 0]} material={BRIDGE_STONE_MAT} receiveShadow>
            <boxGeometry args={[4.4, 0.72, bridge.width + 0.4]} />
          </mesh>
          <mesh position={[halfLen - 2.2, 0.36, 0]} material={BRIDGE_STONE_MAT} receiveShadow>
            <boxGeometry args={[4.4, 0.72, bridge.width + 0.4]} />
          </mesh>
          {/* Gently Arched Venetian Pedestrian Span */}
          <mesh
            position={[-halfLen * 0.44, 0.72, 0]}
            rotation={[0, 0, 0.085]}
            material={BRIDGE_WOOD_MAT}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[halfLen * 0.85, 0.24, bridge.width - 0.3]} />
          </mesh>
          <mesh
            position={[0, 1.02, 0]}
            material={BRIDGE_WOOD_MAT}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[halfLen * 0.56, 0.26, bridge.width - 0.3]} />
          </mesh>
          <mesh
            position={[halfLen * 0.44, 0.72, 0]}
            rotation={[0, 0, -0.085]}
            material={BRIDGE_WOOD_MAT}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[halfLen * 0.85, 0.24, bridge.width - 0.3]} />
          </mesh>
          {/* Side Stone & Iron Balustrades */}
          {[-halfW + 0.22, halfW - 0.22].map((rz, ri) => (
            <group key={ri} position={[0, 1.38, rz]}>
              <mesh material={BRIDGE_STONE_MAT} castShadow>
                <boxGeometry args={[bridge.length - 1.5, 0.56, 0.22]} />
              </mesh>
              <mesh position={[0, 0.38, 0]} material={BRIDGE_IRON_MAT}>
                <boxGeometry args={[bridge.length - 1.2, 0.1, 0.28]} />
              </mesh>
            </group>
          ))}
        </group>
      );
    }

    // Double-Lane Venetian Road Bridge
    const deckY = ROAD_SURFACE_Y + 0.18;
    return (
      <group position={[bridge.x, 0, bridge.z]} rotation={[0, bridge.rotY, 0]}>
        {/* Structural Stone Under-Arch Piers */}
        {[-9.5, 9.5].map((px) => (
          <mesh key={px} position={[px, -0.1, 0]} material={BRIDGE_STONE_MAT} receiveShadow>
            <boxGeometry args={[1.6, 0.85, bridge.width + 0.6]} />
          </mesh>
        ))}
        {/* Stone Support Slab */}
        <mesh position={[0, deckY / 2, 0]} material={BRIDGE_STONE_MAT} receiveShadow castShadow>
          <boxGeometry args={[bridge.length, deckY + 0.12, bridge.width + 2.4]} />
        </mesh>
        {/* Double-Lane Asphalt Bridge Roadway */}
        <mesh position={[0, deckY + 0.04, 0]} material={BRIDGE_DECK_MAT} receiveShadow>
          <boxGeometry args={[bridge.length + 0.6, 0.08, bridge.width]} />
        </mesh>
        {/* Center Road Marking */}
        <mesh position={[0, deckY + 0.09, 0]} material={GOLD_STRIPE_MAT}>
          <boxGeometry args={[bridge.length - 1, 0.02, 0.2]} />
        </mesh>
        {/* Raised Sidewalks & Ornate Parapet Balustrades on Both Sides */}
        {[-halfW - 0.65, halfW + 0.65].map((sz, si) => (
          <group key={si} position={[0, 0, sz]}>
            <mesh position={[0, deckY + 0.14, 0]} material={BRIDGE_STONE_MAT} receiveShadow>
              <boxGeometry args={[bridge.length + 0.4, 0.2, 1.3]} />
            </mesh>
            <mesh position={[0, deckY + 0.66, sz > 0 ? 0.48 : -0.48]} material={BRIDGE_STONE_MAT} castShadow>
              <boxGeometry args={[bridge.length - 0.6, 0.84, 0.26]} />
            </mesh>
            {/* Glowing Corner Bridge Lanterns */}
            {[-halfLen + 1.2, halfLen - 1.2].map((lx, li) => (
              <group key={li} position={[lx, deckY + 1.22, sz > 0 ? 0.48 : -0.48]}>
                <mesh material={BRIDGE_IRON_MAT}>
                  <cylinderGeometry args={[0.09, 0.12, 0.6, 8]} />
                </mesh>
                <mesh position={[0, 0.36, 0]}>
                  <sphereGeometry args={[0.18, 8, 8]} />
                  <meshStandardMaterial
                    color="#fff2cf"
                    emissive="#ffae34"
                    emissiveIntensity={isEvening ? 2.2 : 0.12}
                  />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>
    );
  });

// -----------------------------------------------------------------------------
// Unique Neighborhood District Park Renderer (6 distinct European park layouts)
// -----------------------------------------------------------------------------
const DistrictParkMesh: React.FC<{ park: DistrictParkSpec; timeOfDay: TimeOfDay }> = React.memo(
  ({ park, timeOfDay }) => {
    const parkGrass = useMemo(
      () =>
        generateParkGrassTufts({
          cx: 0,
          cz: 0,
          y: SIDEWALK_HEIGHT + 0.02,
          width: park.width - 14,
          depth: park.depth - 12,
          count: 240,
          seed: Math.abs(park.x * 13 + park.z * 29) + 101,
          excludeFn: (lx, lz) => {
            if (Math.abs(lx) < 5.2 || Math.abs(lz) < 4.8) return true;
            if (Math.hypot(lx, lz) < 16) return true;
            if (park.variant === 'orchard-playground') {
              if (Math.abs(Math.abs(lx) - 16) < 7.5 && Math.abs(Math.abs(lz) - 12) < 6.5) {
                return true;
              }
            }
            return false;
          },
        }),
      [park],
    );

  const treeLayout: Array<[number, number, 'broadleaf' | 'cypress' | 'ornamental', number]> =
    useMemo(() => {
      if (park.variant === 'pine-pavilion') {
        return [
          [-50, -28, 'cypress', 1.25],
          [-38, 28, 'cypress', 1.18],
          [50, -26, 'cypress', 1.22],
          [40, 29, 'cypress', 1.12],
          [-54, 4, 'broadleaf', 1.15],
          [54, 6, 'broadleaf', 1.1],
          [-22, -30, 'cypress', 1.05],
          [24, -30, 'cypress', 1.08],
        ];
      }
      if (park.variant === 'orchard-playground') {
        return [
          [-52, -26, 'ornamental', 1.15],
          [-34, -28, 'ornamental', 1.05],
          [34, -28, 'ornamental', 1.1],
          [52, -26, 'ornamental', 1.18],
          [-50, 26, 'broadleaf', 1.12],
          [50, 26, 'broadleaf', 1.15],
        ];
      }
      return [
        [-52, -28, 'broadleaf', 1.16],
        [52, -28, 'broadleaf', 1.14],
        [-52, 28, 'broadleaf', 1.12],
        [52, 28, 'broadleaf', 1.18],
        [-28, -28, 'cypress', 1.08],
        [28, -28, 'cypress', 1.08],
        [-28, 28, 'ornamental', 1.0],
        [28, 28, 'ornamental', 1.0],
      ];
    }, [park.variant]);

  const flowerColor =
    park.variant === 'rose-fountain'
      ? '#f43f5e'
      : park.variant === 'orchard-playground'
        ? '#facc15'
        : park.variant === 'lily-pond'
          ? '#a78bfa'
          : '#fb923c';

  return (
    <group position={[park.x, 0, park.z]}>
      {/* Stone Curbed Neighborhood Park Base */}
      <mesh position={[0, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[park.width, SIDEWALK_HEIGHT, park.depth]} />
        <meshStandardMaterial color="#cfc8b8" roughness={0.86} polygonOffset polygonOffsetFactor={1} />
      </mesh>
      {/* Lush Lawn Deck */}
      <mesh position={[0, SIDEWALK_HEIGHT + 0.015, 0]} receiveShadow>
        <boxGeometry args={[park.width - 4, 0.03, park.depth - 4]} />
        <meshStandardMaterial
          color={park.variant === 'valley-meadow' ? '#73a854' : '#65994d'}
          roughness={0.94}
        />
      </mesh>

      {/* Decomposed-Granite Crossing Paths */}
      <mesh position={[0, SIDEWALK_HEIGHT + 0.03, 0]} receiveShadow>
        <boxGeometry args={[park.width - 5, 0.03, 5.2]} />
        <meshStandardMaterial color="#d8cfb8" roughness={0.9} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 0.038, 0]} receiveShadow>
        <boxGeometry args={[5.2, 0.03, park.depth - 5]} />
        <meshStandardMaterial color="#d8cfb8" roughness={0.9} />
      </mesh>

      {/* Central Stone Plaza */}
      <mesh position={[0, SIDEWALK_HEIGHT + 0.044, 0]} receiveShadow>
        <cylinderGeometry args={[12.5, 12.8, 0.06, 20]} />
        <meshStandardMaterial color="#d9d1c2" roughness={0.84} />
      </mesh>

      {/* Variant-Specific Signature Centerpiece */}
      {park.variant === 'pine-pavilion' && (
        <group position={[0, SIDEWALK_HEIGHT + 0.07, 0]}>
          <mesh position={[0, 0.25, 0]} receiveShadow>
            <cylinderGeometry args={[6.2, 6.6, 0.5, 8]} />
            <meshStandardMaterial color="#c4bdb0" roughness={0.85} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((pi) => {
            const a = (pi / 6) * Math.PI * 2;
            return (
              <mesh key={pi} position={[Math.cos(a) * 4.8, 2.2, Math.sin(a) * 4.8]} castShadow>
                <cylinderGeometry args={[0.16, 0.18, 3.6, 8]} />
                <meshStandardMaterial color="#7d5638" roughness={0.8} />
              </mesh>
            );
          })}
          <mesh position={[0, 4.9, 0]} castShadow>
            <coneGeometry args={[6.4, 2.6, 8]} />
            <meshStandardMaterial color="#3c6e57" roughness={0.62} />
          </mesh>
        </group>
      )}

      {park.variant === 'rose-fountain' && (
        <>
          <GrandCommunityFountain
            position={[0, SIDEWALK_HEIGHT + 0.06, 0]}
            scale={1.08}
            timeOfDay={timeOfDay}
          />
          {[
            [-22, -16],
            [22, -16],
            [-22, 16],
            [22, 16],
          ].map(([fx, fz], fi) => (
            <group key={fi} position={[fx, SIDEWALK_HEIGHT + 0.04, fz]}>
              <mesh position={[0, 0.14, 0]} receiveShadow>
                <boxGeometry args={[14, 0.28, 10]} />
                <meshStandardMaterial color="#3a6635" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.34, 0]}>
                <boxGeometry args={[10.5, 0.18, 6.5]} />
                <meshStandardMaterial color={flowerColor} roughness={0.8} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {(park.variant === 'courtyard-pool' || park.variant === 'lily-pond') && (
        <group position={[0, SIDEWALK_HEIGHT + 0.04, 0]}>
          <mesh position={[0, 0.18, 0]} receiveShadow>
            <boxGeometry args={[28, 0.36, 18]} />
            <meshStandardMaterial color="#cdc5b5" roughness={0.82} />
          </mesh>
          <AnimatedWaterPlane
            position={[0, 0.39, 0]}
            width={24.5}
            depth={14.5}
            segmentsX={14}
            segmentsZ={10}
            baseColor={park.variant === 'lily-pond' ? '#1f6e78' : '#2581a6'}
            crestColor="#99e4f5"
            waveAmp={0.022}
            tag={`dp-${park.variant}`}
          />
        </group>
      )}

      {park.variant === 'orchard-playground' && (
        <group position={[0, SIDEWALK_HEIGHT + 0.04, 0]}>
          <PlaygroundAlpha position={[-16, 0, 12]} scale={1.12} />
          <PlaygroundBeta position={[16, 0, 12]} scale={1.12} />
          <ParkPicnicSet position={[-16, 0, -12]} umbrellaColor="#0d9488" />
          <ParkPicnicSet position={[16, 0, -12]} rotationY={Math.PI / 8} umbrellaColor="#d97706" />
        </group>
      )}

      {park.variant === 'valley-meadow' && (
        <group position={[0, SIDEWALK_HEIGHT + 0.07, 0]}>
          {/* Scenic Pergola Gazebo + Wildflower Clusters */}
          <mesh position={[0, 0.15, 0]} receiveShadow>
            <boxGeometry args={[12, 0.3, 8]} />
            <meshStandardMaterial color="#d4cbb8" roughness={0.84} />
          </mesh>
          {[-5, 5].map((px) =>
            [-3, 3].map((pz) => (
              <mesh key={`${px}-${pz}`} position={[px, 1.5, pz]} castShadow>
                <cylinderGeometry args={[0.14, 0.14, 2.8, 8]} />
                <meshStandardMaterial color="#875d3b" roughness={0.8} />
              </mesh>
            )),
          )}
          <mesh position={[0, 2.95, 0]} castShadow>
            <boxGeometry args={[11.2, 0.16, 7.2]} />
            <meshStandardMaterial color="#754e30" roughness={0.78} />
          </mesh>
        </group>
      )}

      {park.variant === 'garden-rotunda' && (
        <group position={[0, SIDEWALK_HEIGHT + 0.06, 0]}>
          {/* Classical Marble Rotunda + Central Fountain + Radial Flower Parterres */}
          <mesh position={[0, 0.22, 0]} receiveShadow>
            <cylinderGeometry args={[7.4, 7.9, 0.44, 24]} />
            <meshStandardMaterial color="#dfd7c8" roughness={0.78} />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((ci) => {
            const ang = (ci / 8) * Math.PI * 2;
            return (
              <mesh
                key={`rot-col-${ci}`}
                position={[Math.cos(ang) * 5.8, 2.25, Math.sin(ang) * 5.8]}
                castShadow
              >
                <cylinderGeometry args={[0.19, 0.23, 3.8, 10]} />
                <meshStandardMaterial color="#f5efe4" roughness={0.62} />
              </mesh>
            );
          })}
          <mesh position={[0, 4.3, 0]} castShadow>
            <torusGeometry args={[5.8, 0.32, 8, 28]} />
            <meshStandardMaterial color="#e7dfd0" roughness={0.65} />
          </mesh>
          <mesh position={[0, 5.15, 0]} castShadow>
            <sphereGeometry args={[5.8, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
            <meshStandardMaterial color="#3b7a68" roughness={0.45} metalness={0.35} />
          </mesh>
          <GrandCommunityFountain position={[0, 0.44, 0]} scale={0.72} timeOfDay={timeOfDay} />
          {[
            [-20, -14],
            [20, -14],
            [-20, 14],
            [20, 14],
          ].map(([fx, fz], fi) => (
            <group key={`rot-fl-${fi}`} position={[fx, 0.02, fz]}>
              <mesh position={[0, 0.14, 0]} receiveShadow>
                <cylinderGeometry args={[5.2, 5.5, 0.28, 16]} />
                <meshStandardMaterial color="#3b6b38" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[3.9, 4.1, 0.16, 16]} />
                <meshStandardMaterial
                  color={fi % 2 === 0 ? '#f43f5e' : '#fbbf24'}
                  roughness={0.78}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* HD Wind-Swaying 3D Grass Tufts Across All District Park Lawns */}
      <InstancedGrassField tufts={parkGrass} />

      {/* 4 HD Slatted Timber & Cast-Iron Benches Around Central Plaza */}
      {[
        [-14, -6, 0],
        [14, -6, 0],
        [-14, 6, Math.PI],
        [14, 6, Math.PI],
      ].map(([bx, bz, rot], bi) => (
        <ParkBench key={bi} position={[bx, SIDEWALK_HEIGHT + 0.05, bz]} rotationY={rot} />
      ))}

      {/* District Park Lamp Posts, Flowerbeds, Info Board & Litter Bins */}
      {[
        [-18, -3.8],
        [18, 3.8],
        [-3.8, -18],
        [3.8, 18],
      ].map(([lx, lz], li) => (
        <ParkLampPost key={`dp-lamp-${li}`} position={[lx, SIDEWALK_HEIGHT, lz]} timeOfDay={timeOfDay} />
      ))}
      <ParkLitterBin position={[-11.8, SIDEWALK_HEIGHT + 0.04, -5.8]} />
      <ParkLitterBin position={[11.8, SIDEWALK_HEIGHT + 0.04, 5.8]} />
      <ParkInfoBoard position={[-4.2, SIDEWALK_HEIGHT + 0.04, -30]} rotationY={0} title={park.name.toUpperCase()} />
      {park.variant !== 'rose-fountain' && (
        <>
          <ParkFlowerbed position={[-22, SIDEWALK_HEIGHT + 0.03, -8]} width={3.6} depth={1.6} />
          <ParkFlowerbed position={[22, SIDEWALK_HEIGHT + 0.03, 8]} width={3.6} depth={1.6} />
        </>
      )}

      {/* District Park Trees */}
      {treeLayout.map(([tx, tz, variant, scale], ti) => (
        <StylizedTree
          key={ti}
          position={[tx, SIDEWALK_HEIGHT + 0.04, tz]}
          variant={variant}
          scale={scale}
          rotationY={ti * 0.9}
        />
      ))}
    </group>
  );
});

// -----------------------------------------------------------------------------
// Instanced Landscaped Pocket Gardens Between OG 50 Mansions (34 Gardens)
// -----------------------------------------------------------------------------
const OgPocketGardensRenderer: React.FC<{ gardens: OgPocketGardenSpec[] }> = React.memo(
  ({ gardens }) => {
    const rimRef = useRef<THREE.InstancedMesh>(null);
    const grassRef = useRef<THREE.InstancedMesh>(null);
    const hedgeRef = useRef<THREE.InstancedMesh>(null);
    const flowerRef = useRef<THREE.InstancedMesh>(null);
    const treeTrunkRef = useRef<THREE.InstancedMesh>(null);
    const treeCrownRef = useRef<THREE.InstancedMesh>(null);

    const geos = useMemo(
      () => ({
        box: new THREE.BoxGeometry(1, 1, 1),
        shrub: new THREE.DodecahedronGeometry(0.45, 0),
        trunk: new THREE.CylinderGeometry(0.11, 0.16, 1.5, 7),
        crown: new THREE.DodecahedronGeometry(1.0, 1),
      }),
      [],
    );

    const mats = useMemo(
      () => ({
        rim: new THREE.MeshStandardMaterial({ color: '#cfc7b6', roughness: 0.86 }),
        grass: new THREE.MeshStandardMaterial({ color: '#5f9649', roughness: 0.92 }),
        hedge: new THREE.MeshStandardMaterial({ color: '#386b35', roughness: 0.88 }),
        flower: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78 }),
        trunk: new THREE.MeshStandardMaterial({ color: '#6b472b', roughness: 0.88 }),
        crown: new THREE.MeshStandardMaterial({ color: '#478242', roughness: 0.84 }),
      }),
      [],
    );

    useEffect(() => {
      return () => {
        geos.box.dispose();
        geos.shrub.dispose();
        geos.trunk.dispose();
        geos.crown.dispose();
        mats.rim.dispose();
        mats.grass.dispose();
        mats.hedge.dispose();
        mats.flower.dispose();
        mats.trunk.dispose();
        mats.crown.dispose();
      };
    }, [geos, mats]);

    const colorScratch = useMemo(() => new THREE.Color(), []);

    useEffect(() => {
      if (gardens.length === 0) return;

      gardens.forEach((g, i) => {
        if (rimRef.current) {
          _dummy.position.set(g.x, SIDEWALK_HEIGHT / 2, g.z);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(g.width, SIDEWALK_HEIGHT, g.depth);
          _dummy.updateMatrix();
          rimRef.current.setMatrixAt(i, _dummy.matrix);
        }
        if (grassRef.current) {
          _dummy.position.set(g.x, SIDEWALK_HEIGHT + 0.016, g.z);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(Math.max(1.8, g.width - 0.5), 0.03, Math.max(4, g.depth - 0.8));
          _dummy.updateMatrix();
          grassRef.current.setMatrixAt(i, _dummy.matrix);
        }
        if (hedgeRef.current) {
          for (let h = 0; h < 2; h++) {
            const hz = h === 0 ? -5.5 : 5.5;
            _dummy.position.set(g.x, SIDEWALK_HEIGHT + 0.34, g.z + hz);
            _dummy.rotation.set(0, 0, 0);
            _dummy.scale.set(Math.min(2.1, g.width - 0.9), 0.65, 2.2);
            _dummy.updateMatrix();
            hedgeRef.current.setMatrixAt(i * 2 + h, _dummy.matrix);
          }
        }
        if (flowerRef.current) {
          for (let f = 0; f < 3; f++) {
            const fz = (f - 1) * 3.4;
            _dummy.position.set(g.x, SIDEWALK_HEIGHT + 0.35, g.z + fz);
            _dummy.rotation.set(0, f * 0.8, 0);
            _dummy.scale.set(1.05, 0.72, 1.05);
            _dummy.updateMatrix();
            flowerRef.current.setMatrixAt(i * 3 + f, _dummy.matrix);
            colorScratch.set(g.flowerTint);
            flowerRef.current.setColorAt(i * 3 + f, colorScratch);
          }
        }
        if (treeTrunkRef.current && treeCrownRef.current) {
          _dummy.position.set(g.x, SIDEWALK_HEIGHT + 0.75, g.z - 8.2);
          _dummy.rotation.set(0, i * 0.9, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          treeTrunkRef.current.setMatrixAt(i, _dummy.matrix);

          _dummy.position.set(g.x, SIDEWALK_HEIGHT + 2.15, g.z - 8.2);
          _dummy.scale.set(1.18, 1.32, 1.18);
          _dummy.updateMatrix();
          treeCrownRef.current.setMatrixAt(i, _dummy.matrix);
        }
      });

      [
        rimRef.current,
        grassRef.current,
        hedgeRef.current,
        flowerRef.current,
        treeTrunkRef.current,
        treeCrownRef.current,
      ].forEach((m) => {
        if (m) {
          m.instanceMatrix.needsUpdate = true;
          m.computeBoundingSphere();
        }
      });
      if (flowerRef.current?.instanceColor) {
        flowerRef.current.instanceColor.needsUpdate = true;
      }
    }, [gardens, colorScratch]);

    if (gardens.length === 0) return null;

    return (
      <group>
        <instancedMesh ref={rimRef} args={[geos.box, mats.rim, gardens.length]} receiveShadow frustumCulled />
        <instancedMesh ref={grassRef} args={[geos.box, mats.grass, gardens.length]} receiveShadow frustumCulled />
        <instancedMesh ref={hedgeRef} args={[geos.box, mats.hedge, gardens.length * 2]} castShadow frustumCulled />
        <instancedMesh ref={flowerRef} args={[geos.shrub, mats.flower, gardens.length * 3]} frustumCulled />
        <instancedMesh ref={treeTrunkRef} args={[geos.trunk, mats.trunk, gardens.length]} castShadow frustumCulled />
        <instancedMesh ref={treeCrownRef} args={[geos.crown, mats.crown, gardens.length]} castShadow frustumCulled />
        {gardens
          .filter((g) => g.hasBench)
          .map((g) => (
            <ParkBench
              key={`og-pg-b-${g.id}`}
              position={[g.x, SIDEWALK_HEIGHT + 0.04, g.z + 8.8]}
              rotationY={0}
            />
          ))}
      </group>
    );
  },
);

// -----------------------------------------------------------------------------
// Royal Crescent Gardens, Fountain & VIP Helipad Behind Sweet_thedevil Palace
// -----------------------------------------------------------------------------
const RoyalCrescentGarden: React.FC<{ timeOfDay: TimeOfDay }> = React.memo(({ timeOfDay }) => {
  const mainRotorRef = useRef<THREE.Group>(null);
  const tailRotorRef = useRef<THREE.Group>(null);
  const windsockRef = useRef<THREE.Mesh>(null);
  const isNight = timeOfDay === 'night' || timeOfDay === 'sunset';

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    if (mainRotorRef.current) {
      mainRotorRef.current.rotation.y += dt * 1.45;
    }
    if (tailRotorRef.current) {
      tailRotorRef.current.rotation.x += dt * 4.2;
    }
    if (windsockRef.current) {
      windsockRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 1.6) * 0.22 + 0.3;
    }
  });

  const gardenGrass = useMemo(
    () =>
      generateParkGrassTufts({
        cx: 0,
        cz: -284,
        y: SIDEWALK_HEIGHT + 0.02,
        width: 48,
        depth: 64,
        count: 220,
        seed: 5511,
        excludeFn: (x, z) =>
          Math.hypot(x, z + 264) < 7.8 ||
          Math.hypot(x, z + 303) < 12.2 ||
          Math.abs(x) < 3.4,
      }),
    [],
  );

  return (
    <group>
      {/* Stone Terrace & Lush Lawn */}
      <mesh position={[0, SIDEWALK_HEIGHT / 2, -284]} receiveShadow>
        <boxGeometry args={[56, SIDEWALK_HEIGHT, 72]} />
        <meshStandardMaterial color="#d8d1c2" roughness={0.82} polygonOffset polygonOffsetFactor={1} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 0.015, -284]} receiveShadow>
        <boxGeometry args={[52, 0.03, 68]} />
        <meshStandardMaterial color="#679b4e" roughness={0.94} />
      </mesh>
      {/* Central Promenade Walkway connecting Palace -> Fountain -> Helipad */}
      <mesh position={[0, SIDEWALK_HEIGHT + 0.03, -284]} receiveShadow>
        <boxGeometry args={[4.6, 0.03, 68]} />
        <meshStandardMaterial color="#e5decb" roughness={0.85} />
      </mesh>

      {/* Grand Royal Fountain (z = -264) + Flanking Parterre Flower Gardens */}
      <ParkFountain position={[0, SIDEWALK_HEIGHT + 0.04, -264]} />
      {[-12.5, 12.5].map((fx, fi) => (
        <group key={`parterre-${fi}`} position={[fx, SIDEWALK_HEIGHT + 0.04, -264]}>
          <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
            <boxGeometry args={[10.5, 0.24, 14.5]} />
            <meshStandardMaterial color="#2f5e32" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.26, 0]} receiveShadow>
            <boxGeometry args={[8.4, 0.14, 12.0]} />
            <meshStandardMaterial color={fi === 0 ? '#e11d48' : '#f59e0b'} roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[1.6, 1.8, 0.22, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.72} />
          </mesh>
        </group>
      ))}

      {/* Raised VIP Helipad Deck Behind #1 Palace Garden (0, -303) */}
      <group position={[0, SIDEWALK_HEIGHT, -303]}>
        {/* Concrete Octagonal Foundation */}
        <mesh position={[0, 0.11, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[10.6, 11.4, 0.22, 8]} />
          <meshStandardMaterial color="#2c333d" roughness={0.84} />
        </mesh>
        {/* Amber/Gold Outer Touchdown Ring */}
        <mesh position={[0, 0.225, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[7.9, 8.45, 32]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#f59e0b"
            emissiveIntensity={isNight ? 0.55 : 0.05}
            roughness={0.5}
          />
        </mesh>
        {/* Crisp White "H" Touchdown Marking */}
        <mesh position={[-1.7, 0.226, 0]}>
          <boxGeometry args={[0.7, 0.02, 5.2]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.45} />
        </mesh>
        <mesh position={[1.7, 0.226, 0]}>
          <boxGeometry args={[0.7, 0.02, 5.2]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.226, 0]}>
          <boxGeometry args={[3.4, 0.02, 0.72]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.45} />
        </mesh>
        {/* 8 Perimeter Helipad Approach Beacons */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((bi) => {
          const ang = (bi / 8) * Math.PI * 2 + Math.PI / 8;
          return (
            <mesh
              key={`hbeacon-${bi}`}
              position={[Math.cos(ang) * 9.8, 0.28, Math.sin(ang) * 9.8]}
            >
              <cylinderGeometry args={[0.16, 0.2, 0.12, 8]} />
              <meshStandardMaterial
                color={bi % 2 === 0 ? '#4ade80' : '#fbbf24'}
                emissive={bi % 2 === 0 ? '#22c55e' : '#f59e0b'}
                emissiveIntensity={isNight ? 2.6 : 0.5}
                roughness={0.25}
              />
            </mesh>
          );
        })}

        {/* Animated Safety Windsock Mast */}
        <group position={[11.6, 0, -5.5]}>
          <mesh position={[0, 2.2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 4.4, 8]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh
            ref={windsockRef}
            position={[0.65, 4.25, 0]}
            rotation={[0, 0, -Math.PI / 2.2]}
            castShadow
          >
            <coneGeometry args={[0.26, 1.35, 10]} />
            <meshStandardMaterial color="#f97316" roughness={0.65} />
          </mesh>
        </group>

        {/* Detailed VIP Executive Helicopter Parked on Helipad */}
        <group position={[0, 0.22, 0]} rotation={[0, 0.35, 0]}>
          {/* Twin Landing Skids + Support Struts */}
          {[-0.95, 0.95].map((sx, si) => (
            <group key={`skid-${si}`} position={[sx, 0, 0]}>
              <mesh position={[0, 0.1, 0.15]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 4.4, 8]} />
                <meshStandardMaterial color="#334155" roughness={0.35} metalness={0.75} />
              </mesh>
              <mesh position={[0, 0.42, -0.75]} rotation={[0, 0, sx > 0 ? 0.35 : -0.35]}>
                <cylinderGeometry args={[0.045, 0.045, 0.72, 6]} />
                <meshStandardMaterial color="#334155" roughness={0.35} metalness={0.75} />
              </mesh>
              <mesh position={[0, 0.42, 0.95]} rotation={[0, 0, sx > 0 ? 0.35 : -0.35]}>
                <cylinderGeometry args={[0.045, 0.045, 0.72, 6]} />
                <meshStandardMaterial color="#334155" roughness={0.35} metalness={0.75} />
              </mesh>
            </group>
          ))}

          {/* Sleek Midnight Navy & Gold Fuselage */}
          <mesh position={[0, 1.26, 0.25]} scale={[0.92, 0.85, 1.65]} castShadow>
            <sphereGeometry args={[1.25, 16, 12]} />
            <meshPhysicalMaterial
              color="#0f172a"
              roughness={0.22}
              metalness={0.55}
              clearcoat={0.92}
            />
          </mesh>
          {/* Gold Royal Accent Belt */}
          <mesh position={[0, 1.18, 0.2]} castShadow>
            <boxGeometry args={[2.16, 0.18, 3.05]} />
            <meshStandardMaterial color="#d4af37" roughness={0.25} metalness={0.85} />
          </mesh>
          {/* Tinted Clearcoat Cockpit Canopy */}
          <mesh position={[0, 1.44, 1.15]} scale={[0.82, 0.72, 1.12]}>
            <sphereGeometry args={[1.05, 14, 10]} />
            <meshPhysicalMaterial
              color="#1e3a5f"
              roughness={0.06}
              metalness={0.18}
              clearcoat={1.0}
              envMapIntensity={1.6}
            />
          </mesh>
          {/* Twin Turbine Cowling */}
          <mesh position={[0, 2.25, -0.35]} castShadow>
            <boxGeometry args={[1.05, 0.56, 2.2]} />
            <meshStandardMaterial color="#1e293b" roughness={0.38} metalness={0.62} />
          </mesh>
          {/* Tail Boom + Horizontal Stabilizer + Vertical Fin */}
          <mesh position={[0, 1.45, -2.95]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.36, 3.9, 10]} />
            <meshStandardMaterial color="#0f172a" roughness={0.28} metalness={0.52} />
          </mesh>
          <mesh position={[0, 1.48, -3.9]} castShadow>
            <boxGeometry args={[1.85, 0.08, 0.52]} />
            <meshStandardMaterial color="#d4af37" roughness={0.32} metalness={0.75} />
          </mesh>
          <mesh position={[0, 2.02, -4.65]} rotation={[-0.25, 0, 0]} castShadow>
            <boxGeometry args={[0.12, 1.35, 0.65]} />
            <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.55} />
          </mesh>

          {/* Animated Tail Rotor */}
          <group ref={tailRotorRef} position={[0.18, 2.15, -4.72]}>
            <mesh>
              <boxGeometry args={[0.05, 1.15, 0.1]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.7} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.05, 0.1, 1.15]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.7} />
            </mesh>
          </group>

          {/* Animated 4-Blade Main Rotor Assembly */}
          <group ref={mainRotorRef} position={[0, 2.75, -0.15]}>
            <mesh position={[0, -0.15, 0]}>
              <cylinderGeometry args={[0.14, 0.18, 0.4, 10]} />
              <meshStandardMaterial color="#475569" roughness={0.35} metalness={0.8} />
            </mesh>
            <mesh castShadow>
              <boxGeometry args={[8.6, 0.04, 0.24]} />
              <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.65} />
            </mesh>
            <mesh castShadow>
              <boxGeometry args={[0.24, 0.04, 8.6]} />
              <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.65} />
            </mesh>
            {/* Navigation tip markers */}
            {[4.18, -4.18].map((tip, ti) => (
              <mesh key={`tipx-${ti}`} position={[tip, 0.01, 0]}>
                <boxGeometry args={[0.24, 0.05, 0.24]} />
                <meshStandardMaterial color="#facc15" roughness={0.3} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      <InstancedGrassField tufts={gardenGrass} />

      {[
        [-19, -256],
        [19, -256],
        [-19, -276],
        [19, -276],
        [-19, -310],
        [19, -310],
      ].map(([cx, cz], i) => (
        <StylizedTree
          key={i}
          position={[cx, SIDEWALK_HEIGHT + 0.03, cz]}
          variant="cypress"
          scale={1.25}
        />
      ))}
      <ParkBench position={[-6.8, SIDEWALK_HEIGHT + 0.04, -264]} rotationY={Math.PI / 2} />
      <ParkBench position={[6.8, SIDEWALK_HEIGHT + 0.04, -264]} rotationY={-Math.PI / 2} />
    </group>
  );
});

export const VeniceCanalsAndParksRenderer: React.FC<VeniceCanalsAndParksRendererProps> = ({
  world,
  timeOfDay,
}) => {
  return (
    <group>
      {/* 4 Venice Waterways with 3D Animated Water & Mooring Posts */}
      {world.canals.map((c, idx) => (
        <VeniceCanalMesh key={c.id} canal={c} idx={idx} />
      ))}

      {/* Moored Venetian Gondolas Bobbing Gently Along Canals */}
      <VenetianGondola position={[-263, 0.04, -180]} rotationY={0.08} phase={0.2} accentColor="#9b1c1c" />
      <VenetianGondola position={[-276, 0.04, 64]} rotationY={Math.PI - 0.1} phase={1.4} accentColor="#1e3a8a" />
      <VenetianGondola position={[-263, 0.04, 290]} rotationY={0.06} phase={2.5} accentColor="#065f46" />
      <VenetianGondola position={[578, 0.04, -210]} rotationY={0.05} phase={0.9} accentColor="#9b1c1c" />
      <VenetianGondola position={[590, 0.04, 240]} rotationY={Math.PI - 0.06} phase={2.1} accentColor="#7c2d12" />
      <VenetianGondola position={[-110, 0.03, -346]} rotationY={Math.PI / 2 + 0.06} phase={1.7} accentColor="#1e3a8a" />
      <VenetianGondola position={[210, 0.03, 148]} rotationY={Math.PI / 2 - 0.08} phase={3.0} accentColor="#9b1c1c" />

      {/* 35 Road & Pedestrian Venice Canal Bridges */}
      {world.bridges.map((b) => (
        <VeniceBridgeMesh key={b.id} bridge={b} timeOfDay={timeOfDay} />
      ))}

      {/* 34 Landscaped Pocket Gardens Filling OG Villa Gaps */}
      <OgPocketGardensRenderer gardens={world.ogPocketGardens} />

      {/* Royal Crescent Gardens, Fountain & VIP Helipad Behind Sweet_thedevil Royal Estate */}
      <RoyalCrescentGarden timeOfDay={timeOfDay} />

      {/* 6 Unique Residential Neighborhood Parks with 3D Grass & Water */}
      {world.districtParks.map((park) => (
        <DistrictParkMesh key={park.id} park={park} timeOfDay={timeOfDay} />
      ))}

      {/* 10 European Covered Bus Stops */}
      {world.busStops.map((bs) => (
        <BusStopShelter
          key={bs.id}
          position={[bs.x, SIDEWALK_HEIGHT, bs.z]}
          rotationY={bs.rotY}
          timeOfDay={timeOfDay}
        />
      ))}

      {/* 85 HD Slatted Collector-Avenue Street Benches (Instanced) */}
      <InstancedStreetBenches benches={world.benches} />
    </group>
  );
};
