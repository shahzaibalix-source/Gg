import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TimeOfDay } from '../types';
import { ROAD_SURFACE_Y, SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';
import { ParkBench, ParkFountain, StylizedTree } from '../assets/FoliageAndProps';
import {
  AnimatedWaterPlane,
  BusStopShelter,
  InstancedGrassField,
  VenetianGondola,
  generateParkGrassTufts,
} from '../assets/NaturePropsAndWater';
import { ExpansionCityWorld } from './ExpansionMasterPlan';
import { DistrictParkSpec, ExpansionBridgeSpec, ExpansionCanalSpec } from './types';

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
const DistrictParkMesh: React.FC<{ park: DistrictParkSpec }> = React.memo(({ park }) => {
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
          <ParkFountain position={[0, SIDEWALK_HEIGHT + 0.06, 0]} />
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
        <group position={[0, SIDEWALK_HEIGHT + 0.07, 0]}>
          {/* Sand & Safety Turf Play Area */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <boxGeometry args={[20, 0.08, 14]} />
            <meshStandardMaterial color="#e0cb9e" roughness={0.94} />
          </mesh>
          {/* Wooden Play Tower + Roof + Slide */}
          <mesh position={[-3.5, 1.4, -1]} castShadow>
            <boxGeometry args={[2.6, 2.8, 2.6]} />
            <meshStandardMaterial color="#9c6b42" roughness={0.82} />
          </mesh>
          <mesh position={[-3.5, 3.3, -1]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[2.2, 1.3, 4]} />
            <meshStandardMaterial color="#d9483b" roughness={0.65} />
          </mesh>
          <mesh position={[-1.0, 1.0, -1]} rotation={[0, 0, -0.58]} castShadow>
            <boxGeometry args={[3.2, 0.14, 0.85]} />
            <meshStandardMaterial color="#facc15" roughness={0.35} />
          </mesh>
          {/* Twin Swing Frame */}
          <mesh position={[4.5, 1.5, 1]} castShadow>
            <boxGeometry args={[4.4, 0.16, 0.16]} />
            <meshStandardMaterial color="#6e4b30" roughness={0.82} />
          </mesh>
          {[2.5, 6.5].map((sx) => (
            <mesh key={sx} position={[sx, 0.8, 1]} castShadow>
              <cylinderGeometry args={[0.08, 0.1, 1.6, 6]} />
              <meshStandardMaterial color="#6e4b30" roughness={0.82} />
            </mesh>
          ))}
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
// Royal Crescent Gardens Behind Sweet_thedevil VIP Palace (0, -284)
// -----------------------------------------------------------------------------
const RoyalCrescentGarden: React.FC = React.memo(() => {
  const gardenGrass = useMemo(
    () =>
      generateParkGrassTufts({
        cx: 0,
        cz: -284,
        y: SIDEWALK_HEIGHT + 0.02,
        width: 48,
        depth: 64,
        count: 260,
        seed: 5511,
        excludeFn: (x, z) => Math.hypot(x, z + 284) < 12.5 || Math.abs(x) < 3.4,
      }),
    [],
  );

  return (
    <group>
      <mesh position={[0, SIDEWALK_HEIGHT / 2, -284]} receiveShadow>
        <boxGeometry args={[56, SIDEWALK_HEIGHT, 72]} />
        <meshStandardMaterial color="#d8d1c2" roughness={0.82} polygonOffset polygonOffsetFactor={1} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 0.015, -284]} receiveShadow>
        <boxGeometry args={[52, 0.03, 68]} />
        <meshStandardMaterial color="#679b4e" roughness={0.94} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 0.03, -284]} receiveShadow>
        <boxGeometry args={[4.6, 0.03, 68]} />
        <meshStandardMaterial color="#e5decb" roughness={0.85} />
      </mesh>
      <ParkFountain position={[0, SIDEWALK_HEIGHT + 0.04, -284]} />
      <InstancedGrassField tufts={gardenGrass} />

      {[
        [-16, -264],
        [16, -264],
        [-16, -304],
        [16, -304],
      ].map(([cx, cz], i) => (
        <StylizedTree
          key={i}
          position={[cx, SIDEWALK_HEIGHT + 0.03, cz]}
          variant="cypress"
          scale={1.25}
        />
      ))}
      <ParkBench position={[-7.5, SIDEWALK_HEIGHT + 0.04, -284]} rotationY={Math.PI / 2} />
      <ParkBench position={[7.5, SIDEWALK_HEIGHT + 0.04, -284]} rotationY={-Math.PI / 2} />
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

      {/* Royal Crescent Gardens Behind Sweet_thedevil Royal Estate */}
      <RoyalCrescentGarden />

      {/* 6 Unique Residential Neighborhood Parks with 3D Grass & Water */}
      {world.districtParks.map((park) => (
        <DistrictParkMesh key={park.id} park={park} />
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
