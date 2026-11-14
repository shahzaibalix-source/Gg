import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CityTextureSet } from '../materials/proceduralTextures';
import { HouseModel } from '../assets/HouseModel';
import { PlotNameplateSign } from '../assets/FoliageAndProps';
import { CarMesh } from '../assets/VehicleModels';
import { ROAD_SURFACE_Y, SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';
import { CameraMode, TimeOfDay } from '../types';
import { ExpansionCityWorld, queryNearbyExpansionPlots } from './ExpansionMasterPlan';
import { ExpansionPlotSpec } from './types';
import { SweetTheDevilPalace } from './SweetTheDevilPalace';
import { OGMonumentWall } from './OGMonumentWall';
import { BotanicalAndWaterfront } from './BotanicalAndWaterfront';
import { VeniceCanalsAndParksRenderer } from './VeniceCanalsAndParksRenderer';
import { PlayerPoseState } from '../player/WalkingPlayerController';
import {
  filterWithMinSpacing,
  isClearOfExpansionInfra,
  isExpansionPlotTreeSafe,
} from '../world/TreePlacementValidator';
import {
  createHdBroadleafCrownGeo,
  createHdTrunkGeo,
} from '../materials/realisticNature';
import {
  INSTANCED_BAY_UNIT_LEN,
  createUnitFenceBayGeometries,
  getFenceStyleForArchetype,
} from '../assets/ResidentialFence';

interface ExpandedCityRendererProps {
  world: ExpansionCityWorld;
  textures: CityTextureSet;
  timeOfDay: TimeOfDay;
  cameraMode: CameraMode;
  playerPoseRef: React.MutableRefObject<PlayerPoseState>;
  selectedExpansionPlotId: string | null;
  openDoors: Record<string, boolean>;
  onSelectExpansionPlot: (plot: ExpansionPlotSpec) => void;
  onOpenMonumentModal: () => void;
}

const SECTOR_SIZE = 420;
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _focusWorld = new THREE.Vector3();

function getSectorKey(x: number, z: number): string {
  const sx = Math.floor((x + 840) / SECTOR_SIZE);
  const sz = Math.floor((z + 680) / SECTOR_SIZE);
  return `${sx},${sz}`;
}

function getHouseOrigin(plot: ExpansionPlotSpec): { hx: number; hz: number; doorZ: number } {
  const sin = Math.sin(plot.facingAngle);
  const cos = Math.cos(plot.facingAngle);
  const localX = plot.houseStyle?.hasGarageCarport && plot.status !== 'og' ? -0.9 : 0;
  const localZ = -1.1;
  const doorLocalZ = plot.depth / 2 - 0.95;
  return {
    hx: plot.x + localX * cos + localZ * sin,
    hz: plot.z - localX * sin + localZ * cos,
    doorZ: doorLocalZ,
  };
}

interface FenceTransformSpec {
  x: number;
  y: number;
  z: number;
  rotY: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
}

interface SectorBucket {
  key: string;
  sidewalks: Array<{ id: string; x: number; z: number; width: number; depth: number }>;
  lamps: Array<{ id: string; x: number; z: number; rotY: number }>;
  plots: ExpansionPlotSpec[];
  housePlots: ExpansionPlotSpec[];
  pitchedRoofPlots: ExpansionPlotSpec[];
  flatRoofPlots: ExpansionPlotSpec[];
  chimneyPlots: ExpansionPlotSpec[];
  balconyPlots: ExpansionPlotSpec[];
  poolPlots: ExpansionPlotSpec[];
  treesData: Array<{ x: number; z: number; scale: number; tint: string }>;
  houseIdxById: Map<string, number>;
  pitchedIdxById: Map<string, number>;
  flatIdxById: Map<string, number>;
}

interface SharedSectorResources {
  unitBoxGeo: THREE.BoxGeometry;
  sidewalkBoxGeo: THREE.BoxGeometry;
  padBoxGeo: THREE.BoxGeometry;
  lampPoleGeo: THREE.CylinderGeometry;
  lampGlobeGeo: THREE.SphereGeometry;
  pitchedRoofGeo: THREE.ConeGeometry;
  signBoardGeo: THREE.BoxGeometry;
  trunkGeo: THREE.BufferGeometry;
  canopyGeo: THREE.BufferGeometry;
  fenceHeritageBayGeo: THREE.BufferGeometry;
  fenceModernBayGeo: THREE.BufferGeometry;
  fenceTimberBayGeo: THREE.BufferGeometry;
  sidewalkMat: THREE.MeshStandardMaterial;
  lampPoleMat: THREE.MeshStandardMaterial;
  padMat: THREE.MeshStandardMaterial;
  drivewayMat: THREE.MeshStandardMaterial;
  curbMat: THREE.MeshStandardMaterial;
  fencePlinthMat: THREE.MeshStandardMaterial;
  fenceBayMat: THREE.MeshStandardMaterial;
  fencePillarMat: THREE.MeshStandardMaterial;
  wallMat: THREE.MeshStandardMaterial;
  pitchedRoofMat: THREE.MeshStandardMaterial;
  flatRoofMat: THREE.MeshStandardMaterial;
  trimMat: THREE.MeshStandardMaterial;
  chimneyMat: THREE.MeshStandardMaterial;
  balconyMat: THREE.MeshStandardMaterial;
  poolMat: THREE.MeshStandardMaterial;
  signPostMat: THREE.MeshStandardMaterial;
  trunkMat: THREE.MeshStandardMaterial;
  canopyMat: THREE.MeshStandardMaterial;
}

const ExpansionSectorChunk: React.FC<{
  sector: SectorBucket;
  res: SharedSectorResources;
  lampGlobeMat: THREE.MeshStandardMaterial;
  detailedPlots: ExpansionPlotSpec[];
  onSelectExpansionPlot: (plot: ExpansionPlotSpec) => void;
}> = React.memo(({ sector, res, lampGlobeMat, detailedPlots, onSelectExpansionPlot }) => {
  const sidewalkMeshRef = useRef<THREE.InstancedMesh>(null);
  const lampPoleMeshRef = useRef<THREE.InstancedMesh>(null);
  const lampGlobeMeshRef = useRef<THREE.InstancedMesh>(null);
  const padMeshRef = useRef<THREE.InstancedMesh>(null);
  const drivewayMeshRef = useRef<THREE.InstancedMesh>(null);
  const curbMeshRef = useRef<THREE.InstancedMesh>(null);
  const fencePlinthMeshRef = useRef<THREE.InstancedMesh>(null);
  const fenceHeritageMeshRef = useRef<THREE.InstancedMesh>(null);
  const fenceModernMeshRef = useRef<THREE.InstancedMesh>(null);
  const fenceTimberMeshRef = useRef<THREE.InstancedMesh>(null);
  const fencePillarMeshRef = useRef<THREE.InstancedMesh>(null);
  const fenceCapMeshRef = useRef<THREE.InstancedMesh>(null);
  const fenceGateMeshRef = useRef<THREE.InstancedMesh>(null);
  const wallMeshRef = useRef<THREE.InstancedMesh>(null);
  const pitchedRoofMeshRef = useRef<THREE.InstancedMesh>(null);
  const flatRoofMeshRef = useRef<THREE.InstancedMesh>(null);
  const trimMeshRef = useRef<THREE.InstancedMesh>(null);
  const chimneyMeshRef = useRef<THREE.InstancedMesh>(null);
  const balconyMeshRef = useRef<THREE.InstancedMesh>(null);
  const poolMeshRef = useRef<THREE.InstancedMesh>(null);
  const signPostMeshRef = useRef<THREE.InstancedMesh>(null);
  const trunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const canopyMeshRef = useRef<THREE.InstancedMesh>(null);

  const suppressedIdsRef = useRef<Set<string>>(new Set());

  // Precompute all individual fence segments, pillars, open gate leaves & pathway curbs for this sector
  const fenceLayout = useMemo(() => {
    const curbs: FenceTransformSpec[] = [];
    const plinths: FenceTransformSpec[] = [];
    const heritageBays: FenceTransformSpec[] = [];
    const modernBays: FenceTransformSpec[] = [];
    const timberBays: FenceTransformSpec[] = [];
    const pillars: FenceTransformSpec[] = [];
    const caps: FenceTransformSpec[] = [];
    const gates: FenceTransformSpec[] = [];

    for (const p of sector.housePlots) {
      const s = p.houseStyle!;
      const isOg = p.status === 'og';
      const sin = Math.sin(p.facingAngle);
      const cos = Math.cos(p.facingAngle);
      const toWorld = (lx: number, lz: number) => ({
        wx: p.x + lx * cos + lz * sin,
        wz: p.z - lx * sin + lz * cos,
      });

      const halfD = p.depth / 2;
      const pathW = isOg ? 3.4 : 2.5;
      const gateHalf = isOg ? 1.85 : 1.4;
      const inset = isOg ? 0.34 : 0.2;
      const fw = p.width / 2 - inset;
      const fd = halfD - inset;

      // Pathway border curbs flanking the widened walkway inside the property
      const curbStartZ = Math.max(0.5, -1.1 + s.depth / 2 - 0.15);
      const curbEndZ = halfD - 0.04;
      const curbLen = Math.max(1.2, curbEndZ - curbStartZ);
      const curbCenterZ = (curbStartZ + curbEndZ) / 2;
      for (const side of [-1, 1]) {
        const { wx, wz } = toWorld(side * (pathW / 2 + 0.06), curbCenterZ);
        curbs.push({
          x: wx,
          y: SIDEWALK_HEIGHT + 0.02,
          z: wz,
          rotY: p.facingAngle,
          sx: 0.12,
          sy: 0.04,
          sz: curbLen,
          color: '#b7afa1',
        });
      }

      const style = getFenceStyleForArchetype(s.archetype);
      const plinthColor =
        s.archetype === 'luxury-modern' ? '#434952' : isOg ? '#ddd5c6' : '#d2cbc0';
      const plinthH = style === 'heritage-iron' ? 0.28 : style === 'modern-slat' ? 0.24 : 0.18;
      const bayColor =
        style === 'heritage-iron'
          ? '#232830'
          : style === 'modern-slat'
            ? s.archetype === 'luxury-modern'
              ? '#2e343d'
              : s.accentColor
            : s.accentColor;
      const pillarColor =
        style === 'modern-slat'
          ? s.trimColor || '#2f353d'
          : s.trimColor && s.trimColor !== '#32373e'
            ? s.trimColor
            : '#ded7c9';
      const capColor = isOg ? '#d4af37' : '#b7afa1';

      const pillarOffset = 0.13;
      const gatePillarX = gateHalf + pillarOffset;
      const runs: Array<[number, number, number, number]> = [
        [-fw, -fd, -fw, fd], // Left boundary
        [fw, -fd, fw, fd], // Right boundary
        [-fw, -fd, fw, -fd], // Rear boundary
        [-fw, fd, -gatePillarX, fd], // Front-left wing
        [gatePillarX, fd, fw, fd], // Front-right wing
      ];

      const targetBayList =
        style === 'heritage-iron'
          ? heritageBays
          : style === 'modern-slat'
            ? modernBays
            : timberBays;

      for (const [x1, z1, x2, z2] of runs) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        if (len < 0.2) continue;
        const runRotY = p.facingAngle + Math.atan2(-dz, dx);
        const mid = toWorld((x1 + x2) / 2, (z1 + z2) / 2);

        plinths.push({
          x: mid.wx,
          y: SIDEWALK_HEIGHT + plinthH / 2,
          z: mid.wz,
          rotY: runRotY,
          sx: len,
          sy: plinthH,
          sz: 0.15,
          color: plinthColor,
        });

        const bayCount = Math.max(1, Math.round(len / INSTANCED_BAY_UNIT_LEN));
        const bayLen = len / bayCount;
        const bayScaleX = bayLen / INSTANCED_BAY_UNIT_LEN;

        for (let b = 0; b < bayCount; b++) {
          const t = (b + 0.5) / bayCount;
          const bx = x1 + dx * t;
          const bz = z1 + dz * t;
          const bw = toWorld(bx, bz);
          targetBayList.push({
            x: bw.wx,
            y: SIDEWALK_HEIGHT,
            z: bw.wz,
            rotY: runRotY,
            sx: bayScaleX,
            sy: 1,
            sz: 1,
            color: bayColor,
          });
        }
      }

      // 4 Corner Posts + 2 Taller Entrance Gate Pillars
      const postSpecs: Array<[number, number, number, number]> = [
        [-fw, -fd, 0.18, 1.14],
        [fw, -fd, 0.18, 1.14],
        [-fw, fd, 0.18, 1.14],
        [fw, fd, 0.18, 1.14],
        [-gatePillarX, fd, 0.25, 1.32],
        [gatePillarX, fd, 0.25, 1.32],
      ];
      for (const [px, pz, pw, ph] of postSpecs) {
        const pwWorld = toWorld(px, pz);
        pillars.push({
          x: pwWorld.wx,
          y: SIDEWALK_HEIGHT + ph / 2,
          z: pwWorld.wz,
          rotY: p.facingAngle,
          sx: pw,
          sy: ph,
          sz: pw,
          color: pillarColor,
        });
        caps.push({
          x: pwWorld.wx,
          y: SIDEWALK_HEIGHT + ph + 0.035,
          z: pwWorld.wz,
          rotY: p.facingAngle,
          sx: pw + 0.07,
          sy: 0.07,
          sz: pw + 0.07,
          color: capColor,
        });
      }

      // Twin open/ajar entrance gate leaves tucked neatly beside walkway (zero path blocking)
      const leafLen = isOg ? 1.15 : 0.95;
      for (const side of [-1, 1]) {
        const hingeX = side * gateHalf;
        const angle = side < 0 ? 1.5 : -1.5;
        const leafCenterLocalX = hingeX + (side < 0 ? 0.0707 : -0.0707) * (leafLen / 2);
        const leafCenterLocalZ = fd - 0.9975 * (leafLen / 2);
        const lw = toWorld(leafCenterLocalX, leafCenterLocalZ);
        gates.push({
          x: lw.wx,
          y: SIDEWALK_HEIGHT + 0.54,
          z: lw.wz,
          rotY: p.facingAngle + angle,
          sx: leafLen,
          sy: 0.84,
          sz: 0.05,
          color: style === 'heritage-iron' ? '#1f252d' : bayColor,
        });
      }
    }

    return { curbs, plinths, heritageBays, modernBays, timberBays, pillars, caps, gates };
  }, [sector.housePlots]);

  // Populate all static geometry instances for this spatial sector
  useEffect(() => {
    if (sidewalkMeshRef.current) {
      const sidewalkH = SIDEWALK_HEIGHT - 0.018;
      sector.sidewalks.forEach((s, i) => {
        _dummy.position.set(s.x, sidewalkH / 2, s.z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(s.width, 1, s.depth);
        _dummy.updateMatrix();
        sidewalkMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      sidewalkMeshRef.current.instanceMatrix.needsUpdate = true;
      sidewalkMeshRef.current.computeBoundingSphere();
    }

    if (lampPoleMeshRef.current && lampGlobeMeshRef.current) {
      sector.lamps.forEach((l, i) => {
        _dummy.position.set(l.x, SIDEWALK_HEIGHT + 1.85, l.z);
        _dummy.rotation.set(0, l.rotY, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        lampPoleMeshRef.current!.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(l.x, SIDEWALK_HEIGHT + 3.85, l.z);
        _dummy.updateMatrix();
        lampGlobeMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      lampPoleMeshRef.current.instanceMatrix.needsUpdate = true;
      lampGlobeMeshRef.current.instanceMatrix.needsUpdate = true;
      lampPoleMeshRef.current.computeBoundingSphere();
      lampGlobeMeshRef.current.computeBoundingSphere();
    }

    if (padMeshRef.current) {
      sector.plots.forEach((p, i) => {
        if (p.status === 'vip') {
          _dummy.position.set(p.x, -50, p.z);
          _dummy.scale.set(0.001, 0.001, 0.001);
        } else {
          _dummy.position.set(p.x, SIDEWALK_HEIGHT / 2, p.z);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(p.width - 0.25, 1, p.depth - 0.25);
        }
        _dummy.updateMatrix();
        padMeshRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(
          p.status === 'og'
            ? '#6ea458'
            : p.status === 'expansion-open'
              ? '#b9c9a8'
              : '#7ea863',
        );
        padMeshRef.current!.setColorAt(i, _color);
      });
      padMeshRef.current.instanceMatrix.needsUpdate = true;
      if (padMeshRef.current.instanceColor) padMeshRef.current.instanceColor.needsUpdate = true;
      padMeshRef.current.computeBoundingSphere();
    }

    if (trunkMeshRef.current && canopyMeshRef.current) {
      sector.treesData.forEach((t, i) => {
        _dummy.position.set(t.x, SIDEWALK_HEIGHT + 1.1 * t.scale, t.z);
        _dummy.rotation.set(0, (i * 1.3) % (Math.PI * 2), 0);
        _dummy.scale.set(t.scale, t.scale, t.scale);
        _dummy.updateMatrix();
        trunkMeshRef.current!.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(t.x, SIDEWALK_HEIGHT + 2.82 * t.scale, t.z);
        _dummy.rotation.set(0, i * 0.8, 0);
        _dummy.scale.set(t.scale, t.scale * 1.05, t.scale);
        _dummy.updateMatrix();
        canopyMeshRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(t.tint);
        canopyMeshRef.current!.setColorAt(i, _color);
      });
      trunkMeshRef.current.instanceMatrix.needsUpdate = true;
      canopyMeshRef.current.instanceMatrix.needsUpdate = true;
      if (canopyMeshRef.current.instanceColor) canopyMeshRef.current.instanceColor.needsUpdate = true;
      trunkMeshRef.current.computeBoundingSphere();
      canopyMeshRef.current.computeBoundingSphere();
    }

    if (wallMeshRef.current && trimMeshRef.current && signPostMeshRef.current) {
      sector.housePlots.forEach((p, i) => {
        const s = p.houseStyle!;
        const { hx, hz, doorZ } = getHouseOrigin(p);

        _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight / 2, hz);
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(s.width, s.wallHeight, s.depth);
        _dummy.updateMatrix();
        wallMeshRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(s.wallColor);
        wallMeshRef.current!.setColorAt(i, _color);

        _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight * 0.52, hz);
        _dummy.scale.set(s.width + 0.12, 0.16, s.depth + 0.12);
        _dummy.updateMatrix();
        trimMeshRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(s.trimColor);
        trimMeshRef.current!.setColorAt(i, _color);

        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const isOg = p.status === 'og';
        const signLocalX = isOg ? -2.95 : -2.42;
        const signDoorZ = p.depth / 2 - (isOg ? 0.06 : 0.04);
        const sx = p.x + signLocalX * cos + signDoorZ * sin;
        const sz = p.z - signLocalX * sin + signDoorZ * cos;
        _dummy.position.set(sx, SIDEWALK_HEIGHT + 0.52, sz);
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        signPostMeshRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(isOg ? '#d4af37' : '#3a424d');
        signPostMeshRef.current!.setColorAt(i, _color);

        // Wider front stone walkway linking porch through entrance gate all the way to street curb
        if (drivewayMeshRef.current) {
          const halfD = p.depth / 2;
          const startZ = Math.max(0.5, -1.1 + s.depth / 2 - 0.15);
          const endZ = halfD + (isOg ? 4.8 : 1.62);
          const pathLen = Math.max(2.6, endZ - startZ);
          const pathOffsetZ = (startZ + endZ) / 2;
          _dummy.position.set(
            p.x + pathOffsetZ * sin,
            SIDEWALK_HEIGHT + 0.015,
            p.z + pathOffsetZ * cos,
          );
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(isOg ? 3.4 : 2.5, 0.03, pathLen);
          _dummy.updateMatrix();
          drivewayMeshRef.current.setMatrixAt(i, _dummy.matrix);
        }
      });
      wallMeshRef.current.instanceMatrix.needsUpdate = true;
      trimMeshRef.current.instanceMatrix.needsUpdate = true;
      signPostMeshRef.current.instanceMatrix.needsUpdate = true;
      if (wallMeshRef.current.instanceColor) wallMeshRef.current.instanceColor.needsUpdate = true;
      if (trimMeshRef.current.instanceColor) trimMeshRef.current.instanceColor.needsUpdate = true;
      if (signPostMeshRef.current.instanceColor) signPostMeshRef.current.instanceColor.needsUpdate = true;
      wallMeshRef.current.computeBoundingSphere();
      trimMeshRef.current.computeBoundingSphere();
      signPostMeshRef.current.computeBoundingSphere();
      if (drivewayMeshRef.current) {
        drivewayMeshRef.current.instanceMatrix.needsUpdate = true;
        drivewayMeshRef.current.computeBoundingSphere();
      }
    }

    const populateInstancedGroup = (
      mesh: THREE.InstancedMesh | null,
      items: FenceTransformSpec[],
      withColors = true,
    ) => {
      if (!mesh || items.length === 0) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        _dummy.position.set(item.x, item.y, item.z);
        _dummy.rotation.set(0, item.rotY, 0);
        _dummy.scale.set(item.sx, item.sy, item.sz);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
        if (withColors) {
          _color.set(item.color);
          mesh.setColorAt(i, _color);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (withColors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };

    populateInstancedGroup(curbMeshRef.current, fenceLayout.curbs, false);
    populateInstancedGroup(fencePlinthMeshRef.current, fenceLayout.plinths);
    populateInstancedGroup(fenceHeritageMeshRef.current, fenceLayout.heritageBays);
    populateInstancedGroup(fenceModernMeshRef.current, fenceLayout.modernBays);
    populateInstancedGroup(fenceTimberMeshRef.current, fenceLayout.timberBays);
    populateInstancedGroup(fencePillarMeshRef.current, fenceLayout.pillars);
    populateInstancedGroup(fenceCapMeshRef.current, fenceLayout.caps);
    populateInstancedGroup(fenceGateMeshRef.current, fenceLayout.gates);

    if (pitchedRoofMeshRef.current) {
      sector.pitchedRoofPlots.forEach((p, i) => {
        const s = p.houseStyle!;
        const { hx, hz } = getHouseOrigin(p);
        const roofH = s.archetype === 'luxury-mansion' ? 2.9 : 2.3;
        _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight + roofH / 2, hz);
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(s.width * 1.06, roofH, s.depth * 1.06);
        _dummy.updateMatrix();
        pitchedRoofMeshRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(s.roofColor);
        pitchedRoofMeshRef.current!.setColorAt(i, _color);
      });
      pitchedRoofMeshRef.current.instanceMatrix.needsUpdate = true;
      if (pitchedRoofMeshRef.current.instanceColor) {
        pitchedRoofMeshRef.current.instanceColor.needsUpdate = true;
      }
      pitchedRoofMeshRef.current.computeBoundingSphere();
    }

    if (flatRoofMeshRef.current) {
      sector.flatRoofPlots.forEach((p, i) => {
        const s = p.houseStyle!;
        const { hx, hz } = getHouseOrigin(p);
        _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight + 0.24, hz);
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(s.width + 0.9, 0.42, s.depth + 0.9);
        _dummy.updateMatrix();
        flatRoofMeshRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(s.roofColor);
        flatRoofMeshRef.current!.setColorAt(i, _color);
      });
      flatRoofMeshRef.current.instanceMatrix.needsUpdate = true;
      if (flatRoofMeshRef.current.instanceColor) {
        flatRoofMeshRef.current.instanceColor.needsUpdate = true;
      }
      flatRoofMeshRef.current.computeBoundingSphere();
    }

    if (chimneyMeshRef.current) {
      sector.chimneyPlots.forEach((p, i) => {
        const s = p.houseStyle!;
        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const lx = s.width * 0.26;
        const lz = -1.1 - s.depth * 0.2;
        _dummy.position.set(
          p.x + lx * cos + lz * sin,
          SIDEWALK_HEIGHT + s.wallHeight + 1.4,
          p.z - lx * sin + lz * cos,
        );
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(0.75, 2.2, 0.75);
        _dummy.updateMatrix();
        chimneyMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      chimneyMeshRef.current.instanceMatrix.needsUpdate = true;
      chimneyMeshRef.current.computeBoundingSphere();
    }

    if (balconyMeshRef.current) {
      sector.balconyPlots.forEach((p, i) => {
        const s = p.houseStyle!;
        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const lz = -1.1 + s.depth / 2 + 0.55;
        _dummy.position.set(
          p.x + lz * sin,
          SIDEWALK_HEIGHT + s.wallHeight * 0.54,
          p.z + lz * cos,
        );
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(3.0, 0.16, 1.15);
        _dummy.updateMatrix();
        balconyMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      balconyMeshRef.current.instanceMatrix.needsUpdate = true;
      balconyMeshRef.current.computeBoundingSphere();
    }

    if (poolMeshRef.current) {
      sector.poolPlots.forEach((p, i) => {
        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const lz = -p.depth / 2 + 2.5;
        _dummy.position.set(p.x + lz * sin, SIDEWALK_HEIGHT + 0.06, p.z + lz * cos);
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(5.4, 0.06, 2.8);
        _dummy.updateMatrix();
        poolMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      poolMeshRef.current.instanceMatrix.needsUpdate = true;
      poolMeshRef.current.computeBoundingSphere();
    }

    suppressedIdsRef.current.clear();
  }, [sector, fenceLayout]);

  // Suppress coarse shells only for detailed LOD plots belonging to this sector
  useEffect(() => {
    const plotByIdLocal = new Map<string, ExpansionPlotSpec>();
    for (const p of sector.housePlots) plotByIdLocal.set(p.plotId, p);

    const nextIds = new Set<string>();
    for (const d of detailedPlots) {
      if (sector.houseIdxById.has(d.plotId)) {
        nextIds.add(d.plotId);
      }
    }

    const prevIds = suppressedIdsRef.current;
    let changed = nextIds.size !== prevIds.size;
    if (!changed) {
      for (const id of nextIds) {
        if (!prevIds.has(id)) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;

    let wallDirty = false;
    let pitchedDirty = false;
    let flatDirty = false;

    for (const prevId of prevIds) {
      if (!nextIds.has(prevId)) {
        const p = plotByIdLocal.get(prevId);
        if (!p || !p.houseStyle) continue;
        const s = p.houseStyle;
        const { hx, hz } = getHouseOrigin(p);

        const wi = sector.houseIdxById.get(p.plotId);
        if (wi !== undefined && wallMeshRef.current && trimMeshRef.current) {
          _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight / 2, hz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(s.width, s.wallHeight, s.depth);
          _dummy.updateMatrix();
          wallMeshRef.current.setMatrixAt(wi, _dummy.matrix);

          _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight * 0.52, hz);
          _dummy.scale.set(s.width + 0.12, 0.16, s.depth + 0.12);
          _dummy.updateMatrix();
          trimMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          wallDirty = true;
        }

        const pi = sector.pitchedIdxById.get(p.plotId);
        if (pi !== undefined && pitchedRoofMeshRef.current) {
          const roofH = s.archetype === 'luxury-mansion' ? 2.9 : 2.3;
          _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight + roofH / 2, hz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(s.width * 1.06, roofH, s.depth * 1.06);
          _dummy.updateMatrix();
          pitchedRoofMeshRef.current.setMatrixAt(pi, _dummy.matrix);
          pitchedDirty = true;
        }

        const fi = sector.flatIdxById.get(p.plotId);
        if (fi !== undefined && flatRoofMeshRef.current) {
          _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight + 0.24, hz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(s.width + 0.9, 0.42, s.depth + 0.9);
          _dummy.updateMatrix();
          flatRoofMeshRef.current.setMatrixAt(fi, _dummy.matrix);
          flatDirty = true;
        }
      }
    }

    _dummy.position.set(0, -100, 0);
    _dummy.scale.set(0.0001, 0.0001, 0.0001);
    _dummy.updateMatrix();

    for (const id of nextIds) {
      if (!prevIds.has(id)) {
        const wi = sector.houseIdxById.get(id);
        if (wi !== undefined && wallMeshRef.current && trimMeshRef.current) {
          wallMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          trimMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          wallDirty = true;
        }
        const pi = sector.pitchedIdxById.get(id);
        if (pi !== undefined && pitchedRoofMeshRef.current) {
          pitchedRoofMeshRef.current.setMatrixAt(pi, _dummy.matrix);
          pitchedDirty = true;
        }
        const fi = sector.flatIdxById.get(id);
        if (fi !== undefined && flatRoofMeshRef.current) {
          flatRoofMeshRef.current.setMatrixAt(fi, _dummy.matrix);
          flatDirty = true;
        }
      }
    }

    if (wallDirty && wallMeshRef.current && trimMeshRef.current) {
      wallMeshRef.current.instanceMatrix.needsUpdate = true;
      trimMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (pitchedDirty && pitchedRoofMeshRef.current) {
      pitchedRoofMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (flatDirty && flatRoofMeshRef.current) {
      flatRoofMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    suppressedIdsRef.current = nextIds;
  }, [detailedPlots, sector]);

  return (
    <group>
      {sector.sidewalks.length > 0 && (
        <instancedMesh
          ref={sidewalkMeshRef}
          args={[res.sidewalkBoxGeo, res.sidewalkMat, sector.sidewalks.length]}
          receiveShadow
          frustumCulled
        />
      )}

      {sector.lamps.length > 0 && (
        <>
          <instancedMesh
            ref={lampPoleMeshRef}
            args={[res.lampPoleGeo, res.lampPoleMat, sector.lamps.length]}
            frustumCulled
          />
          <instancedMesh
            ref={lampGlobeMeshRef}
            args={[res.lampGlobeGeo, lampGlobeMat, sector.lamps.length]}
            frustumCulled
          />
        </>
      )}

      {sector.plots.length > 0 && (
        <instancedMesh
          ref={padMeshRef}
          args={[res.padBoxGeo, res.padMat, sector.plots.length]}
          receiveShadow
          frustumCulled
          onClick={(e) => {
            e.stopPropagation();
            if (typeof e.instanceId === 'number') {
              const hit = sector.plots[e.instanceId];
              if (hit) onSelectExpansionPlot(hit);
            }
          }}
        />
      )}

      {sector.housePlots.length > 0 && (
        <instancedMesh
          ref={wallMeshRef}
          args={[res.unitBoxGeo, res.wallMat, sector.housePlots.length]}
          frustumCulled
          onClick={(e) => {
            e.stopPropagation();
            if (typeof e.instanceId === 'number') {
              const hit = sector.housePlots[e.instanceId];
              if (hit) onSelectExpansionPlot(hit);
            }
          }}
        />
      )}

      {sector.pitchedRoofPlots.length > 0 && (
        <instancedMesh
          ref={pitchedRoofMeshRef}
          args={[res.pitchedRoofGeo, res.pitchedRoofMat, sector.pitchedRoofPlots.length]}
          frustumCulled
        />
      )}

      {sector.flatRoofPlots.length > 0 && (
        <instancedMesh
          ref={flatRoofMeshRef}
          args={[res.unitBoxGeo, res.flatRoofMat, sector.flatRoofPlots.length]}
          frustumCulled
        />
      )}

      {sector.housePlots.length > 0 && (
        <instancedMesh
          ref={trimMeshRef}
          args={[res.unitBoxGeo, res.trimMat, sector.housePlots.length]}
          frustumCulled
        />
      )}

      {sector.chimneyPlots.length > 0 && (
        <instancedMesh
          ref={chimneyMeshRef}
          args={[res.unitBoxGeo, res.chimneyMat, sector.chimneyPlots.length]}
          frustumCulled
        />
      )}

      {sector.balconyPlots.length > 0 && (
        <instancedMesh
          ref={balconyMeshRef}
          args={[res.unitBoxGeo, res.balconyMat, sector.balconyPlots.length]}
          frustumCulled
        />
      )}

      {sector.poolPlots.length > 0 && (
        <instancedMesh
          ref={poolMeshRef}
          args={[res.unitBoxGeo, res.poolMat, sector.poolPlots.length]}
          frustumCulled
        />
      )}

      {sector.housePlots.length > 0 && (
        <>
          <instancedMesh
            ref={drivewayMeshRef}
            args={[res.unitBoxGeo, res.drivewayMat, sector.housePlots.length]}
            receiveShadow
            frustumCulled
          />
          <instancedMesh
            ref={signPostMeshRef}
            args={[res.signBoardGeo, res.signPostMat, sector.housePlots.length]}
            frustumCulled
          />
        </>
      )}

      {fenceLayout.curbs.length > 0 && (
        <instancedMesh
          ref={curbMeshRef}
          args={[res.unitBoxGeo, res.curbMat, fenceLayout.curbs.length]}
          receiveShadow
          frustumCulled
        />
      )}

      {fenceLayout.plinths.length > 0 && (
        <instancedMesh
          ref={fencePlinthMeshRef}
          args={[res.unitBoxGeo, res.fencePlinthMat, fenceLayout.plinths.length]}
          receiveShadow
          frustumCulled
        />
      )}

      {fenceLayout.heritageBays.length > 0 && (
        <instancedMesh
          ref={fenceHeritageMeshRef}
          args={[res.fenceHeritageBayGeo, res.fenceBayMat, fenceLayout.heritageBays.length]}
          frustumCulled
        />
      )}

      {fenceLayout.modernBays.length > 0 && (
        <instancedMesh
          ref={fenceModernMeshRef}
          args={[res.fenceModernBayGeo, res.fenceBayMat, fenceLayout.modernBays.length]}
          frustumCulled
        />
      )}

      {fenceLayout.timberBays.length > 0 && (
        <instancedMesh
          ref={fenceTimberMeshRef}
          args={[res.fenceTimberBayGeo, res.fenceBayMat, fenceLayout.timberBays.length]}
          frustumCulled
        />
      )}

      {fenceLayout.pillars.length > 0 && (
        <instancedMesh
          ref={fencePillarMeshRef}
          args={[res.unitBoxGeo, res.fencePillarMat, fenceLayout.pillars.length]}
          frustumCulled
        />
      )}

      {fenceLayout.caps.length > 0 && (
        <instancedMesh
          ref={fenceCapMeshRef}
          args={[res.unitBoxGeo, res.fencePillarMat, fenceLayout.caps.length]}
          frustumCulled
        />
      )}

      {fenceLayout.gates.length > 0 && (
        <instancedMesh
          ref={fenceGateMeshRef}
          args={[res.unitBoxGeo, res.fenceBayMat, fenceLayout.gates.length]}
          frustumCulled
        />
      )}

      {sector.treesData.length > 0 && (
        <>
          <instancedMesh
            ref={trunkMeshRef}
            args={[res.trunkGeo, res.trunkMat, sector.treesData.length]}
            frustumCulled
          />
          <instancedMesh
            ref={canopyMeshRef}
            args={[res.canopyGeo, res.canopyMat, sector.treesData.length]}
            frustumCulled
          />
        </>
      )}
    </group>
  );
});

export const ExpandedCityRenderer: React.FC<ExpandedCityRendererProps> = ({
  world,
  textures,
  timeOfDay,
  cameraMode,
  playerPoseRef,
  selectedExpansionPlotId,
  openDoors,
  onSelectExpansionPlot,
  onOpenMonumentModal,
}) => {
  const { camera } = useThree();
  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';

  const roadMeshRef = useRef<THREE.InstancedMesh>(null);
  const roadLineMeshRef = useRef<THREE.InstancedMesh>(null);
  const dashedLineMeshRef = useRef<THREE.InstancedMesh>(null);
  const crosswalkMeshRef = useRef<THREE.InstancedMesh>(null);
  const curvyJointMeshRef = useRef<THREE.InstancedMesh>(null);
  const curvyCurbMeshRef = useRef<THREE.InstancedMesh>(null);
  const blvdTreeTrunkRef = useRef<THREE.InstancedMesh>(null);
  const blvdTreeCrownRef = useRef<THREE.InstancedMesh>(null);
  const blvdBushRef = useRef<THREE.InstancedMesh>(null);

  const mainAveRoads = useMemo(
    () => world.roads.filter((r) => r.hasDoubleCenterLine),
    [world],
  );

  // Smooth circular asphalt joint discs + roadside stone curbs for curvy roads
  const { curvyJoints, curvyCurbs } = useMemo(() => {
    const joints: Array<{ x: number; z: number; radius: number }> = [];
    const curbs: Array<{ x: number; z: number; rotY: number; len: number }> = [];
    const seenJoint = new Set<string>();
    for (const seg of world.curvyRoadSegments) {
      for (const [px, pz] of [
        [seg.x1, seg.z1],
        [seg.x2, seg.z2],
      ]) {
        const key = `${Math.round(px * 2)},${Math.round(pz * 2)}`;
        if (!seenJoint.has(key)) {
          seenJoint.add(key);
          joints.push({ x: px, z: pz, radius: seg.width * 0.5 });
        }
      }
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const rotY = Math.atan2(dx, dz);
      const nx = -dz / len;
      const nz = dx / len;
      const mx = (seg.x1 + seg.x2) / 2;
      const mz = (seg.z1 + seg.z2) / 2;
      const offset = seg.width / 2 + 0.38;
      curbs.push({ x: mx + nx * offset, z: mz + nz * offset, rotY, len: len + 0.5 });
      curbs.push({ x: mx - nx * offset, z: mz - nz * offset, rotY, len: len + 0.5 });
    }
    return { curvyJoints: joints, curvyCurbs: curbs };
  }, [world.curvyRoadSegments]);

  // Road-aligned trees & landscaped bushes along expansion boulevards and curvy parkways (strictly road/intersection/bridge/plot-clear)
  const { blvdTrees, blvdBushes } = useMemo(() => {
    const rawTrees: Array<{ x: number; z: number; scale: number; tint: string }> = [];
    const bushes: Array<{ x: number; z: number; scale: number; tint: string }> = [];
    const treeTints = ['#4b7f43', '#5a8f4c', '#3d6d3b', '#679b55'];

    // Trees & bushes flanking curvy scenic parkways and outer panoramic ring
    world.curvyRoadSegments.forEach((seg, idx) => {
      if (idx % 2 !== 0) return;
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz);
      if (len < 1) return;
      const nx = -dz / len;
      const nz = dx / len;
      const mx = (seg.x1 + seg.x2) / 2;
      const mz = (seg.z1 + seg.z2) / 2;
      const offset = seg.width / 2 + 3.8;
      for (const side of [-1, 1]) {
        const tx = mx + nx * offset * side;
        const tz = mz + nz * offset * side;
        if (!isClearOfExpansionInfra(tx, tz, world, 2.3)) continue;
        rawTrees.push({
          x: tx,
          z: tz,
          scale: 0.95 + (rawTrees.length % 4) * 0.12,
          tint: treeTints[rawTrees.length % treeTints.length],
        });
        const bx = tx + (dx / len) * 3.8;
        const bz = tz + (dz / len) * 3.8;
        if (isClearOfExpansionInfra(bx, bz, world, 1.9)) {
          bushes.push({ x: bx, z: bz, scale: 0.95, tint: '#4d7c43' });
        }
      }
    });

    // Neat parallel boulevard tree rows flanking primary E-W boulevards (z = -130, 130, -330, 176)
    for (const zAxis of [-130, 130, -330, 176]) {
      for (let x = -800; x <= 840; x += 28) {
        for (const side of [-1, 1]) {
          const tx = x;
          const tz = zAxis + side * 8.2;
          if (!isClearOfExpansionInfra(tx, tz, world, 2.3)) continue;
          rawTrees.push({
            x: tx,
            z: tz,
            scale: 0.92 + (rawTrees.length % 3) * 0.1,
            tint: treeTints[rawTrees.length % treeTints.length],
          });
        }
      }
    }

    const trees = filterWithMinSpacing(rawTrees, 5.2);
    return { blvdTrees: trees, blvdBushes: bushes };
  }, [world]);

  const dashedCenterSegments = useMemo(() => {
    const segs: Array<{ x: number; z: number; rotY: number; len: number }> = [];
    for (const r of world.roads) {
      if (!r.hasDashedCenterLine) continue;
      const dx = r.x2 - r.x1;
      const dz = r.z2 - r.z1;
      const total = Math.hypot(dx, dz);
      if (total < 10) continue;
      const rotY = Math.atan2(dx, dz);
      const nx = dx / total;
      const nz = dz / total;
      for (let d = 6; d < total - 6; d += 12) {
        segs.push({ x: r.x1 + nx * d, z: r.z1 + nz * d, rotY, len: 4.5 });
      }
    }
    return segs;
  }, [world.roads]);

  const crosswalkBars = useMemo(() => {
    const bars: Array<{ x: number; z: number; rotY: number }> = [];
    for (const cw of world.crosswalks) {
      const sin = Math.sin(cw.rotY);
      const cos = Math.cos(cw.rotY);
      for (let k = -2; k <= 2; k++) {
        const offset = k * 1.55;
        bars.push({
          x: cw.x + offset * cos,
          z: cw.z - offset * sin,
          rotY: cw.rotY,
        });
      }
    }
    return bars;
  }, [world.crosswalks]);

  // Partition all infrastructure & houses into frustum-cullable spatial sectors
  const sectors = useMemo<SectorBucket[]>(() => {
    const map = new Map<string, SectorBucket>();
    const ensure = (key: string): SectorBucket => {
      let s = map.get(key);
      if (!s) {
        s = {
          key,
          sidewalks: [],
          lamps: [],
          plots: [],
          housePlots: [],
          pitchedRoofPlots: [],
          flatRoofPlots: [],
          chimneyPlots: [],
          balconyPlots: [],
          poolPlots: [],
          treesData: [],
          houseIdxById: new Map(),
          pitchedIdxById: new Map(),
          flatIdxById: new Map(),
        };
        map.set(key, s);
      }
      return s;
    };

    for (const sw of world.sidewalks) {
      ensure(getSectorKey(sw.x, sw.z)).sidewalks.push(sw);
    }
    for (const lamp of world.lamps) {
      ensure(getSectorKey(lamp.x, lamp.z)).lamps.push(lamp);
    }

    const foliageTints = ['#4f8545', '#5c934e', '#3f6f3b', '#699e57', '#4a7d4a'];
    world.plots.forEach((p, i) => {
      const s = ensure(getSectorKey(p.x, p.z));
      s.plots.push(p);

      if (p.status !== 'vip') {
        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const lx =
          p.status === 'expansion-open'
            ? p.width * 0.34
            : p.status === 'og'
              ? -p.width / 2 + 2.2
              : -p.width / 2 + 1.65;
        const lz =
          p.status === 'expansion-open'
            ? -p.depth * 0.3
            : p.status === 'og'
              ? -p.depth / 2 + 2.2
              : -p.depth / 2 + 1.65;
        if (isExpansionPlotTreeSafe(p, lx, lz)) {
          s.treesData.push({
            x: p.x + lx * cos + lz * sin,
            z: p.z - lx * sin + lz * cos,
            scale: p.status === 'og' ? 1.05 : 0.72 + ((i % 4) * 0.06),
            tint: foliageTints[i % foliageTints.length],
          });
        }
      }

      if (p.status !== 'vip' && p.houseStyle !== null) {
        const wi = s.housePlots.length;
        s.housePlots.push(p);
        s.houseIdxById.set(p.plotId, wi);

        const arch = p.houseStyle.archetype;
        if (arch === 'modern-villa' || arch === 'luxury-modern') {
          const fi = s.flatRoofPlots.length;
          s.flatRoofPlots.push(p);
          s.flatIdxById.set(p.plotId, fi);
        } else {
          const pi = s.pitchedRoofPlots.length;
          s.pitchedRoofPlots.push(p);
          s.pitchedIdxById.set(p.plotId, pi);
        }

        if (p.houseStyle.hasChimney) s.chimneyPlots.push(p);
        if (p.houseStyle.hasBalcony) s.balconyPlots.push(p);
        if (p.houseStyle.hasPool) s.poolPlots.push(p);
      }
    });

    return Array.from(map.values());
  }, [world]);

  // Shared geometries & materials across all sectors (disposed cleanly on unmount)
  const sharedRes = useMemo<SharedSectorResources>(() => {
    const pitchedRoofGeo = new THREE.ConeGeometry(0.71, 1, 4, 1);
    pitchedRoofGeo.rotateY(Math.PI / 4);
    pitchedRoofGeo.computeVertexNormals();
    const fenceBays = createUnitFenceBayGeometries();

    return {
      unitBoxGeo: new THREE.BoxGeometry(1, 1, 1),
      sidewalkBoxGeo: new THREE.BoxGeometry(1, SIDEWALK_HEIGHT - 0.018, 1),
      padBoxGeo: new THREE.BoxGeometry(1, SIDEWALK_HEIGHT, 1),
      lampPoleGeo: new THREE.CylinderGeometry(0.07, 0.1, 3.7, 6),
      lampGlobeGeo: new THREE.SphereGeometry(0.22, 8, 8),
      pitchedRoofGeo,
      signBoardGeo: new THREE.BoxGeometry(0.92, 0.85, 0.14),
      trunkGeo: createHdTrunkGeo(),
      canopyGeo: createHdBroadleafCrownGeo(),
      fenceHeritageBayGeo: fenceBays.heritageBay,
      fenceModernBayGeo: fenceBays.modernBay,
      fenceTimberBayGeo: fenceBays.timberBay,
      sidewalkMat: new THREE.MeshStandardMaterial({
        map: textures.sidewalkStone,
        color: '#d6d0c4',
        roughness: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: 1,
      }),
      lampPoleMat: new THREE.MeshStandardMaterial({
        color: '#252930',
        roughness: 0.45,
        metalness: 0.65,
      }),
      padMat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 }),
      drivewayMat: new THREE.MeshStandardMaterial({
        map: textures.sidewalkStone,
        color: '#dcd4c5',
        roughness: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
      curbMat: new THREE.MeshStandardMaterial({ color: '#b7afa1', roughness: 0.84 }),
      fencePlinthMat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86 }),
      fenceBayMat: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.56,
        metalness: 0.25,
      }),
      fencePillarMat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.72 }),
      wallMat: new THREE.MeshStandardMaterial({
        map: textures.plaster,
        color: '#ffffff',
        roughness: 0.82,
      }),
      pitchedRoofMat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.76 }),
      flatRoofMat: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.55,
        metalness: 0.18,
      }),
      trimMat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62 }),
      chimneyMat: new THREE.MeshStandardMaterial({ color: '#8e5242', roughness: 0.88 }),
      balconyMat: new THREE.MeshStandardMaterial({ color: '#c4bdb1', roughness: 0.74 }),
      poolMat: new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        roughness: 0.14,
        metalness: 0.2,
      }),
      signPostMat: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.5,
        metalness: 0.35,
      }),
      trunkMat: new THREE.MeshStandardMaterial({ color: '#61442d', roughness: 0.92 }),
      canopyMat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86 }),
    };
  }, [textures]);

  const lampGlobeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fff1d0',
        emissive: '#ffae34',
        emissiveIntensity: 0.12,
        roughness: 0.25,
      }),
    [],
  );

  useEffect(() => {
    lampGlobeMat.emissiveIntensity = isEvening ? 2.4 : 0.12;
  }, [lampGlobeMat, isEvening]);

  useEffect(() => {
    return () => {
      sharedRes.unitBoxGeo.dispose();
      sharedRes.sidewalkBoxGeo.dispose();
      sharedRes.padBoxGeo.dispose();
      sharedRes.lampPoleGeo.dispose();
      sharedRes.lampGlobeGeo.dispose();
      sharedRes.pitchedRoofGeo.dispose();
      sharedRes.signBoardGeo.dispose();
      sharedRes.trunkGeo.dispose();
      sharedRes.canopyGeo.dispose();
      sharedRes.fenceHeritageBayGeo.dispose();
      sharedRes.fenceModernBayGeo.dispose();
      sharedRes.fenceTimberBayGeo.dispose();
      sharedRes.sidewalkMat.dispose();
      sharedRes.lampPoleMat.dispose();
      sharedRes.padMat.dispose();
      sharedRes.drivewayMat.dispose();
      sharedRes.curbMat.dispose();
      sharedRes.fencePlinthMat.dispose();
      sharedRes.fenceBayMat.dispose();
      sharedRes.fencePillarMat.dispose();
      sharedRes.wallMat.dispose();
      sharedRes.pitchedRoofMat.dispose();
      sharedRes.flatRoofMat.dispose();
      sharedRes.trimMat.dispose();
      sharedRes.chimneyMat.dispose();
      sharedRes.balconyMat.dispose();
      sharedRes.poolMat.dispose();
      sharedRes.signPostMat.dispose();
      sharedRes.trunkMat.dispose();
      sharedRes.canopyMat.dispose();
      lampGlobeMat.dispose();
    };
  }, [sharedRes, lampGlobeMat]);

  // Populate Roads & Center Lines with clean Y-layering so intersecting roads never Z-fight
  useEffect(() => {
    if (roadMeshRef.current) {
      world.roads.forEach((r, i) => {
        const dx = r.x2 - r.x1;
        const dz = r.z2 - r.z1;
        const len = Math.hypot(dx, dz);
        const isNS = Math.abs(dx) < Math.abs(dz);
        _dummy.position.set(
          (r.x1 + r.x2) / 2,
          ROAD_SURFACE_Y / 2 - (isNS ? 0 : 0.004),
          (r.z1 + r.z2) / 2,
        );
        _dummy.rotation.set(0, Math.atan2(dx, dz), 0);
        _dummy.scale.set(r.width, 1, len);
        _dummy.updateMatrix();
        roadMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      roadMeshRef.current.instanceMatrix.needsUpdate = true;
      roadMeshRef.current.computeBoundingSphere();
    }

    if (roadLineMeshRef.current) {
      mainAveRoads.forEach((r, i) => {
        const dx = r.x2 - r.x1;
        const dz = r.z2 - r.z1;
        const len = Math.hypot(dx, dz);
        const trim = r.roadTier === 'scenic-curve' ? 0.2 : 4;
        _dummy.position.set((r.x1 + r.x2) / 2, ROAD_SURFACE_Y + 0.012, (r.z1 + r.z2) / 2);
        _dummy.rotation.set(0, Math.atan2(dx, dz), 0);
        _dummy.scale.set(0.22, 1, Math.max(1, len - trim));
        _dummy.updateMatrix();
        roadLineMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      roadLineMeshRef.current.instanceMatrix.needsUpdate = true;
      roadLineMeshRef.current.computeBoundingSphere();
    }

    if (curvyJointMeshRef.current && curvyJoints.length > 0) {
      curvyJoints.forEach((j, i) => {
        _dummy.position.set(j.x, ROAD_SURFACE_Y / 2 - 0.002, j.z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(j.radius, 1, j.radius);
        _dummy.updateMatrix();
        curvyJointMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      curvyJointMeshRef.current.instanceMatrix.needsUpdate = true;
      curvyJointMeshRef.current.computeBoundingSphere();
    }

    if (curvyCurbMeshRef.current && curvyCurbs.length > 0) {
      curvyCurbs.forEach((c, i) => {
        _dummy.position.set(c.x, SIDEWALK_HEIGHT * 0.42, c.z);
        _dummy.rotation.set(0, c.rotY, 0);
        _dummy.scale.set(0.75, SIDEWALK_HEIGHT * 0.84, c.len);
        _dummy.updateMatrix();
        curvyCurbMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      curvyCurbMeshRef.current.instanceMatrix.needsUpdate = true;
      curvyCurbMeshRef.current.computeBoundingSphere();
    }

    if (blvdTreeTrunkRef.current && blvdTreeCrownRef.current && blvdTrees.length > 0) {
      blvdTrees.forEach((t, i) => {
        _dummy.position.set(t.x, 1.1 * t.scale, t.z);
        _dummy.rotation.set(0, (i * 1.1) % (Math.PI * 2), 0);
        _dummy.scale.set(t.scale, t.scale, t.scale);
        _dummy.updateMatrix();
        blvdTreeTrunkRef.current!.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(t.x, 2.85 * t.scale, t.z);
        _dummy.scale.set(t.scale, t.scale * 1.04, t.scale);
        _dummy.updateMatrix();
        blvdTreeCrownRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(t.tint);
        blvdTreeCrownRef.current!.setColorAt(i, _color);
      });
      blvdTreeTrunkRef.current.instanceMatrix.needsUpdate = true;
      blvdTreeCrownRef.current.instanceMatrix.needsUpdate = true;
      if (blvdTreeCrownRef.current.instanceColor) blvdTreeCrownRef.current.instanceColor.needsUpdate = true;
      blvdTreeTrunkRef.current.computeBoundingSphere();
      blvdTreeCrownRef.current.computeBoundingSphere();
    }

    if (blvdBushRef.current && blvdBushes.length > 0) {
      blvdBushes.forEach((b, i) => {
        _dummy.position.set(b.x, 0.32 * b.scale, b.z);
        _dummy.rotation.set(0, i * 0.7, 0);
        _dummy.scale.set(1.15 * b.scale, 0.65 * b.scale, 1.15 * b.scale);
        _dummy.updateMatrix();
        blvdBushRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(b.tint);
        blvdBushRef.current!.setColorAt(i, _color);
      });
      blvdBushRef.current.instanceMatrix.needsUpdate = true;
      if (blvdBushRef.current.instanceColor) blvdBushRef.current.instanceColor.needsUpdate = true;
      blvdBushRef.current.computeBoundingSphere();
    }

    if (dashedLineMeshRef.current) {
      dashedCenterSegments.forEach((seg, i) => {
        _dummy.position.set(seg.x, ROAD_SURFACE_Y + 0.014, seg.z);
        _dummy.rotation.set(0, seg.rotY, 0);
        _dummy.scale.set(0.16, 1, seg.len);
        _dummy.updateMatrix();
        dashedLineMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      dashedLineMeshRef.current.instanceMatrix.needsUpdate = true;
      dashedLineMeshRef.current.computeBoundingSphere();
    }

    if (crosswalkMeshRef.current) {
      crosswalkBars.forEach((bar, i) => {
        _dummy.position.set(bar.x, ROAD_SURFACE_Y + 0.016, bar.z);
        _dummy.rotation.set(0, bar.rotY, 0);
        _dummy.scale.set(0.65, 1, 3.6);
        _dummy.updateMatrix();
        crosswalkMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      crosswalkMeshRef.current.instanceMatrix.needsUpdate = true;
      crosswalkMeshRef.current.computeBoundingSphere();
    }
  }, [world, mainAveRoads, dashedCenterSegments, crosswalkBars, curvyJoints, curvyCurbs, blvdTrees, blvdBushes]);

  // Proximity LOD Window + focus tracker for OG sign culling
  const [detailedPlots, setDetailedPlots] = useState<ExpansionPlotSpec[]>([]);
  const [focusPos, setFocusPos] = useState<{ x: number; z: number }>({ x: 0, z: -180 });
  const lastQueryPosRef = useRef<{ x: number; z: number; sel: string | null; t: number }>({
    x: 9999,
    z: 9999,
    sel: null,
    t: -10,
  });

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (
      t - lastQueryPosRef.current.t < 0.22 &&
      lastQueryPosRef.current.sel === selectedExpansionPlotId
    ) {
      return;
    }

    let fx: number;
    let fz: number;
    if (cameraMode === 'walking') {
      fx = playerPoseRef.current.x;
      fz = playerPoseRef.current.z;
    } else {
      camera.getWorldDirection(_focusWorld);
      const lookScale = Math.abs(_focusWorld.y) > 0.15 ? camera.position.y / -_focusWorld.y : 40;
      const clampedScale = THREE.MathUtils.clamp(lookScale, 8, 95);
      fx = camera.position.x + _focusWorld.x * clampedScale;
      fz = camera.position.z + _focusWorld.z * clampedScale;
    }

    const moved = Math.hypot(fx - lastQueryPosRef.current.x, fz - lastQueryPosRef.current.z);
    if (moved < 5.5 && lastQueryPosRef.current.sel === selectedExpansionPlotId) {
      lastQueryPosRef.current.t = t;
      return;
    }

    lastQueryPosRef.current = { x: fx, z: fz, sel: selectedExpansionPlotId, t };
    setFocusPos({ x: fx, z: fz });

    const near = queryNearbyExpansionPlots(world.spatialIndex, fx, fz, 76)
      .filter((p) => p.status !== 'vip' && p.houseStyle !== null)
      .sort((a, b) => Math.hypot(a.x - fx, a.z - fz) - Math.hypot(b.x - fx, b.z - fz))
      .slice(0, 12);

    if (selectedExpansionPlotId) {
      const selPlot = world.plotById.get(selectedExpansionPlotId);
      if (
        selPlot &&
        selPlot.status !== 'vip' &&
        selPlot.houseStyle &&
        !near.some((n) => n.plotId === selPlot.plotId)
      ) {
        near.unshift(selPlot);
      }
    }

    setDetailedPlots(near);
  });

  const visibleOgSigns = useMemo(
    () =>
      world.ogPlots.filter(
        (p) =>
          p.status === 'og' &&
          (p.plotId === selectedExpansionPlotId ||
            Math.hypot(p.x - focusPos.x, p.z - focusPos.z) < 185),
      ),
    [world.ogPlots, focusPos, selectedExpansionPlotId],
  );

  const selectedPlot = selectedExpansionPlotId
    ? world.plotById.get(selectedExpansionPlotId) ?? null
    : null;

  return (
    <group>
      {/* Bespoke Special Districts, Venice Canals, 35 Bridges & 6 Neighborhood Parks */}
      <BotanicalAndWaterfront timeOfDay={timeOfDay} />
      <VeniceCanalsAndParksRenderer world={world} timeOfDay={timeOfDay} />
      <OGMonumentWall
        position={[world.monumentPosition.x, 0, world.monumentPosition.z]}
        ogMembers={world.ogPlots.map((p) => p.resident!).filter(Boolean)}
        timeOfDay={timeOfDay}
        onOpenMonumentModal={onOpenMonumentModal}
      />
      {world.vipPlot && (
        <SweetTheDevilPalace
          plot={world.vipPlot}
          timeOfDay={timeOfDay}
          isSelected={selectedExpansionPlotId === world.vipPlot.plotId}
          onSelect={onSelectExpansionPlot}
        />
      )}

      {/* Nearby OG 02..50 Gold Nameplate Signs Outside OG Mansions (distance-culled) */}
      {visibleOgSigns.map((p) => {
        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const doorZ = p.depth / 2 - 0.06;
        const sx = p.x - 2.95 * cos + doorZ * sin;
        const sz = p.z + 2.95 * sin + doorZ * cos;
        return (
          <PlotNameplateSign
            key={`ognp-${p.plotId}`}
            position={[sx, SIDEWALK_HEIGHT, sz]}
            rotationY={p.facingAngle}
            plotCode={p.plotCode}
            ownerUsername={p.resident?.username ?? null}
            tier="og-50"
          />
        );
      })}

      {/* High-Detail Articulated Proximity Houses + Parked Driveway Cars + Instagram Nameplates */}
      {detailedPlots.map((p) => {
        const { hx, hz } = getHouseOrigin(p);
        const isOg = p.status === 'og';
        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const doorZ = p.depth / 2 - 0.04;
        const sx = p.x - 2.42 * cos + doorZ * sin;
        const sz = p.z + 2.42 * sin + doorZ * cos;

        const styleSpec = p.houseStyle!;
        const showParkedCar = styleSpec.hasGarageCarport;
        const carLocalX = isOg
          ? Math.min(p.width / 2 - 2.4, styleSpec.width / 2 + 1.45)
          : Math.min(p.width / 2 - 1.9, -0.9 + styleSpec.width / 2 + 1.45);
        const carLocalZ = isOg ? p.depth / 2 - 3.8 : p.depth / 2 - 2.55;
        const cx = p.x + carLocalX * cos + carLocalZ * sin;
        const cz = p.z - carLocalX * sin + carLocalZ * cos;
        const carScale = isOg ? 0.96 : 0.84;
        const carColors = ['#2b4c6f', '#c93c34', '#d8d5cd', '#395a49', '#3f4754', '#b57b3b'];
        const carStyles: Array<'sedan' | 'hatchback' | 'wagon'> = ['sedan', 'hatchback', 'wagon'];
        const hashNum = p.plotCode.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

        return (
          <group
            key={`lod-${p.plotId}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectExpansionPlot(p);
            }}
          >
            <group position={[hx, SIDEWALK_HEIGHT, hz]} rotation={[0, p.facingAngle, 0]}>
              <HouseModel
                spec={styleSpec}
                textures={textures}
                timeOfDay={timeOfDay}
                doorOpen={Boolean(openDoors[p.plotId])}
                houseNumber={p.plotCode}
              />
            </group>
            {showParkedCar && (
              <group
                position={[cx, SIDEWALK_HEIGHT, cz]}
                rotation={[0, p.facingAngle, 0]}
                scale={carScale}
              >
                <CarMesh
                  color={carColors[hashNum % carColors.length]}
                  style={carStyles[hashNum % carStyles.length]}
                  timeOfDay={timeOfDay}
                />
              </group>
            )}
            {!isOg && (
              <PlotNameplateSign
                position={[sx, SIDEWALK_HEIGHT, sz]}
                rotationY={p.facingAngle}
                plotCode={p.plotCode}
                ownerUsername={p.resident?.username ?? null}
                tier="resident"
              />
            )}
          </group>
        );
      })}

      {/* Selected Expansion Plot Gold Perimeter Frame */}
      {selectedPlot && selectedPlot.status !== 'vip' && (
        <group
          position={[selectedPlot.x, SIDEWALK_HEIGHT + 0.08, selectedPlot.z]}
          rotation={[0, selectedPlot.facingAngle, 0]}
        >
          <mesh position={[0, 0, selectedPlot.depth / 2 - 0.15]}>
            <boxGeometry args={[selectedPlot.width, 0.05, 0.3]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
          <mesh position={[0, 0, -selectedPlot.depth / 2 + 0.15]}>
            <boxGeometry args={[selectedPlot.width, 0.05, 0.3]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
          <mesh position={[-selectedPlot.width / 2 + 0.15, 0, 0]}>
            <boxGeometry args={[0.3, 0.05, selectedPlot.depth]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
          <mesh position={[selectedPlot.width / 2 - 0.15, 0, 0]}>
            <boxGeometry args={[0.3, 0.05, selectedPlot.depth]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
        </group>
      )}

      {/* Road Network & Double Yellow Lines (layered Y + polygonOffset) */}
      {world.roads.length > 0 && (
        <instancedMesh
          ref={roadMeshRef}
          args={[undefined, undefined, world.roads.length]}
          receiveShadow
          frustumCulled
        >
          <boxGeometry args={[1, ROAD_SURFACE_Y, 1]} />
          <meshStandardMaterial
            map={textures.asphalt}
            color="#373c44"
            roughness={0.85}
            polygonOffset
            polygonOffsetFactor={1}
          />
        </instancedMesh>
      )}

      {mainAveRoads.length > 0 && (
        <instancedMesh
          ref={roadLineMeshRef}
          args={[undefined, undefined, mainAveRoads.length]}
          frustumCulled
        >
          <boxGeometry args={[1, 0.01, 1]} />
          <meshStandardMaterial
            color="#e5b84b"
            roughness={0.7}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </instancedMesh>
      )}

      {dashedCenterSegments.length > 0 && (
        <instancedMesh
          ref={dashedLineMeshRef}
          args={[undefined, undefined, dashedCenterSegments.length]}
          frustumCulled
        >
          <boxGeometry args={[1, 0.01, 1]} />
          <meshStandardMaterial
            color="#f1f5f9"
            roughness={0.7}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </instancedMesh>
      )}

      {crosswalkBars.length > 0 && (
        <instancedMesh
          ref={crosswalkMeshRef}
          args={[undefined, undefined, crosswalkBars.length]}
          frustumCulled
        >
          <boxGeometry args={[1, 0.012, 1]} />
          <meshStandardMaterial
            color="#f8fafc"
            roughness={0.68}
            polygonOffset
            polygonOffsetFactor={-3}
          />
        </instancedMesh>
      )}

      {/* Curvy Road Seamless Vertex Joints & Stone Curbs */}
      {curvyJoints.length > 0 && (
        <instancedMesh
          ref={curvyJointMeshRef}
          args={[undefined, undefined, curvyJoints.length]}
          receiveShadow
          frustumCulled
        >
          <cylinderGeometry args={[1, 1, ROAD_SURFACE_Y, 12]} />
          <meshStandardMaterial map={textures.asphalt} color="#373c44" roughness={0.85} />
        </instancedMesh>
      )}
      {curvyCurbs.length > 0 && (
        <instancedMesh
          ref={curvyCurbMeshRef}
          args={[sharedRes.unitBoxGeo, sharedRes.curbMat, curvyCurbs.length]}
          receiveShadow
          frustumCulled
        />
      )}

      {/* Road-Aligned Boulevard & Scenic Parkway Trees + Bushes */}
      {blvdTrees.length > 0 && (
        <>
          <instancedMesh
            ref={blvdTreeTrunkRef}
            args={[sharedRes.trunkGeo, sharedRes.trunkMat, blvdTrees.length]}
            frustumCulled
          />
          <instancedMesh
            ref={blvdTreeCrownRef}
            args={[sharedRes.canopyGeo, sharedRes.canopyMat, blvdTrees.length]}
            frustumCulled
          />
        </>
      )}
      {blvdBushes.length > 0 && (
        <instancedMesh ref={blvdBushRef} args={[undefined, undefined, blvdBushes.length]} frustumCulled>
          <dodecahedronGeometry args={[0.75, 0]} />
          <meshStandardMaterial color="#ffffff" roughness={0.88} />
        </instancedMesh>
      )}

      {/* Frustum-Culled Spatial Sectors for Sidewalks, Lamps, Pads, Houses & Trees */}
      {sectors.map((sector) => (
        <ExpansionSectorChunk
          key={sector.key}
          sector={sector}
          res={sharedRes}
          lampGlobeMat={lampGlobeMat}
          detailedPlots={detailedPlots}
          onSelectExpansionPlot={onSelectExpansionPlot}
        />
      ))}
    </group>
  );
};
