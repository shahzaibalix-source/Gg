import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CityTextureSet } from '../materials/proceduralTextures';
import {
  INITIAL_TOWN_PLOTS,
  INTERSECTIONS,
  PARKED_CARS,
  ROAD_SEGMENTS,
  ROAD_SURFACE_Y,
  ROUNDABOUT_CENTERS,
  SIDEWALK_HEIGHT,
  SIDEWALK_PADS,
  STREET_LAMPS,
} from './MasterTownBlueprint';
import { CarMesh } from '../assets/VehicleModels';
import {
  filterWithMinSpacing,
  isClearOfCorePlotsAndDriveways,
  isClearOfCoreRoadsAndInfra,
} from './TreePlacementValidator';
import { sharedTrafficSignals, updateSharedTrafficSignals } from '../simulation/trafficSignals';
import { TimeOfDay } from '../types';
import { VastCountryside } from './VastCountryside';
import {
  createHdBroadleafCrownGeo,
  createHdTrunkGeo,
} from '../materials/realisticNature';
import type { MasterCityMap } from '../planning/types';

interface RoadAndSidewalkSystemProps {
  textures: CityTextureSet;
  timeOfDay: TimeOfDay;
  masterPlan?: MasterCityMap | null;
}

const SIGNAL_GEOS = {
  pole: new THREE.CylinderGeometry(0.07, 0.09, 3.7, 8),
  box: new THREE.BoxGeometry(0.36, 0.96, 0.28),
  lamp: new THREE.SphereGeometry(0.09, 10, 10),
};

const SIGNAL_MATERIALS = {
  pole: new THREE.MeshStandardMaterial({ color: '#272c33', roughness: 0.45, metalness: 0.65 }),
  housing: new THREE.MeshStandardMaterial({ color: '#1d2126', roughness: 0.5, metalness: 0.5 }),
};

const SIGN_GEOS = {
  pole: new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6),
  yield: new THREE.ConeGeometry(0.3, 0.05, 3),
  speed: new THREE.CylinderGeometry(0.25, 0.25, 0.04, 16),
};

const SIGN_MATERIALS = {
  pole: new THREE.MeshStandardMaterial({ color: '#6e7680', roughness: 0.4, metalness: 0.6 }),
  yield: new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.45 }),
  speed: new THREE.MeshStandardMaterial({ color: '#f5f5f4', roughness: 0.45 }),
};

const TrafficSignalPost: React.FC<{
  position: [number, number, number];
  rotationY: number;
  axis: 'ns' | 'ew';
}> = ({ position, rotationY, axis }) => {
  const redRef = useRef<THREE.MeshStandardMaterial>(null);
  const amberRef = useRef<THREE.MeshStandardMaterial>(null);
  const greenRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const aspect = axis === 'ns' ? sharedTrafficSignals.nsAspect : sharedTrafficSignals.ewAspect;
    if (redRef.current) redRef.current.emissiveIntensity = aspect === 'red' ? 2.2 : 0.08;
    if (amberRef.current) amberRef.current.emissiveIntensity = aspect === 'amber' ? 2.2 : 0.08;
    if (greenRef.current) greenRef.current.emissiveIntensity = aspect === 'green' ? 2.2 : 0.08;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 1.85, 0]} geometry={SIGNAL_GEOS.pole} material={SIGNAL_MATERIALS.pole} castShadow />
      <mesh position={[0, 3.55, 0.05]} geometry={SIGNAL_GEOS.box} material={SIGNAL_MATERIALS.housing} castShadow />
      <mesh position={[0, 3.85, 0.2]} geometry={SIGNAL_GEOS.lamp}>
        <meshStandardMaterial ref={redRef} color="#ef4444" emissive="#ef4444" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 3.55, 0.2]} geometry={SIGNAL_GEOS.lamp}>
        <meshStandardMaterial ref={amberRef} color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 3.25, 0.2]} geometry={SIGNAL_GEOS.lamp}>
        <meshStandardMaterial ref={greenRef} color="#22c55e" emissive="#22c55e" emissiveIntensity={0.1} />
      </mesh>
    </group>
  );
};

const EuropeanRoadSign: React.FC<{
  position: [number, number, number];
  rotationY: number;
  variant: 'yield' | 'speed30';
}> = ({ position, rotationY, variant }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[0, 1.15, 0]} geometry={SIGN_GEOS.pole} material={SIGN_MATERIALS.pole} castShadow />
    {variant === 'yield' ? (
      <mesh
        position={[0, 2.2, 0.05]}
        rotation={[0, 0, Math.PI]}
        geometry={SIGN_GEOS.yield}
        material={SIGN_MATERIALS.yield}
      />
    ) : (
      <mesh
        position={[0, 2.2, 0.05]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={SIGN_GEOS.speed}
        material={SIGN_MATERIALS.speed}
      />
    )}
  </group>
);

const STREET_NAME_SIGNS: Array<{
  id: string;
  label: string;
  x: number;
  z: number;
  rotY: number;
}> = [
  { id: 'sn-1', label: 'Linden Blvd', x: -31.8, z: -20.2, rotY: 0 },
  { id: 'sn-2', label: 'West Grand Ave', x: -20.2, z: -31.8, rotY: Math.PI / 2 },
  { id: 'sn-3', label: 'Oakwood Way', x: 31.8, z: 20.2, rotY: Math.PI },
  { id: 'sn-4', label: 'East Grand Ave', x: 20.2, z: 31.8, rotY: -Math.PI / 2 },
  { id: 'sn-5', label: 'North Civic Blvd', x: -31.8, z: -72.2, rotY: 0 },
  { id: 'sn-6', label: 'South Expansion Way', x: 31.8, z: 72.2, rotY: Math.PI },
];

const StreetNameSign: React.FC<{
  label: string;
  position: [number, number, number];
  rotationY: number;
}> = React.memo(({ label, position, rotationY }) => {
  const tex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 33, 228);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [label]);

  useEffect(() => () => tex.dispose(), [tex]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 1.3, 0]} material={SIGN_MATERIALS.pole} castShadow>
        <cylinderGeometry args={[0.035, 0.04, 2.6, 6]} />
      </mesh>
      <mesh position={[0, 2.45, 0]}>
        <boxGeometry args={[1.12, 0.3, 0.06]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.45} />
      </mesh>
      <mesh position={[0, 2.45, 0.035]}>
        <planeGeometry args={[1.08, 0.26]} />
        <meshStandardMaterial map={tex} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.45, -0.035]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.08, 0.26]} />
        <meshStandardMaterial map={tex} roughness={0.4} />
      </mesh>
    </group>
  );
});

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export const RoadAndSidewalkSystem: React.FC<RoadAndSidewalkSystemProps> = ({
  textures,
  timeOfDay,
  masterPlan,
}) => {
  const activeRoads = masterPlan?.roads ?? ROAD_SEGMENTS;
  const activeIntersections = masterPlan?.intersections ?? INTERSECTIONS;
  const activeSidewalks = masterPlan?.sidewalks ?? SIDEWALK_PADS;
  const activeLamps = masterPlan?.streetLamps ?? STREET_LAMPS;
  const activePlots = masterPlan?.plots ?? INITIAL_TOWN_PLOTS;

  const dashMeshRef = useRef<THREE.InstancedMesh>(null);
  const crosswalkMeshRef = useRef<THREE.InstancedMesh>(null);
  const manholeMeshRef = useRef<THREE.InstancedMesh>(null);
  const grateMeshRef = useRef<THREE.InstancedMesh>(null);
  const bushMeshRef = useRef<THREE.InstancedMesh>(null);
  const treePitMeshRef = useRef<THREE.InstancedMesh>(null);

  useFrame((state) => {
    updateSharedTrafficSignals(state.clock.elapsedTime);
  });

  // Shared road marking materials
  const roadEdgeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d8d6cf',
        roughness: 0.75,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [],
  );
  const yellowLineMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e5b84b',
        roughness: 0.68,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  );
  const whiteMarkingMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f2efe7',
        roughness: 0.7,
        polygonOffset: true,
        polygonOffsetFactor: -3,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      roadEdgeMat.dispose();
      yellowLineMat.dispose();
      whiteMarkingMat.dispose();
    };
  }, [roadEdgeMat, yellowLineMat, whiteMarkingMat]);

  // Precompute all dashed center-line transforms (1 InstancedMesh instead of ~150 meshes)
  const dashTransforms = useMemo(() => {
    const list: Array<{ x: number; y: number; z: number; rotY: number }> = [];
    for (const seg of activeRoads) {
      if (seg.hasDoubleCenterLine) continue;
      const dx = seg.end.x - seg.start.x;
      const dz = seg.end.z - seg.start.z;
      const length = Math.hypot(dx, dz);
      const cx = (seg.start.x + seg.end.x) / 2;
      const cz = (seg.start.z + seg.end.z) / 2;
      const angle = Math.atan2(dx, dz);
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const dashCount = Math.max(1, Math.floor(length / 4.5));

      for (let idx = 0; idx < dashCount; idx++) {
        const zLocal = -length / 2 + 2.25 + idx * 4.5;
        if (Math.abs(zLocal) > length / 2 - 1.2) continue;
        list.push({
          x: cx + sin * zLocal,
          y: ROAD_SURFACE_Y + 0.007,
          z: cz + cos * zLocal,
          rotY: angle,
        });
      }
    }
    return list;
  }, [activeRoads]);

  // Precompute all crosswalk stripe & stop-bar transforms (1 InstancedMesh)
  const crosswalkTransforms = useMemo(() => {
    const list: Array<{ x: number; y: number; z: number; rotY: number; sx: number; sz: number }> = [];
    const stripeOffsets = [-2.6, -1.56, -0.52, 0.52, 1.56, 2.6];

    for (const inter of activeIntersections) {
      const halfW = inter.width / 2;
      const halfD = inter.depth / 2;
      for (const dir of inter.crosswalks) {
        const isNS = dir === 'north' || dir === 'south';
        const sign = dir === 'south' || dir === 'east' ? 1 : -1;
        const offset = (isNS ? halfD : halfW) + 1.45;
        const rotY = isNS ? 0 : Math.PI / 2;
        const sin = Math.sin(rotY);
        const cos = Math.cos(rotY);

        const groupX = inter.center.x + (isNS ? 0 : sign * offset);
        const groupZ = inter.center.z + (isNS ? sign * offset : 0);

        for (const sxLocal of stripeOffsets) {
          list.push({
            x: groupX + cos * sxLocal,
            y: ROAD_SURFACE_Y + 0.008,
            z: groupZ - sin * sxLocal,
            rotY,
            sx: 0.52,
            sz: 2.2,
          });
        }

        // Stop bar on right-hand approach
        const sbX = sign * -2.25;
        const sbZ = sign * 1.5;
        list.push({
          x: groupX + cos * sbX + sin * sbZ,
          y: ROAD_SURFACE_Y + 0.008,
          z: groupZ - sin * sbX + cos * sbZ,
          rotY,
          sx: 3.6,
          sz: 0.24,
        });
      }
    }
    return list;
  }, [activeIntersections]);

  useEffect(() => {
    const mesh = dashMeshRef.current;
    if (!mesh) return;
    for (let i = 0; i < dashTransforms.length; i++) {
      const t = dashTransforms[i];
      _dummy.position.set(t.x, t.y, t.z);
      _dummy.rotation.set(0, t.rotY, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dashTransforms]);

  useEffect(() => {
    const mesh = crosswalkMeshRef.current;
    if (!mesh) return;
    for (let i = 0; i < crosswalkTransforms.length; i++) {
      const t = crosswalkTransforms[i];
      _dummy.position.set(t.x, t.y, t.z);
      _dummy.rotation.set(0, t.rotY, 0);
      _dummy.scale.set(t.sx, 1, t.sz);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [crosswalkTransforms]);

  // Road-aligned green-belt & sidewalk trees (uses MasterCityMap validated trees when available)
  const { perimeterTrees, roadsideBushes, manholeTransforms, grateTransforms } = useMemo(() => {
    if (masterPlan) {
      const trees = masterPlan.roadsideTrees.map((t) => ({
        x: t.x,
        z: t.z,
        scale: t.scale,
        variant: t.variant,
        rot: t.rotationY,
        hasPit: t.hasPit,
      }));
      const manholes: Array<{ x: number; z: number }> = [];
      const grates: Array<{ x: number; z: number; rotY: number }> = [];
      for (const seg of activeRoads) {
        const dx = seg.end.x - seg.start.x;
        const dz = seg.end.z - seg.start.z;
        const len = Math.hypot(dx, dz);
        if (len < 12) continue;
        const cx = (seg.start.x + seg.end.x) / 2;
        const cz = (seg.start.z + seg.end.z) / 2;
        const isEW = Math.abs(dx) >= Math.abs(dz);
        const laneOffset = seg.width * 0.22;
        const gutterOffset = seg.width / 2 - 0.55;
        manholes.push({
          x: cx + (isEW ? 0 : laneOffset),
          z: cz + (isEW ? laneOffset : 0),
        });
        for (const side of [-1, 1]) {
          const edgeDist = Math.min(len * 0.34, 14);
          grates.push({
            x: cx + (isEW ? side * edgeDist : side * gutterOffset),
            z: cz + (isEW ? side * gutterOffset : side * edgeDist),
            rotY: isEW ? 0 : Math.PI / 2,
          });
        }
      }
      return {
        perimeterTrees: trees,
        roadsideBushes: masterPlan.roadsideBushes,
        manholeTransforms: manholes,
        grateTransforms: grates,
      };
    }

    const rawTrees: Array<{
      x: number;
      z: number;
      scale: number;
      variant: 'broadleaf' | 'cypress' | 'ornamental';
      rot: number;
      hasPit: boolean;
    }> = [];
    const bushes: Array<{ x: number; z: number; sx: number; sy: number; sz: number; tint: string }> = [];

    for (const zLine of [-106, -94, 94, 108]) {
      for (let x = -114; x <= 114; x += 14) {
        if (zLine < -85 && Math.abs(x) < 42) continue;
        if (!isClearOfCoreRoadsAndInfra(x, zLine, 2.35, 4.4)) continue;
        if (!isClearOfCorePlotsAndDriveways(x, zLine, activePlots, 1.5)) continue;

        const idx = rawTrees.length;
        const variant = idx % 5 === 0 ? 'cypress' : idx % 3 === 0 ? 'ornamental' : 'broadleaf';
        rawTrees.push({
          x,
          z: zLine,
          scale: 1.05 + (idx % 4) * 0.1,
          variant,
          rot: (idx * 1.1) % (Math.PI * 2),
          hasPit: false,
        });

        const bx = x + 3.2;
        if (
          isClearOfCoreRoadsAndInfra(bx, zLine, 1.9, 4.0) &&
          isClearOfCorePlotsAndDriveways(bx, zLine, activePlots, 1.2)
        ) {
          bushes.push({
            x: bx,
            z: zLine,
            sx: 1.25,
            sy: 0.65,
            sz: 1.05,
            tint: idx % 2 === 0 ? '#4d7c43' : '#5e8f4d',
          });
        }
      }
    }

    for (const xLine of [-118, 118]) {
      for (let z = -70; z <= 70; z += 14) {
        if (!isClearOfCoreRoadsAndInfra(xLine, z, 2.35, 4.4)) continue;
        if (!isClearOfCorePlotsAndDriveways(xLine, z, activePlots, 1.5)) continue;

        const idx = rawTrees.length;
        const variant = idx % 4 === 0 ? 'cypress' : idx % 2 === 0 ? 'broadleaf' : 'ornamental';
        rawTrees.push({
          x: xLine,
          z,
          scale: 1.02 + (idx % 3) * 0.12,
          variant,
          rot: (idx * 0.85) % (Math.PI * 2),
          hasPit: false,
        });

        const bz = z + 3.2;
        if (
          isClearOfCoreRoadsAndInfra(xLine, bz, 1.9, 4.0) &&
          isClearOfCorePlotsAndDriveways(xLine, bz, activePlots, 1.2)
        ) {
          bushes.push({
            x: xLine,
            z: bz,
            sx: 1.1,
            sy: 0.62,
            sz: 1.25,
            tint: idx % 2 === 0 ? '#44703c' : '#598a4a',
          });
        }
      }
    }

    const sidewalkSpots: Array<[number, number, 'broadleaf' | 'cypress' | 'ornamental']> = [
      [-72.0, -52, 'ornamental'],
      [-72.0, 52, 'broadleaf'],
      [-52, -72.0, 'ornamental'],
      [52, -72.0, 'broadleaf'],
      [-52, 72.0, 'ornamental'],
      [52, 72.0, 'broadleaf'],
      [72.0, 52, 'ornamental'],
      [32.2, -52, 'cypress'],
      [32.2, 52, 'ornamental'],
      [-32.2, -52, 'cypress'],
      [-32.2, 52, 'ornamental'],
    ];
    for (const [sx, sz, variant] of sidewalkSpots) {
      if (!isClearOfCoreRoadsAndInfra(sx, sz, 1.35, 3.8)) continue;
      if (!isClearOfCorePlotsAndDriveways(sx, sz, activePlots, 0.25)) continue;
      rawTrees.push({
        x: sx,
        z: sz,
        scale: 0.88,
        variant,
        rot: rawTrees.length * 0.7,
        hasPit: true,
      });
    }

    const trees = filterWithMinSpacing(rawTrees, 4.5);

    const manholes: Array<{ x: number; z: number }> = [];
    const grates: Array<{ x: number; z: number; rotY: number }> = [];
    for (const seg of activeRoads) {
      const dx = seg.end.x - seg.start.x;
      const dz = seg.end.z - seg.start.z;
      const len = Math.hypot(dx, dz);
      if (len < 12) continue;
      const cx = (seg.start.x + seg.end.x) / 2;
      const cz = (seg.start.z + seg.end.z) / 2;
      const isEW = Math.abs(dx) >= Math.abs(dz);
      const laneOffset = seg.width * 0.22;
      const gutterOffset = seg.width / 2 - 0.55;
      manholes.push({
        x: cx + (isEW ? 0 : laneOffset),
        z: cz + (isEW ? laneOffset : 0),
      });
      for (const side of [-1, 1]) {
        const edgeDist = Math.min(len * 0.34, 14);
        grates.push({
          x: cx + (isEW ? side * edgeDist : side * gutterOffset),
          z: cz + (isEW ? side * gutterOffset : side * edgeDist),
          rotY: isEW ? 0 : Math.PI / 2,
        });
      }
    }

    return {
      perimeterTrees: trees,
      roadsideBushes: bushes,
      manholeTransforms: manholes,
      grateTransforms: grates,
    };
  }, [masterPlan, activeRoads, activePlots]);

  const hdTreeGeos = useMemo(
    () => ({
      trunk: createHdTrunkGeo(),
      crown: createHdBroadleafCrownGeo(),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      hdTreeGeos.trunk.dispose();
      hdTreeGeos.crown.dispose();
    };
  }, [hdTreeGeos]);

  const treePitSpots = useMemo(
    () => perimeterTrees.filter((t) => t.hasPit),
    [perimeterTrees],
  );

  const lampPoleMeshRef = useRef<THREE.InstancedMesh>(null);
  const lampCapMeshRef = useRef<THREE.InstancedMesh>(null);
  const lampGlobeMeshRef = useRef<THREE.InstancedMesh>(null);
  const lampLightPoolRef = useRef<THREE.InstancedMesh>(null);
  const treeTrunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const treeCanopyMeshRef = useRef<THREE.InstancedMesh>(null);

  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';

  useEffect(() => {
    if (lampPoleMeshRef.current && lampCapMeshRef.current && lampGlobeMeshRef.current) {
      activeLamps.forEach((lamp, i) => {
        _dummy.position.set(lamp.x, SIDEWALK_HEIGHT + 1.9, lamp.z);
        _dummy.rotation.set(0, lamp.rotationY, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        lampPoleMeshRef.current!.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(lamp.x, SIDEWALK_HEIGHT + 4.05, lamp.z);
        _dummy.updateMatrix();
        lampCapMeshRef.current!.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(lamp.x, SIDEWALK_HEIGHT + 3.85, lamp.z);
        _dummy.updateMatrix();
        lampGlobeMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      lampPoleMeshRef.current.instanceMatrix.needsUpdate = true;
      lampCapMeshRef.current.instanceMatrix.needsUpdate = true;
      lampGlobeMeshRef.current.instanceMatrix.needsUpdate = true;
      lampPoleMeshRef.current.computeBoundingSphere();
      lampCapMeshRef.current.computeBoundingSphere();
      lampGlobeMeshRef.current.computeBoundingSphere();
    }

    if (lampLightPoolRef.current) {
      activeLamps.forEach((lamp, i) => {
        _dummy.position.set(lamp.x, SIDEWALK_HEIGHT + 0.025, lamp.z);
        _dummy.rotation.set(-Math.PI / 2, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        lampLightPoolRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      lampLightPoolRef.current.instanceMatrix.needsUpdate = true;
      lampLightPoolRef.current.computeBoundingSphere();
    }
  }, [isEvening, activeLamps]);

  useEffect(() => {
    if (treeTrunkMeshRef.current && treeCanopyMeshRef.current) {
      perimeterTrees.forEach((tree, i) => {
        const s = tree.scale;
        const baseY = tree.hasPit ? SIDEWALK_HEIGHT : 0;
        _dummy.position.set(tree.x, baseY + 1.1 * s, tree.z);
        _dummy.rotation.set(0, tree.rot, 0);
        _dummy.scale.set(s, s, s);
        _dummy.updateMatrix();
        treeTrunkMeshRef.current!.setMatrixAt(i, _dummy.matrix);

        const canopyScaleY = tree.variant === 'cypress' ? s * 1.48 : s * 1.02;
        const canopyScaleXZ = tree.variant === 'cypress' ? s * 0.62 : s;
        _dummy.position.set(tree.x, baseY + 2.85 * s, tree.z);
        _dummy.rotation.set(0, tree.rot, 0);
        _dummy.scale.set(canopyScaleXZ, canopyScaleY, canopyScaleXZ);
        _dummy.updateMatrix();
        treeCanopyMeshRef.current!.setMatrixAt(i, _dummy.matrix);

        _color.set(
          tree.variant === 'cypress'
            ? '#386339'
            : tree.variant === 'ornamental'
              ? '#6aa056'
              : '#4a8042',
        );
        treeCanopyMeshRef.current!.setColorAt(i, _color);
      });
      treeTrunkMeshRef.current.instanceMatrix.needsUpdate = true;
      treeCanopyMeshRef.current.instanceMatrix.needsUpdate = true;
      if (treeCanopyMeshRef.current.instanceColor) {
        treeCanopyMeshRef.current.instanceColor.needsUpdate = true;
      }
      treeTrunkMeshRef.current.computeBoundingSphere();
      treeCanopyMeshRef.current.computeBoundingSphere();
    }

    if (treePitMeshRef.current) {
      treePitSpots.forEach((t, i) => {
        _dummy.position.set(t.x, SIDEWALK_HEIGHT + 0.03, t.z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        treePitMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      treePitMeshRef.current.instanceMatrix.needsUpdate = true;
      treePitMeshRef.current.computeBoundingSphere();
    }

    if (bushMeshRef.current) {
      roadsideBushes.forEach((b, i) => {
        _dummy.position.set(b.x, b.sy * 0.48, b.z);
        _dummy.rotation.set(0, i * 0.9, 0);
        _dummy.scale.set(b.sx, b.sy, b.sz);
        _dummy.updateMatrix();
        bushMeshRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(b.tint);
        bushMeshRef.current!.setColorAt(i, _color);
      });
      bushMeshRef.current.instanceMatrix.needsUpdate = true;
      if (bushMeshRef.current.instanceColor) bushMeshRef.current.instanceColor.needsUpdate = true;
      bushMeshRef.current.computeBoundingSphere();
    }

    if (manholeMeshRef.current) {
      manholeTransforms.forEach((m, i) => {
        _dummy.position.set(m.x, ROAD_SURFACE_Y + 0.008, m.z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        manholeMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      manholeMeshRef.current.instanceMatrix.needsUpdate = true;
      manholeMeshRef.current.computeBoundingSphere();
    }

    if (grateMeshRef.current) {
      grateTransforms.forEach((g, i) => {
        _dummy.position.set(g.x, ROAD_SURFACE_Y + 0.008, g.z);
        _dummy.rotation.set(0, g.rotY, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        grateMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      grateMeshRef.current.instanceMatrix.needsUpdate = true;
      grateMeshRef.current.computeBoundingSphere();
    }
  }, [perimeterTrees, treePitSpots, roadsideBushes, manholeTransforms, grateTransforms]);

  return (
    <group>
      {/* Town Meadow Ground + Vast Rolling Open Countryside */}
      <VastCountryside textures={textures} />

      {/* Road Segments with Double Center Lines & Edge Markings (NS/EW Y-staggered to avoid Z-fighting) */}
      {activeRoads.map((seg) => {
        const dx = seg.end.x - seg.start.x;
        const dz = seg.end.z - seg.start.z;
        const length = Math.hypot(dx, dz);
        const cx = (seg.start.x + seg.end.x) / 2;
        const cz = (seg.start.z + seg.end.z) / 2;
        const angle = Math.atan2(dx, dz);
        const isEW = Math.abs(dx) >= Math.abs(dz);
        const roadYOffset = isEW ? -0.003 : 0;

        return (
          <group key={seg.id} position={[cx, 0, cz]} rotation={[0, angle, 0]}>
            <mesh position={[0, ROAD_SURFACE_Y / 2 + roadYOffset, 0]} receiveShadow>
              <boxGeometry args={[seg.width, ROAD_SURFACE_Y, length]} />
              <meshStandardMaterial
                map={textures.asphalt}
                color={seg.isStubExtension ? '#414750' : '#363b43'}
                roughness={0.84}
                metalness={0.04}
                polygonOffset
                polygonOffsetFactor={isEW ? 1 : 0}
              />
            </mesh>

            {/* Outer Edge Road Lines */}
            <mesh position={[-seg.width / 2 + 0.25, ROAD_SURFACE_Y + 0.008, 0]} material={roadEdgeMat}>
              <boxGeometry args={[0.1, 0.005, length - 0.3]} />
            </mesh>
            <mesh position={[seg.width / 2 - 0.25, ROAD_SURFACE_Y + 0.008, 0]} material={roadEdgeMat}>
              <boxGeometry args={[0.1, 0.005, length - 0.3]} />
            </mesh>

            {/* Double Center Lines on Main Boulevards */}
            {seg.hasDoubleCenterLine && (
              <>
                <mesh position={[-0.14, ROAD_SURFACE_Y + 0.009, 0]} material={yellowLineMat}>
                  <boxGeometry args={[0.11, 0.005, length - 0.6]} />
                </mesh>
                <mesh position={[0.14, ROAD_SURFACE_Y + 0.009, 0]} material={yellowLineMat}>
                  <boxGeometry args={[0.11, 0.005, length - 0.6]} />
                </mesh>
              </>
            )}
          </group>
        );
      })}

      {/* Instanced Center Dashed Road Markings */}
      <instancedMesh
        key={`dashes-${dashTransforms.length}`}
        ref={dashMeshRef}
        args={[undefined, undefined, Math.max(1, dashTransforms.length)]}
        material={whiteMarkingMat}
      >
        <boxGeometry args={[0.12, 0.005, 1.9]} />
      </instancedMesh>

      {/* Instanced Zebra Crosswalks & Stop Bars */}
      <instancedMesh
        key={`crosswalks-${crosswalkTransforms.length}`}
        ref={crosswalkMeshRef}
        args={[undefined, undefined, Math.max(1, crosswalkTransforms.length)]}
        material={whiteMarkingMat}
      >
        <boxGeometry args={[1, 0.005, 1]} />
      </instancedMesh>

      {/* Intersections & Working Traffic Signals */}
      {activeIntersections.map((inter) => {
        const halfW = inter.width / 2;
        const halfD = inter.depth / 2;
        return (
          <group key={inter.id} position={[inter.center.x, 0, inter.center.z]}>
            <mesh position={[0, ROAD_SURFACE_Y / 2 + 0.003, 0]} receiveShadow>
              <boxGeometry args={[inter.width, ROAD_SURFACE_Y, inter.depth]} />
              <meshStandardMaterial
                map={textures.asphalt}
                color="#353a42"
                roughness={0.84}
                metalness={0.04}
                polygonOffset
                polygonOffsetFactor={-1}
              />
            </mesh>

            {inter.hasTrafficSignal && (
              <>
                <TrafficSignalPost
                  position={[-halfW - 0.85, SIDEWALK_HEIGHT, -halfD - 0.85]}
                  rotationY={0}
                  axis="ns"
                />
                <TrafficSignalPost
                  position={[halfW + 0.85, SIDEWALK_HEIGHT, halfD + 0.85]}
                  rotationY={Math.PI}
                  axis="ns"
                />
                <TrafficSignalPost
                  position={[halfW + 0.85, SIDEWALK_HEIGHT, -halfD - 0.85]}
                  rotationY={-Math.PI / 2}
                  axis="ew"
                />
                <TrafficSignalPost
                  position={[-halfW - 0.85, SIDEWALK_HEIGHT, halfD + 0.85]}
                  rotationY={Math.PI / 2}
                  axis="ew"
                />
              </>
            )}
          </group>
        );
      })}

      {/* Grand Avenue Landscaped Roundabouts at (-26, 0) & (26, 0) */}
      {ROUNDABOUT_CENTERS.map((rb) => (
        <group key={rb.id} position={[rb.x, 0, rb.z]}>
          {/* Outer Circular Asphalt Apron sits cleanly above passing road markings */}
          <mesh position={[0, ROAD_SURFACE_Y + 0.015, 0]} receiveShadow>
            <cylinderGeometry args={[7.4, 7.4, 0.022, 32]} />
            <meshStandardMaterial
              map={textures.asphalt}
              color="#363b43"
              roughness={0.84}
              polygonOffset
              polygonOffsetFactor={-4}
            />
          </mesh>
          {/* Cobblestone Curbed Ring */}
          <mesh position={[0, ROAD_SURFACE_Y + 0.052, 0]} receiveShadow>
            <cylinderGeometry args={[3.55, 3.65, 0.08, 24]} />
            <meshStandardMaterial map={textures.cobblestone} color="#c5bdb0" roughness={0.85} />
          </mesh>
          {/* Central Green Flower Island (low ornamental shrubs & flowerbed ring, zero obstructing trees) */}
          <mesh position={[0, ROAD_SURFACE_Y + 0.15, 0]} receiveShadow>
            <cylinderGeometry args={[2.55, 2.75, 0.22, 20]} />
            <meshStandardMaterial map={textures.grass} color="#588746" roughness={0.9} />
          </mesh>
          <mesh position={[0, ROAD_SURFACE_Y + 0.34, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.35, 1.5, 0.2, 16]} />
            <meshStandardMaterial color="#b9b0a0" roughness={0.82} />
          </mesh>
          <mesh position={[0, ROAD_SURFACE_Y + 0.48, 0]} castShadow>
            <cylinderGeometry args={[0.92, 1.02, 0.14, 16]} />
            <meshStandardMaterial color="#e11d48" roughness={0.76} />
          </mesh>
          <mesh position={[0, ROAD_SURFACE_Y + 0.68, 0]} castShadow>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#3b6e39" roughness={0.86} />
          </mesh>
          <EuropeanRoadSign position={[-6.4, SIDEWALK_HEIGHT, -6.2]} rotationY={0} variant="yield" />
          <EuropeanRoadSign position={[6.4, SIDEWALK_HEIGHT, 6.2]} rotationY={Math.PI} variant="yield" />
        </group>
      ))}

      {/* Speed, District & Street Name Signs */}
      <EuropeanRoadSign position={[-32.0, SIDEWALK_HEIGHT, -32.0]} rotationY={0} variant="speed30" />
      <EuropeanRoadSign position={[32.0, SIDEWALK_HEIGHT, 32.0]} rotationY={Math.PI} variant="speed30" />
      {STREET_NAME_SIGNS.map((sn) => (
        <StreetNameSign
          key={sn.id}
          label={sn.label}
          position={[sn.x, SIDEWALK_HEIGHT, sn.z]}
          rotationY={sn.rotY}
        />
      ))}

      {/* Instanced Cast-Iron Manhole Covers & Storm Drainage Grates */}
      {manholeTransforms.length > 0 && (
        <instancedMesh
          key={`manholes-${manholeTransforms.length}`}
          ref={manholeMeshRef}
          args={[undefined, undefined, manholeTransforms.length]}
        >
          <cylinderGeometry args={[0.38, 0.38, 0.014, 14]} />
          <meshStandardMaterial color="#4a5058" roughness={0.55} metalness={0.62} />
        </instancedMesh>
      )}
      {grateTransforms.length > 0 && (
        <instancedMesh
          key={`grates-${grateTransforms.length}`}
          ref={grateMeshRef}
          args={[undefined, undefined, grateTransforms.length]}
        >
          <boxGeometry args={[0.72, 0.014, 0.42]} />
          <meshStandardMaterial color="#2b3036" roughness={0.5} metalness={0.68} />
        </instancedMesh>
      )}

      {/* Raised Granite Sidewalks */}
      {activeSidewalks.map((pad) => (
        <mesh
          key={pad.id}
          position={[pad.x, SIDEWALK_HEIGHT / 2, pad.z]}
          receiveShadow
        >
          <boxGeometry args={[pad.width, SIDEWALK_HEIGHT, pad.depth]} />
          <meshStandardMaterial
            map={textures.sidewalkStone}
            color="#d8d2c6"
            roughness={0.84}
            metalness={0.02}
          />
        </mesh>
      ))}

      {/* Sidewalk Tree Pit Borders */}
      {treePitSpots.length > 0 && (
        <instancedMesh
          key={`pits-${treePitSpots.length}`}
          ref={treePitMeshRef}
          args={[undefined, undefined, treePitSpots.length]}
          receiveShadow
        >
          <boxGeometry args={[1.65, 0.06, 1.65]} />
          <meshStandardMaterial color="#5c4c3a" roughness={0.92} />
        </instancedMesh>
      )}

      {/* Instanced Core European Streetlamps */}
      <instancedMesh
        key={`lpoles-${activeLamps.length}`}
        ref={lampPoleMeshRef}
        args={[undefined, undefined, Math.max(1, activeLamps.length)]}
        castShadow
      >
        <cylinderGeometry args={[0.06, 0.095, 3.8, 7]} />
        <meshStandardMaterial color="#252930" roughness={0.45} metalness={0.68} />
      </instancedMesh>
      <instancedMesh
        key={`lcaps-${activeLamps.length}`}
        ref={lampCapMeshRef}
        args={[undefined, undefined, Math.max(1, activeLamps.length)]}
      >
        <coneGeometry args={[0.26, 0.22, 6]} />
        <meshStandardMaterial color="#1f2329" roughness={0.48} metalness={0.6} />
      </instancedMesh>
      <instancedMesh
        key={`lglobes-${activeLamps.length}`}
        ref={lampGlobeMeshRef}
        args={[undefined, undefined, Math.max(1, activeLamps.length)]}
      >
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial
          color={isEvening ? '#ffeab5' : '#ece7dc'}
          emissive={isEvening ? '#ffaa33' : '#000000'}
          emissiveIntensity={isEvening ? 2.4 : 0}
          roughness={0.25}
        />
      </instancedMesh>
      {isEvening && (
        <instancedMesh
          key={`lpools-${activeLamps.length}`}
          ref={lampLightPoolRef}
          args={[undefined, undefined, Math.max(1, activeLamps.length)]}
        >
          <circleGeometry args={[3.4, 14]} />
          <meshBasicMaterial
            color="#ffcf78"
            transparent
            opacity={0.14}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </instancedMesh>
      )}

      {/* Dedicated Parked Cars in Commercial, Civic & Stadium Parking Bays */}
      {PARKED_CARS.map((car) => (
        <group key={car.id} position={[car.x, SIDEWALK_HEIGHT, car.z]} rotation={[0, car.rotY, 0]}>
          <CarMesh color={car.color} style={car.style} timeOfDay={timeOfDay} />
        </group>
      ))}

      {/* Instanced Road-Aligned Green Belt & Sidewalk Trees */}
      <instancedMesh
        key={`ttrunk-${perimeterTrees.length}`}
        ref={treeTrunkMeshRef}
        args={[hdTreeGeos.trunk, undefined, Math.max(1, perimeterTrees.length)]}
      >
        <meshStandardMaterial color="#5d432e" roughness={0.93} />
      </instancedMesh>
      <instancedMesh
        key={`tcanopy-${perimeterTrees.length}`}
        ref={treeCanopyMeshRef}
        args={[hdTreeGeos.crown, undefined, Math.max(1, perimeterTrees.length)]}
        receiveShadow
      >
        <meshStandardMaterial color="#ffffff" roughness={0.86} />
      </instancedMesh>
      {roadsideBushes.length > 0 && (
        <instancedMesh
          key={`bushes-${roadsideBushes.length}`}
          ref={bushMeshRef}
          args={[undefined, undefined, roadsideBushes.length]}
          receiveShadow
        >
          <dodecahedronGeometry args={[0.75, 0]} />
          <meshStandardMaterial color="#ffffff" roughness={0.88} />
        </instancedMesh>
      )}
    </group>
  );
};
