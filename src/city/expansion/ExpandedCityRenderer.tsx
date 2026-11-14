import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CityTextureSet } from '../materials/proceduralTextures';
import { HouseModel } from '../assets/HouseModel';
import { CarMesh } from '../assets/VehicleModels';
import { ROAD_SURFACE_Y, SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';
import { CameraMode, TimeOfDay } from '../types';
import { ExpansionCityWorld, getExpansionHouseMetrics, queryNearbyExpansionPlots } from './ExpansionMasterPlan';
export { getExpansionHouseMetrics };
import { CurvedRoadSplineSpec, ExpansionDistrictId, ExpansionPlotSpec, RoundaboutSpec } from './types';
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

const SECTOR_SIZE = 340;
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _focusWorld = new THREE.Vector3();

function getSectorKey(x: number, z: number): string {
  const sx = Math.floor((x + 1200) / SECTOR_SIZE);
  const sz = Math.floor((z + 900) / SECTOR_SIZE);
  return `${sx},${sz}`;
}

function getHouseOrigin(plot: ExpansionPlotSpec): { hx: number; hz: number } {
  const m = getExpansionHouseMetrics(plot);
  const sin = Math.sin(plot.facingAngle);
  const cos = Math.cos(plot.facingAngle);
  return {
    hx: plot.x + m.houseLocalX * cos + m.houseLocalZ * sin,
    hz: plot.z - m.houseLocalX * sin + m.houseLocalZ * cos,
  };
}

function isGableArchetype(arch: string): boolean {
  return (
    arch === 'modern-family' ||
    arch === 'suburban-two-storey' ||
    arch === 'traditional-home' ||
    arch === 'tudor' ||
    arch === 'townhouse' ||
    arch === 'nordic'
  );
}

function isFlatArchetype(arch: string): boolean {
  return (
    arch === 'modern-villa' ||
    arch === 'luxury-modern' ||
    arch === 'contemporary-villa' ||
    arch === 'modern-minimalist'
  );
}

function createGableRoofGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0, 1);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  geo.translate(0, 0, -0.5);
  geo.computeVertexNormals();
  return geo;
}

// -----------------------------------------------------------------------------
// Smooth Curved Road Ribbon Geometry Builder (Asphalt, Sidewalks, Green Strips, Markings)
// -----------------------------------------------------------------------------
function pushQuad(
  pos: number[],
  norm: number[],
  uvs: number[],
  idx: number[],
  ax: number, ay: number, az: number, au: number, av: number,
  bx: number, by: number, bz: number, bu: number, bv: number,
  cx: number, cy: number, cz: number, cu: number, cv: number,
  dx: number, dy: number, dz: number, du: number, dv: number,
  nx: number, ny: number, nz: number,
) {
  const base = pos.length / 3;
  pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
  for (let i = 0; i < 4; i++) norm.push(nx, ny, nz);
  uvs.push(au, av, bu, bv, cu, cv, du, dv);
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function finalizeGeometry(pos: number[], norm: number[], uvs: number[], idx: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

function buildCurvedRoadGeometries(curvedRoads: CurvedRoadSplineSpec[]) {
  const aPos: number[] = [], aNorm: number[] = [], aUv: number[] = [], aIdx: number[] = [];
  const gPos: number[] = [], gNorm: number[] = [], gUv: number[] = [], gIdx: number[] = [];
  const sPos: number[] = [], sNorm: number[] = [], sUv: number[] = [], sIdx: number[] = [];
  const yPos: number[] = [], yNorm: number[] = [], yUv: number[] = [], yIdx: number[] = [];
  const wPos: number[] = [], wNorm: number[] = [], wUv: number[] = [], wIdx: number[] = [];

  const roadY = ROAD_SURFACE_Y;
  const greenY = SIDEWALK_HEIGHT - 0.026;
  const swY = SIDEWALK_HEIGHT - 0.015;
  const markY = ROAD_SURFACE_Y + 0.016;

  for (const road of curvedRoads) {
    const pts = road.sampledPoints;
    if (pts.length < 2) continue;

    const halfW = road.width * 0.5;
    const greenOuter = halfW + road.greenStripWidth;
    const swOuter = greenOuter + road.sidewalkWidth;

    // Precompute smooth normals & cumulative arc distance at each sampled vertex
    const nxs: number[] = [];
    const nzs: number[] = [];
    const arcS: number[] = [0];
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) {
        arcS.push(arcS[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
      }
      const pPrev = pts[Math.max(0, i - 1)];
      const pNext = pts[Math.min(pts.length - 1, i + 1)];
      const tx = pNext.x - pPrev.x;
      const tz = pNext.z - pPrev.z;
      const len = Math.hypot(tx, tz) || 1;
      nxs.push(-tz / len);
      nzs.push(tx / len);
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const nx0 = nxs[i], nz0 = nzs[i];
      const nx1 = nxs[i + 1], nz1 = nzs[i + 1];
      const v0 = arcS[i] / 6;
      const v1 = arcS[i + 1] / 6;

      // 1. Main curved asphalt carriage ribbon
      pushQuad(
        aPos, aNorm, aUv, aIdx,
        p0.x - nx0 * halfW, roadY, p0.z - nz0 * halfW, 0, v0,
        p0.x + nx0 * halfW, roadY, p0.z + nz0 * halfW, 1, v0,
        p1.x + nx1 * halfW, roadY, p1.z + nz1 * halfW, 1, v1,
        p1.x - nx1 * halfW, roadY, p1.z - nz1 * halfW, 0, v1,
        0, 1, 0,
      );

      // 2. Left & right roadside green strips & raised sidewalks with inner curb faces
      for (const side of [-1, 1] as const) {
        const i0x = p0.x + side * nx0 * halfW;
        const i0z = p0.z + side * nz0 * halfW;
        const i1x = p1.x + side * nx1 * halfW;
        const i1z = p1.z + side * nz1 * halfW;

        const m0x = p0.x + side * nx0 * greenOuter;
        const m0z = p0.z + side * nz0 * greenOuter;
        const m1x = p1.x + side * nx1 * greenOuter;
        const m1z = p1.z + side * nz1 * greenOuter;

        const o0x = p0.x + side * nx0 * swOuter;
        const o0z = p0.z + side * nz0 * swOuter;
        const o1x = p1.x + side * nx1 * swOuter;
        const o1z = p1.z + side * nz1 * swOuter;

        // Green strip top
        if (side > 0) {
          pushQuad(
            gPos, gNorm, gUv, gIdx,
            i0x, greenY, i0z, 0, v0,
            m0x, greenY, m0z, 1, v0,
            m1x, greenY, m1z, 1, v1,
            i1x, greenY, i1z, 0, v1,
            0, 1, 0,
          );
          // Raised sidewalk top
          pushQuad(
            sPos, sNorm, sUv, sIdx,
            m0x, swY, m0z, 0, v0,
            o0x, swY, o0z, 1, v0,
            o1x, swY, o1z, 1, v1,
            m1x, swY, m1z, 0, v1,
            0, 1, 0,
          );
          // Curb riser along road edge
          pushQuad(
            sPos, sNorm, sUv, sIdx,
            i0x, 0, i0z, 0, v0,
            i0x, greenY, i0z, 0.2, v0,
            i1x, greenY, i1z, 0.2, v1,
            i1x, 0, i1z, 0, v1,
            -nx0, 0, -nz0,
          );
        } else {
          pushQuad(
            gPos, gNorm, gUv, gIdx,
            m0x, greenY, m0z, 0, v0,
            i0x, greenY, i0z, 1, v0,
            i1x, greenY, i1z, 1, v1,
            m1x, greenY, m1z, 0, v1,
            0, 1, 0,
          );
          pushQuad(
            sPos, sNorm, sUv, sIdx,
            o0x, swY, o0z, 0, v0,
            m0x, swY, m0z, 1, v0,
            m1x, swY, m1z, 1, v1,
            o1x, swY, o1z, 0, v1,
            0, 1, 0,
          );
          pushQuad(
            sPos, sNorm, sUv, sIdx,
            i0x, greenY, i0z, 0.2, v0,
            i0x, 0, i0z, 0, v0,
            i1x, 0, i1z, 0, v1,
            i1x, greenY, i1z, 0.2, v1,
            nx0, 0, nz0,
          );
        }
      }

      // 3. Road Markings
      if (road.hasDoubleCenterLine) {
        for (const offset of [-0.15, 0.15]) {
          const hw = 0.055;
          pushQuad(
            yPos, yNorm, yUv, yIdx,
            p0.x + nx0 * (offset - hw), markY, p0.z + nz0 * (offset - hw), 0, v0,
            p0.x + nx0 * (offset + hw), markY, p0.z + nz0 * (offset + hw), 1, v0,
            p1.x + nx1 * (offset + hw), markY, p1.z + nz1 * (offset + hw), 1, v1,
            p1.x + nx1 * (offset - hw), markY, p1.z + nz1 * (offset - hw), 0, v1,
            0, 1, 0,
          );
        }
      } else if (road.hasDashedCenterLine && i % 2 === 0) {
        const hw = 0.075;
        pushQuad(
          wPos, wNorm, wUv, wIdx,
          p0.x - nx0 * hw, markY, p0.z - nz0 * hw, 0, v0,
          p0.x + nx0 * hw, markY, p0.z + nz0 * hw, 1, v0,
          p1.x + nx1 * hw, markY, p1.z + nz1 * hw, 1, v1,
          p1.x - nx1 * hw, markY, p1.z - nz1 * hw, 0, v1,
          0, 1, 0,
        );
      }
    }
  }

  return {
    asphaltGeo: finalizeGeometry(aPos, aNorm, aUv, aIdx),
    greenStripGeo: finalizeGeometry(gPos, gNorm, gUv, gIdx),
    sidewalkGeo: finalizeGeometry(sPos, sNorm, sUv, sIdx),
    yellowLineGeo: finalizeGeometry(yPos, yNorm, yUv, yIdx),
    whiteDashGeo: finalizeGeometry(wPos, wNorm, wUv, wIdx),
  };
}

// -----------------------------------------------------------------------------
// Chunked Texture-Atlas 3D Signboards Displaying Every Resident's @username (~3,446 signs)
// -----------------------------------------------------------------------------
const ATLAS_COLS = 12;
const ATLAS_ROWS = 42;
const BATCH_CAP = ATLAS_COLS * ATLAS_ROWS; // 504 signs per 2048x2048 atlas

interface SignBatch {
  geo: THREE.BufferGeometry;
  tex: THREE.CanvasTexture;
  mat: THREE.MeshStandardMaterial;
}

function buildNameplateAtlasBatches(plots: ExpansionPlotSpec[]): SignBatch[] {
  const namedPlots = plots.filter((p) => p.status !== 'vip' && p.resident !== null);
  const batches: SignBatch[] = [];
  if (typeof document === 'undefined' || namedPlots.length === 0) return batches;

  const canvasW = 2048;
  const canvasH = 2048;
  const cellW = Math.floor(canvasW / ATLAS_COLS); // 170
  const cellH = Math.floor(canvasH / ATLAS_ROWS); // 48

  for (let start = 0; start < namedPlots.length; start += BATCH_CAP) {
    const slice = namedPlots.slice(start, start + BATCH_CAP);
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvasW, canvasH);

      for (let i = 0; i < slice.length; i++) {
        const p = slice[i];
        const col = i % ATLAS_COLS;
        const row = Math.floor(i / ATLAS_COLS);
        const x0 = col * cellW;
        const y0 = row * cellH;
        const isOg = p.status === 'og';

        ctx.fillStyle = isOg ? '#1f1608' : '#111b2e';
        ctx.fillRect(x0 + 2, y0 + 2, cellW - 4, cellH - 4);
        ctx.strokeStyle = isOg ? '#f59e0b' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 + 3, y0 + 3, cellW - 6, cellH - 6);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isOg ? '#fcd34d' : '#93c5fd';
        ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(p.plotCode, x0 + cellW * 0.5, y0 + 14);

        const rawUser = `@${p.resident!.username.replace(/^@/, '')}`;
        const clipped = rawUser.length > 17 ? `${rawUser.slice(0, 15)}..` : rawUser;
        ctx.fillStyle = '#f8fafc';
        ctx.font = '800 15px system-ui, -apple-system, sans-serif';
        ctx.fillText(clipped, x0 + cellW * 0.5, y0 + 33);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;

    const pos: number[] = [];
    const norm: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];

    const boardW = 1.18;
    const boardH = 0.36;
    const tilt = -0.26; // Slight upward tilt so signs read clearly from street & isometric view
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);

    for (let i = 0; i < slice.length; i++) {
      const p = slice[i];
      const m = getExpansionHouseMetrics(p);
      const col = i % ATLAS_COLS;
      const row = Math.floor(i / ATLAS_COLS);

      // UV mapping for CanvasTexture (flipY = true: top row -> V near 1)
      const u0 = (col * cellW + 2) / canvasW;
      const u1 = ((col + 1) * cellW - 2) / canvasW;
      const vTop = 1 - (row * cellH + 2) / canvasH;
      const vBot = 1 - ((row + 1) * cellH - 2) / canvasH;

      const sin = Math.sin(p.facingAngle);
      const cos = Math.cos(p.facingAngle);
      const signLocalX = m.walkwayX - (m.isOg ? 2.55 : 2.05);
      const signLocalZ = p.depth / 2 - 0.14;
      const cx = p.x + signLocalX * cos + signLocalZ * sin;
      const cy = SIDEWALK_HEIGHT + (m.isOg ? 0.98 : 0.9);
      const cz = p.z - signLocalX * sin + signLocalZ * cos;

      // Local tilted front quad corners -> rotated around Y by p.facingAngle
      const hw = boardW * 0.5;
      const hh = boardH * 0.5;
      const corners = [
        [-hw, -hh, 0.06],
        [hw, -hh, 0.06],
        [hw, hh, 0.06],
        [-hw, hh, 0.06],
      ];

      const worldCorners: Array<[number, number, number]> = corners.map(([lx, ly, lz]) => {
        // Tilt around local X
        const ty = ly * cosT - lz * sinT;
        const tz = ly * sinT + lz * cosT;
        // Rotate around Y by facingAngle
        return [
          cx + lx * cos + tz * sin,
          cy + ty,
          cz - lx * sin + tz * cos,
        ];
      });

      const nrmX = sin * cosT;
      const nrmY = -sinT;
      const nrmZ = cos * cosT;

      pushQuad(
        pos, norm, uvs, idx,
        worldCorners[0][0], worldCorners[0][1], worldCorners[0][2], u0, vBot,
        worldCorners[1][0], worldCorners[1][1], worldCorners[1][2], u1, vBot,
        worldCorners[2][0], worldCorners[2][1], worldCorners[2][2], u1, vTop,
        worldCorners[3][0], worldCorners[3][1], worldCorners[3][2], u0, vTop,
        nrmX, nrmY, nrmZ,
      );
    }

    const geo = finalizeGeometry(pos, norm, uvs, idx);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.42,
      metalness: 0.12,
      side: THREE.DoubleSide,
    });

    batches.push({ geo, tex, mat });
  }

  return batches;
}

// -----------------------------------------------------------------------------
// Circular Neighborhood Roundabouts Mesh
// -----------------------------------------------------------------------------
const RoundaboutsLayer: React.FC<{
  roundabouts: RoundaboutSpec[];
  textures: CityTextureSet;
}> = React.memo(({ roundabouts, textures }) => {
  return (
    <group>
      {roundabouts.map((rb) => {
        const outerRoadR = rb.innerRadius + rb.roadWidth;
        const outerSwR = outerRoadR + rb.sidewalkWidth;
        return (
          <group key={rb.id} position={[rb.x, 0, rb.z]}>
            {/* Outer pedestrian sidewalk ring */}
            <mesh position={[0, (SIDEWALK_HEIGHT - 0.012) / 2, 0]} receiveShadow>
              <cylinderGeometry args={[outerSwR, outerSwR, SIDEWALK_HEIGHT - 0.012, 32]} />
              <meshStandardMaterial
                map={textures.sidewalkStone}
                color="#d6d0c4"
                roughness={0.85}
                polygonOffset
                polygonOffsetFactor={2}
              />
            </mesh>
            {/* Circular asphalt ring */}
            <mesh position={[0, ROAD_SURFACE_Y + 0.006, 0]} receiveShadow>
              <cylinderGeometry args={[outerRoadR, outerRoadR, 0.02, 32]} />
              <meshStandardMaterial
                map={textures.asphalt}
                color="#373c44"
                roughness={0.85}
                polygonOffset
                polygonOffsetFactor={-1}
              />
            </mesh>
            {/* Dashed circular lane guide */}
            <mesh position={[0, ROAD_SURFACE_Y + 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry
                args={[
                  rb.innerRadius + rb.roadWidth * 0.49,
                  rb.innerRadius + rb.roadWidth * 0.51,
                  32,
                ]}
              />
              <meshStandardMaterial color="#e5b84b" roughness={0.7} />
            </mesh>
            {/* Central landscaped curb & lush grass island */}
            <mesh position={[0, SIDEWALK_HEIGHT / 2 + 0.01, 0]} receiveShadow>
              <cylinderGeometry args={[rb.innerRadius + 0.35, rb.innerRadius + 0.45, SIDEWALK_HEIGHT + 0.02, 28]} />
              <meshStandardMaterial color="#cfc7b7" roughness={0.84} />
            </mesh>
            <mesh position={[0, SIDEWALK_HEIGHT + 0.03, 0]} receiveShadow>
              <cylinderGeometry args={[rb.innerRadius - 0.2, rb.innerRadius - 0.2, 0.04, 28]} />
              <meshStandardMaterial color="#5b9146" roughness={0.92} />
            </mesh>
            {rb.hasFountain ? (
              <group position={[0, SIDEWALK_HEIGHT + 0.05, 0]}>
                <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[3.4, 3.8, 0.56, 20]} />
                  <meshStandardMaterial color="#ddd6c8" roughness={0.74} />
                </mesh>
                <mesh position={[0, 0.58, 0]}>
                  <cylinderGeometry args={[2.8, 2.8, 0.08, 20]} />
                  <meshStandardMaterial color="#38bdf8" roughness={0.14} metalness={0.2} />
                </mesh>
                <mesh position={[0, 1.35, 0]} castShadow>
                  <cylinderGeometry args={[0.35, 0.6, 1.5, 12]} />
                  <meshStandardMaterial color="#e6dfd2" roughness={0.68} />
                </mesh>
                <mesh position={[0, 2.2, 0]}>
                  <cylinderGeometry args={[1.15, 0.4, 0.35, 14]} />
                  <meshStandardMaterial color="#f1ebe0" roughness={0.68} />
                </mesh>
              </group>
            ) : (
              <group position={[0, SIDEWALK_HEIGHT + 0.05, 0]}>
                <mesh position={[0, 1.4, 0]} castShadow>
                  <cylinderGeometry args={[0.25, 0.38, 2.8, 8]} />
                  <meshStandardMaterial color="#61442d" roughness={0.9} />
                </mesh>
                <mesh position={[0, 3.4, 0]} castShadow>
                  <dodecahedronGeometry args={[2.2, 1]} />
                  <meshStandardMaterial color="#4f8545" roughness={0.85} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
});

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

interface ExteriorBoxSpec {
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
  gableRoofPlots: ExpansionPlotSpec[];
  hipRoofPlots: ExpansionPlotSpec[];
  flatRoofPlots: ExpansionPlotSpec[];
  garagePlots: ExpansionPlotSpec[];
  chimneyPlots: ExpansionPlotSpec[];
  balconyPlots: ExpansionPlotSpec[];
  poolPlots: ExpansionPlotSpec[];
  carPlots: ExpansionPlotSpec[];
  treesData: Array<{ x: number; z: number; scale: number; tint: string }>;
  houseIdxById: Map<string, number>;
  gableIdxById: Map<string, number>;
  hipIdxById: Map<string, number>;
  flatIdxById: Map<string, number>;
  garageIdxById: Map<string, number>;
  carIdxById: Map<string, number>;
}

interface SharedSectorResources {
  unitBoxGeo: THREE.BoxGeometry;
  sidewalkBoxGeo: THREE.BoxGeometry;
  padBoxGeo: THREE.BoxGeometry;
  lampPoleGeo: THREE.CylinderGeometry;
  lampGlobeGeo: THREE.SphereGeometry;
  gableRoofGeo: THREE.BufferGeometry;
  hipRoofGeo: THREE.ConeGeometry;
  signBoardGeo: THREE.BoxGeometry;
  trunkGeo: THREE.BufferGeometry;
  canopyGeo: THREE.BufferGeometry;
  shrubGeo: THREE.DodecahedronGeometry;
  fenceHeritageBayGeo: THREE.BufferGeometry;
  fenceModernBayGeo: THREE.BufferGeometry;
  fenceTimberBayGeo: THREE.BufferGeometry;
  sidewalkMat: THREE.MeshStandardMaterial;
  lampPoleMat: THREE.MeshStandardMaterial;
  padMat: THREE.MeshStandardMaterial;
  plinthMat: THREE.MeshStandardMaterial;
  drivewayMat: THREE.MeshStandardMaterial;
  curbMat: THREE.MeshStandardMaterial;
  fencePlinthMat: THREE.MeshStandardMaterial;
  fenceBayMat: THREE.MeshStandardMaterial;
  fencePillarMat: THREE.MeshStandardMaterial;
  wallMat: THREE.MeshStandardMaterial;
  pitchedRoofMat: THREE.MeshStandardMaterial;
  flatRoofMat: THREE.MeshStandardMaterial;
  trimMat: THREE.MeshStandardMaterial;
  doorMat: THREE.MeshStandardMaterial;
  garageDoorMat: THREE.MeshStandardMaterial;
  chimneyMat: THREE.MeshStandardMaterial;
  balconyMat: THREE.MeshStandardMaterial;
  poolMat: THREE.MeshStandardMaterial;
  signPostMat: THREE.MeshStandardMaterial;
  soilMat: THREE.MeshStandardMaterial;
  flowerMat: THREE.MeshStandardMaterial;
  carBodyMat: THREE.MeshStandardMaterial;
  carCabinMat: THREE.MeshStandardMaterial;
  trunkMat: THREE.MeshStandardMaterial;
  canopyMat: THREE.MeshStandardMaterial;
}

const ExpansionSectorChunk: React.FC<{
  sector: SectorBucket;
  res: SharedSectorResources;
  lampGlobeMat: THREE.MeshStandardMaterial;
  windowMat: THREE.MeshStandardMaterial;
  detailedPlots: ExpansionPlotSpec[];
  onSelectExpansionPlot: (plot: ExpansionPlotSpec) => void;
}> = React.memo(({ sector, res, lampGlobeMat, windowMat, detailedPlots, onSelectExpansionPlot }) => {
  const sidewalkMeshRef = useRef<THREE.InstancedMesh>(null);
  const lampPoleMeshRef = useRef<THREE.InstancedMesh>(null);
  const lampGlobeMeshRef = useRef<THREE.InstancedMesh>(null);
  const padMeshRef = useRef<THREE.InstancedMesh>(null);

  // Exterior & Ground
  const walkwayMeshRef = useRef<THREE.InstancedMesh>(null);
  const drivewayMeshRef = useRef<THREE.InstancedMesh>(null);
  const curbMeshRef = useRef<THREE.InstancedMesh>(null);
  const fencePlinthMeshRef = useRef<THREE.InstancedMesh>(null);
  const fenceHeritageMeshRef = useRef<THREE.InstancedMesh>(null);
  const fenceModernMeshRef = useRef<THREE.InstancedMesh>(null);
  const fenceTimberMeshRef = useRef<THREE.InstancedMesh>(null);
  const fencePillarMeshRef = useRef<THREE.InstancedMesh>(null);
  const fenceCapMeshRef = useRef<THREE.InstancedMesh>(null);
  const fenceGateMeshRef = useRef<THREE.InstancedMesh>(null);
  const flowerbedSoilRef = useRef<THREE.InstancedMesh>(null);
  const flowerBloomRef = useRef<THREE.InstancedMesh>(null);
  const shrubMeshRef = useRef<THREE.InstancedMesh>(null);
  const mailboxMeshRef = useRef<THREE.InstancedMesh>(null);

  // Houses (multi-part 3D architecture)
  const plinthMeshRef = useRef<THREE.InstancedMesh>(null);
  const wallMeshRef = useRef<THREE.InstancedMesh>(null);
  const trimMeshRef = useRef<THREE.InstancedMesh>(null);
  const gableRoofMeshRef = useRef<THREE.InstancedMesh>(null);
  const hipRoofMeshRef = useRef<THREE.InstancedMesh>(null);
  const flatRoofMeshRef = useRef<THREE.InstancedMesh>(null);
  const clereRoofMeshRef = useRef<THREE.InstancedMesh>(null);
  const garageBodyMeshRef = useRef<THREE.InstancedMesh>(null);
  const garageRoofMeshRef = useRef<THREE.InstancedMesh>(null);
  const garageDoorMeshRef = useRef<THREE.InstancedMesh>(null);
  const porchCanopyMeshRef = useRef<THREE.InstancedMesh>(null);
  const stepsMeshRef = useRef<THREE.InstancedMesh>(null);
  const doorMeshRef = useRef<THREE.InstancedMesh>(null);
  const windowMeshRef = useRef<THREE.InstancedMesh>(null);
  const sconceMeshRef = useRef<THREE.InstancedMesh>(null);
  const chimneyMeshRef = useRef<THREE.InstancedMesh>(null);
  const balconyMeshRef = useRef<THREE.InstancedMesh>(null);
  const poolMeshRef = useRef<THREE.InstancedMesh>(null);

  // Vehicles & Landscaping
  const carBodyMeshRef = useRef<THREE.InstancedMesh>(null);
  const carCabinMeshRef = useRef<THREE.InstancedMesh>(null);
  const signPostMeshRef = useRef<THREE.InstancedMesh>(null);
  const trunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const canopyMeshRef = useRef<THREE.InstancedMesh>(null);

  const suppressedIdsRef = useRef<Set<string>>(new Set());
  const { camera } = useThree();
  const fineLodVisibleRef = useRef(true);
  const lastLodCheckRef = useRef(-10);

  const sectorCenter = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const visit = (x: number, z: number) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    };
    for (const p of sector.plots) visit(p.x, p.z);
    for (const sw of sector.sidewalks) visit(sw.x, sw.z);
    for (const l of sector.lamps) visit(l.x, l.z);
    if (!Number.isFinite(minX)) return { x: 0, z: 0 };
    return { x: (minX + maxX) * 0.5, z: (minZ + maxZ) * 0.5 };
  }, [sector]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (t - lastLodCheckRef.current < 0.25) return;
    lastLodCheckRef.current = t;
    const dx = camera.position.x - sectorCenter.x;
    const dz = camera.position.z - sectorCenter.z;
    const distSq = dx * dx + dz * dz;
    const thresholdSq = fineLodVisibleRef.current ? 620 * 620 : 580 * 580;
    const nextVisible = distSq <= thresholdSq;
    if (nextVisible === fineLodVisibleRef.current) return;
    fineLodVisibleRef.current = nextVisible;
    const fineRefs = [
      fencePlinthMeshRef.current,
      fenceHeritageMeshRef.current,
      fenceModernMeshRef.current,
      fenceTimberMeshRef.current,
      fencePillarMeshRef.current,
      fenceCapMeshRef.current,
      fenceGateMeshRef.current,
      flowerbedSoilRef.current,
      flowerBloomRef.current,
      shrubMeshRef.current,
      sconceMeshRef.current,
      mailboxMeshRef.current,
      balconyMeshRef.current,
      signPostMeshRef.current,
    ];
    for (const mesh of fineRefs) {
      if (mesh) mesh.visible = nextVisible;
    }
  });

  const exteriorData = useMemo(() => {
    const curbs: FenceTransformSpec[] = [];
    const plinths: FenceTransformSpec[] = [];
    const heritageBays: FenceTransformSpec[] = [];
    const modernBays: FenceTransformSpec[] = [];
    const timberBays: FenceTransformSpec[] = [];
    const pillars: FenceTransformSpec[] = [];
    const caps: FenceTransformSpec[] = [];
    const gates: FenceTransformSpec[] = [];
    const flowerSoils: ExteriorBoxSpec[] = [];
    const flowerBlooms: ExteriorBoxSpec[] = [];
    const shrubs: ExteriorBoxSpec[] = [];

    for (const p of sector.housePlots) {
      const s = p.houseStyle!;
      const m = getExpansionHouseMetrics(p);
      const isOg = m.isOg;
      const sin = Math.sin(p.facingAngle);
      const cos = Math.cos(p.facingAngle);
      const toWorld = (lx: number, lz: number) => ({
        wx: p.x + lx * cos + lz * sin,
        wz: p.z - lx * sin + lz * cos,
      });

      const halfD = p.depth / 2;
      const pathW = isOg ? 3.1 : 2.1;
      const gateHalf = isOg ? 1.75 : 1.25;
      const inset = isOg ? 0.34 : 0.2;
      const fw = p.width / 2 - inset;
      const fd = halfD - inset;

      // Pathway border curbs flanking walkway
      const curbStartZ = Math.max(0.4, m.houseLocalZ + s.depth / 2 - 0.1);
      const curbEndZ = halfD - 0.04;
      const curbLen = Math.max(1.0, curbEndZ - curbStartZ);
      const curbCenterZ = (curbStartZ + curbEndZ) / 2;
      for (const side of [-1, 1]) {
        const { wx, wz } = toWorld(m.walkwayX + side * (pathW / 2 + 0.05), curbCenterZ);
        curbs.push({
          x: wx,
          y: SIDEWALK_HEIGHT + 0.02,
          z: wz,
          rotY: p.facingAngle,
          sx: 0.11,
          sy: 0.04,
          sz: curbLen,
          color: '#b7afa1',
        });
      }

      // Front garden flowerbed + blooms on the left yard beside steps
      const bedX = Math.max(-fw + 1.5, m.walkwayX - 2.35);
      const bedZ = halfD - 1.35;
      const bedPos = toWorld(bedX, bedZ);
      flowerSoils.push({
        x: bedPos.wx,
        y: SIDEWALK_HEIGHT + 0.06,
        z: bedPos.wz,
        rotY: p.facingAngle,
        sx: 2.1,
        sy: 0.1,
        sz: 0.95,
        color: '#4e3725',
      });
      flowerBlooms.push({
        x: bedPos.wx,
        y: SIDEWALK_HEIGHT + 0.15,
        z: bedPos.wz,
        rotY: p.facingAngle,
        sx: 1.85,
        sy: 0.12,
        sz: 0.72,
        color: p.gardenFlowerTint,
      });

      // Twin decorative yard shrubs flanking the front corners of the house
      for (const sideX of [-s.width * 0.42, s.width * 0.35]) {
        const shPos = toWorld(m.houseLocalX + sideX, m.houseLocalZ + s.depth / 2 + 0.48);
        shrubs.push({
          x: shPos.wx,
          y: SIDEWALK_HEIGHT + 0.25,
          z: shPos.wz,
          rotY: p.facingAngle + sideX,
          sx: 0.62,
          sy: 0.45,
          sz: 0.62,
          color: '#3f763a',
        });
      }

      const style = getFenceStyleForArchetype(s.archetype);
      const plinthColor =
        s.archetype === 'luxury-modern' || s.archetype === 'modern-minimalist'
          ? '#434952'
          : isOg
            ? '#ddd5c6'
            : '#d2cbc0';
      const plinthH = style === 'heritage-iron' ? 0.26 : style === 'modern-slat' ? 0.22 : 0.18;
      const bayColor =
        style === 'heritage-iron'
          ? '#232830'
          : style === 'modern-slat'
            ? s.archetype === 'luxury-modern' || s.archetype === 'modern-minimalist'
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

      const pillarOffset = 0.12;
      const openings: Array<{ start: number; end: number; hasGate: boolean }> = [
        { start: m.walkwayX - gateHalf, end: m.walkwayX + gateHalf, hasGate: true },
      ];
      if (m.hasGarage) {
        const dHalf = isOg ? 1.7 : 1.4;
        const dStart = m.drivewayX - dHalf;
        const dEnd = m.drivewayX + dHalf;
        if (dStart > openings[0].end + 0.2) {
          openings.push({ start: dStart, end: dEnd, hasGate: false });
        } else {
          openings[0].end = Math.max(openings[0].end, dEnd);
        }
      }
      openings.sort((a, b) => a.start - b.start);

      const runs: Array<[number, number, number, number]> = [
        [-fw, -fd, -fw, fd], // Left boundary
        [fw, -fd, fw, fd], // Right boundary
        [-fw, -fd, fw, -fd], // Rear boundary
      ];

      let cursorX = -fw;
      for (const op of openings) {
        const segEnd = Math.min(fw, op.start - pillarOffset);
        if (segEnd - cursorX > 0.25) {
          runs.push([cursorX, fd, segEnd, fd]);
        }
        cursorX = Math.max(cursorX, op.end + pillarOffset);
      }
      if (fw - cursorX > 0.25) {
        runs.push([cursorX, fd, fw, fd]);
      }

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
          sz: 0.14,
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

      // Corner Posts + Gate Pillars
      const postSpecs: Array<[number, number, number, number]> = [
        [-fw, -fd, 0.17, 1.08],
        [fw, -fd, 0.17, 1.08],
        [-fw, fd, 0.17, 1.08],
        [fw, fd, 0.17, 1.08],
      ];
      for (const op of openings) {
        const lx = Math.max(-fw + 0.15, op.start - pillarOffset);
        const rx = Math.min(fw - 0.15, op.end + pillarOffset);
        postSpecs.push([lx, fd, 0.23, 1.24], [rx, fd, 0.23, 1.24]);
      }

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
          y: SIDEWALK_HEIGHT + ph + 0.03,
          z: pwWorld.wz,
          rotY: p.facingAngle,
          sx: pw + 0.06,
          sy: 0.06,
          sz: pw + 0.06,
          color: capColor,
        });
      }

      // Twin open pedestrian gate leaves beside walkway
      const leafLen = isOg ? 1.1 : 0.85;
      for (const side of [-1, 1]) {
        const hingeX = m.walkwayX + side * gateHalf;
        const angle = side < 0 ? 1.5 : -1.5;
        const leafCenterLocalX = hingeX + (side < 0 ? 0.0707 : -0.0707) * (leafLen / 2);
        const leafCenterLocalZ = fd - 0.9975 * (leafLen / 2);
        const lw = toWorld(leafCenterLocalX, leafCenterLocalZ);
        gates.push({
          x: lw.wx,
          y: SIDEWALK_HEIGHT + 0.52,
          z: lw.wz,
          rotY: p.facingAngle + angle,
          sx: leafLen,
          sy: 0.8,
          sz: 0.05,
          color: style === 'heritage-iron' ? '#1f252d' : bayColor,
        });
      }
    }

    return {
      curbs,
      plinths,
      heritageBays,
      modernBays,
      timberBays,
      pillars,
      caps,
      gates,
      flowerSoils,
      flowerBlooms,
      shrubs,
    };
  }, [sector.housePlots]);

  // Helper: write or hide all instanced components belonging to a specific plot (for proximity LOD swap)
  const writePlotHouseInstances = React.useCallback(
    (p: ExpansionPlotSpec, hidden: boolean) => {
      const s = p.houseStyle;
      if (!s) return;
      const wi = sector.houseIdxById.get(p.plotId);
      if (wi === undefined) return;

      const m = getExpansionHouseMetrics(p);
      const { hx, hz } = getHouseOrigin(p);
      const sin = Math.sin(p.facingAngle);
      const cos = Math.cos(p.facingAngle);
      const toWorld = (lx: number, lz: number) => ({
        wx: p.x + lx * cos + lz * sin,
        wz: p.z - lx * sin + lz * cos,
      });

      const hideMat = () => {
        _dummy.position.set(0, -120, 0);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(0.0001, 0.0001, 0.0001);
        _dummy.updateMatrix();
      };

      // Plinth, Wall, Belt Trim, Porch, Steps, Door, Mailbox
      if (plinthMeshRef.current && wallMeshRef.current && trimMeshRef.current) {
        if (hidden) {
          hideMat();
          plinthMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          wallMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          trimMeshRef.current.setMatrixAt(wi, _dummy.matrix);
        } else {
          _dummy.position.set(hx, SIDEWALK_HEIGHT + 0.13, hz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(s.width + 0.22, 0.26, s.depth + 0.22);
          _dummy.updateMatrix();
          plinthMeshRef.current.setMatrixAt(wi, _dummy.matrix);

          _dummy.position.set(hx, SIDEWALK_HEIGHT + 0.26 + (s.wallHeight - 0.26) / 2, hz);
          _dummy.scale.set(s.width, s.wallHeight - 0.26, s.depth);
          _dummy.updateMatrix();
          wallMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          _color.set(s.wallColor);
          wallMeshRef.current.setColorAt(wi, _color);

          _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight * 0.52, hz);
          _dummy.scale.set(s.width + 0.12, 0.14, s.depth + 0.12);
          _dummy.updateMatrix();
          trimMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          _color.set(s.trimColor);
          trimMeshRef.current.setColorAt(wi, _color);
        }
      }

      if (porchCanopyMeshRef.current && stepsMeshRef.current && doorMeshRef.current && mailboxMeshRef.current) {
        if (hidden) {
          hideMat();
          porchCanopyMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          stepsMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          doorMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          mailboxMeshRef.current.setMatrixAt(wi, _dummy.matrix);
        } else {
          const frontZ = m.houseLocalZ + s.depth / 2;
          const canopyPos = toWorld(m.houseLocalX, frontZ + 0.45);
          _dummy.position.set(canopyPos.wx, SIDEWALK_HEIGHT + 2.65, canopyPos.wz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(2.15, 0.16, 1.0);
          _dummy.updateMatrix();
          porchCanopyMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          _color.set(s.trimColor);
          porchCanopyMeshRef.current.setColorAt(wi, _color);

          const stepPos = toWorld(m.houseLocalX, frontZ + 0.45);
          _dummy.position.set(stepPos.wx, SIDEWALK_HEIGHT + 0.13, stepPos.wz);
          _dummy.scale.set(1.9, 0.26, 0.9);
          _dummy.updateMatrix();
          stepsMeshRef.current.setMatrixAt(wi, _dummy.matrix);

          const doorPos = toWorld(m.houseLocalX, frontZ + 0.04);
          _dummy.position.set(doorPos.wx, SIDEWALK_HEIGHT + 1.28, doorPos.wz);
          _dummy.scale.set(1.06, 2.08, 0.12);
          _dummy.updateMatrix();
          doorMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          _color.set(s.accentColor);
          doorMeshRef.current.setColorAt(wi, _color);

          const mbPos = toWorld(m.walkwayX - 1.4, p.depth / 2 - 0.55);
          _dummy.position.set(mbPos.wx, SIDEWALK_HEIGHT + 0.72, mbPos.wz);
          _dummy.scale.set(0.24, 1.12, 0.34);
          _dummy.updateMatrix();
          mailboxMeshRef.current.setMatrixAt(wi, _dummy.matrix);
          _color.set(s.trimColor);
          mailboxMeshRef.current.setColorAt(wi, _color);
        }
      }

      // Windows (5 per house: 2 front ground, 2 front upper, 1 side) & Sconces (2 per house)
      if (windowMeshRef.current && sconceMeshRef.current) {
        if (hidden) {
          hideMat();
          for (let w = 0; w < 5; w++) windowMeshRef.current.setMatrixAt(wi * 5 + w, _dummy.matrix);
          for (let sc = 0; sc < 2; sc++) sconceMeshRef.current.setMatrixAt(wi * 2 + sc, _dummy.matrix);
        } else {
          const frontZ = m.houseLocalZ + s.depth / 2;
          const wxOff = s.width * 0.28;
          const winSpecs: Array<[number, number, number, number, number, number]> = [
            [m.houseLocalX - wxOff, 1.58, frontZ + 0.04, 1.15, 1.25, 0.08],
            [m.houseLocalX + wxOff, 1.58, frontZ + 0.04, 1.15, 1.25, 0.08],
            [m.houseLocalX - wxOff, s.wallHeight * 0.72, frontZ + 0.04, 1.15, 1.15, 0.08],
            [m.houseLocalX + wxOff, s.wallHeight * 0.72, frontZ + 0.04, 1.15, 1.15, 0.08],
            [m.houseLocalX - s.width / 2 - 0.04, 1.58, m.houseLocalZ, 0.08, 1.2, 1.2],
          ];
          for (let w = 0; w < 5; w++) {
            const [lx, ly, lz, sx, sy, sz] = winSpecs[w];
            const wp = toWorld(lx, lz);
            _dummy.position.set(wp.wx, SIDEWALK_HEIGHT + ly, wp.wz);
            _dummy.rotation.set(0, p.facingAngle, 0);
            _dummy.scale.set(sx, sy, sz);
            _dummy.updateMatrix();
            windowMeshRef.current.setMatrixAt(wi * 5 + w, _dummy.matrix);
          }

          for (let sc = 0; sc < 2; sc++) {
            const sxLocal = m.houseLocalX + (sc === 0 ? -0.82 : 0.82);
            const sp = toWorld(sxLocal, frontZ + 0.1);
            _dummy.position.set(sp.wx, SIDEWALK_HEIGHT + 2.15, sp.wz);
            _dummy.rotation.set(0, p.facingAngle, 0);
            _dummy.scale.set(0.16, 0.24, 0.14);
            _dummy.updateMatrix();
            sconceMeshRef.current.setMatrixAt(wi * 2 + sc, _dummy.matrix);
          }
        }
      }

      // Roofs (Gable / Hip / Flat)
      const gi = sector.gableIdxById.get(p.plotId);
      if (gi !== undefined && gableRoofMeshRef.current) {
        if (hidden) {
          hideMat();
          gableRoofMeshRef.current.setMatrixAt(gi, _dummy.matrix);
        } else {
          const roofH = s.archetype === 'traditional-home' || s.archetype === 'tudor' ? 2.45 : 2.05;
          _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight, hz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(s.width * 1.09, roofH, s.depth * 1.1);
          _dummy.updateMatrix();
          gableRoofMeshRef.current.setMatrixAt(gi, _dummy.matrix);
          _color.set(s.roofColor);
          gableRoofMeshRef.current.setColorAt(gi, _color);
        }
      }

      const hi = sector.hipIdxById.get(p.plotId);
      if (hi !== undefined && hipRoofMeshRef.current) {
        if (hidden) {
          hideMat();
          hipRoofMeshRef.current.setMatrixAt(hi, _dummy.matrix);
        } else {
          const roofH = s.archetype === 'luxury-mansion' || s.archetype === 'premium-residence' ? 2.75 : 2.2;
          _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight + roofH / 2, hz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(s.width * 1.08, roofH, s.depth * 1.08);
          _dummy.updateMatrix();
          hipRoofMeshRef.current.setMatrixAt(hi, _dummy.matrix);
          _color.set(s.roofColor);
          hipRoofMeshRef.current.setColorAt(hi, _color);
        }
      }

      const fi = sector.flatIdxById.get(p.plotId);
      if (fi !== undefined && flatRoofMeshRef.current && clereRoofMeshRef.current) {
        if (hidden) {
          hideMat();
          flatRoofMeshRef.current.setMatrixAt(fi, _dummy.matrix);
          clereRoofMeshRef.current.setMatrixAt(fi, _dummy.matrix);
        } else {
          _dummy.position.set(hx, SIDEWALK_HEIGHT + s.wallHeight + 0.2, hz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(s.width + 0.9, 0.38, s.depth + 0.9);
          _dummy.updateMatrix();
          flatRoofMeshRef.current.setMatrixAt(fi, _dummy.matrix);
          _color.set(s.roofColor);
          flatRoofMeshRef.current.setColorAt(fi, _color);

          const cp = toWorld(m.houseLocalX - s.width * 0.16, m.houseLocalZ - 0.35);
          _dummy.position.set(cp.wx, SIDEWALK_HEIGHT + s.wallHeight + 0.56, cp.wz);
          _dummy.scale.set(s.width * 0.45, 0.44, s.depth * 0.45);
          _dummy.updateMatrix();
          clereRoofMeshRef.current.setMatrixAt(fi, _dummy.matrix);
        }
      }

      // Attached Garage Wing
      const gai = sector.garageIdxById.get(p.plotId);
      if (gai !== undefined && garageBodyMeshRef.current && garageRoofMeshRef.current && garageDoorMeshRef.current) {
        if (hidden) {
          hideMat();
          garageBodyMeshRef.current.setMatrixAt(gai, _dummy.matrix);
          garageRoofMeshRef.current.setMatrixAt(gai, _dummy.matrix);
          garageDoorMeshRef.current.setMatrixAt(gai, _dummy.matrix);
        } else {
          const gp = toWorld(m.drivewayX, m.houseLocalZ - 0.15);
          _dummy.position.set(gp.wx, SIDEWALK_HEIGHT + 1.38, gp.wz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(2.65, 2.76, 4.2);
          _dummy.updateMatrix();
          garageBodyMeshRef.current.setMatrixAt(gai, _dummy.matrix);
          _color.set(s.wallColor);
          garageBodyMeshRef.current.setColorAt(gai, _color);

          _dummy.position.set(gp.wx, SIDEWALK_HEIGHT + 2.88, gp.wz);
          _dummy.scale.set(2.9, 0.24, 4.45);
          _dummy.updateMatrix();
          garageRoofMeshRef.current.setMatrixAt(gai, _dummy.matrix);
          _color.set(s.roofColor);
          garageRoofMeshRef.current.setColorAt(gai, _color);

          const gdp = toWorld(m.drivewayX, m.houseLocalZ + 1.98);
          _dummy.position.set(gdp.wx, SIDEWALK_HEIGHT + 1.15, gdp.wz);
          _dummy.scale.set(2.12, 2.05, 0.1);
          _dummy.updateMatrix();
          garageDoorMeshRef.current.setMatrixAt(gai, _dummy.matrix);
          _color.set(s.trimColor);
          garageDoorMeshRef.current.setColorAt(gai, _color);
        }
      }

      // Parked Driveway Vehicle
      const ci = sector.carIdxById.get(p.plotId);
      if (ci !== undefined && carBodyMeshRef.current && carCabinMeshRef.current) {
        if (hidden) {
          hideMat();
          carBodyMeshRef.current.setMatrixAt(ci, _dummy.matrix);
          carCabinMeshRef.current.setMatrixAt(ci, _dummy.matrix);
        } else {
          const carZ = p.depth / 2 - 2.35;
          const cp = toWorld(m.drivewayX, carZ);
          const carColors = ['#2b4c6f', '#c93c34', '#d8d5cd', '#395a49', '#3f4754', '#b57b3b'];
          const hash = p.plotCode.charCodeAt(p.plotCode.length - 1) + ci;
          _dummy.position.set(cp.wx, SIDEWALK_HEIGHT + 0.42, cp.wz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(1.52, 0.62, 3.25);
          _dummy.updateMatrix();
          carBodyMeshRef.current.setMatrixAt(ci, _dummy.matrix);
          _color.set(carColors[hash % carColors.length]);
          carBodyMeshRef.current.setColorAt(ci, _color);

          _dummy.position.set(cp.wx, SIDEWALK_HEIGHT + 0.92, cp.wz - 0.15 * cos);
          _dummy.position.x = cp.wx - 0.15 * sin;
          _dummy.scale.set(1.26, 0.48, 1.65);
          _dummy.updateMatrix();
          carCabinMeshRef.current.setMatrixAt(ci, _dummy.matrix);
        }
      }
    },
    [sector],
  );

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

    // House shells, roofs, garages, windows, signs, walkways & driveways
    sector.housePlots.forEach((p, i) => {
      writePlotHouseInstances(p, false);
      const m = getExpansionHouseMetrics(p);
      const s = p.houseStyle!;
      const sin = Math.sin(p.facingAngle);
      const cos = Math.cos(p.facingAngle);
      const halfD = p.depth / 2;

      if (signPostMeshRef.current) {
        const signLocalX = m.walkwayX - (m.isOg ? 2.55 : 2.05);
        const signLocalZ = halfD - 0.14;
        const sx = p.x + signLocalX * cos + signLocalZ * sin;
        const sz = p.z - signLocalX * sin + signLocalZ * cos;
        _dummy.position.set(sx, SIDEWALK_HEIGHT + 0.45, sz);
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(0.11, 0.85, 0.11);
        _dummy.updateMatrix();
        signPostMeshRef.current.setMatrixAt(i, _dummy.matrix);
        _color.set(m.isOg ? '#d4af37' : '#3a424d');
        signPostMeshRef.current.setColorAt(i, _color);
      }

      if (walkwayMeshRef.current) {
        const startZ = Math.max(0.4, m.houseLocalZ + s.depth / 2 - 0.1);
        const endZ = halfD + (m.isOg ? 4.4 : 2.75);
        const pathLen = Math.max(2.2, endZ - startZ);
        const pathOffsetZ = (startZ + endZ) / 2;
        const wx = p.x + m.walkwayX * cos + pathOffsetZ * sin;
        const wz = p.z - m.walkwayX * sin + pathOffsetZ * cos;
        _dummy.position.set(wx, SIDEWALK_HEIGHT + 0.015, wz);
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(m.isOg ? 3.1 : 2.05, 0.03, pathLen);
        _dummy.updateMatrix();
        walkwayMeshRef.current.setMatrixAt(i, _dummy.matrix);
      }

      if (drivewayMeshRef.current) {
        if (m.hasGarage) {
          const dStartZ = m.houseLocalZ + 1.9;
          const dEndZ = halfD + (m.isOg ? 4.4 : 2.8);
          const dLen = Math.max(2.5, dEndZ - dStartZ);
          const dCenterZ = (dStartZ + dEndZ) / 2;
          const dx = p.x + m.drivewayX * cos + dCenterZ * sin;
          const dz = p.z - m.drivewayX * sin + dCenterZ * cos;
          _dummy.position.set(dx, SIDEWALK_HEIGHT + 0.016, dz);
          _dummy.rotation.set(0, p.facingAngle, 0);
          _dummy.scale.set(2.55, 0.032, dLen);
          _dummy.updateMatrix();
        } else {
          _dummy.position.set(0, -100, 0);
          _dummy.scale.set(0.001, 0.001, 0.001);
          _dummy.updateMatrix();
        }
        drivewayMeshRef.current.setMatrixAt(i, _dummy.matrix);
      }
    });

    const markAllUpdated = (refs: Array<THREE.InstancedMesh | null>, withColors = false) => {
      for (const mesh of refs) {
        if (!mesh) continue;
        mesh.instanceMatrix.needsUpdate = true;
        if (withColors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    };

    markAllUpdated(
      [
        plinthMeshRef.current,
        walkwayMeshRef.current,
        drivewayMeshRef.current,
        stepsMeshRef.current,
        windowMeshRef.current,
        sconceMeshRef.current,
      ],
      false,
    );
    markAllUpdated(
      [
        wallMeshRef.current,
        trimMeshRef.current,
        gableRoofMeshRef.current,
        hipRoofMeshRef.current,
        flatRoofMeshRef.current,
        clereRoofMeshRef.current,
        garageBodyMeshRef.current,
        garageRoofMeshRef.current,
        garageDoorMeshRef.current,
        porchCanopyMeshRef.current,
        doorMeshRef.current,
        mailboxMeshRef.current,
        carBodyMeshRef.current,
        carCabinMeshRef.current,
        signPostMeshRef.current,
      ],
      true,
    );

    const populateBoxGroup = (
      mesh: THREE.InstancedMesh | null,
      items: Array<{ x: number; y: number; z: number; rotY: number; sx: number; sy: number; sz: number; color: string }>,
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

    populateBoxGroup(curbMeshRef.current, exteriorData.curbs, false);
    populateBoxGroup(fencePlinthMeshRef.current, exteriorData.plinths);
    populateBoxGroup(fenceHeritageMeshRef.current, exteriorData.heritageBays);
    populateBoxGroup(fenceModernMeshRef.current, exteriorData.modernBays);
    populateBoxGroup(fenceTimberMeshRef.current, exteriorData.timberBays);
    populateBoxGroup(fencePillarMeshRef.current, exteriorData.pillars);
    populateBoxGroup(fenceCapMeshRef.current, exteriorData.caps);
    populateBoxGroup(fenceGateMeshRef.current, exteriorData.gates);
    populateBoxGroup(flowerbedSoilRef.current, exteriorData.flowerSoils, false);
    populateBoxGroup(flowerBloomRef.current, exteriorData.flowerBlooms);
    populateBoxGroup(shrubMeshRef.current, exteriorData.shrubs);

    if (chimneyMeshRef.current) {
      sector.chimneyPlots.forEach((p, i) => {
        const s = p.houseStyle!;
        const m = getExpansionHouseMetrics(p);
        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const lx = m.houseLocalX + s.width * 0.25;
        const lz = m.houseLocalZ - s.depth * 0.2;
        _dummy.position.set(
          p.x + lx * cos + lz * sin,
          SIDEWALK_HEIGHT + s.wallHeight + 1.35,
          p.z - lx * sin + lz * cos,
        );
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(0.72, 2.1, 0.72);
        _dummy.updateMatrix();
        chimneyMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      chimneyMeshRef.current.instanceMatrix.needsUpdate = true;
      chimneyMeshRef.current.computeBoundingSphere();
    }

    if (balconyMeshRef.current) {
      sector.balconyPlots.forEach((p, i) => {
        const s = p.houseStyle!;
        const m = getExpansionHouseMetrics(p);
        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const lz = m.houseLocalZ + s.depth / 2 + 0.55;
        _dummy.position.set(
          p.x + m.houseLocalX * cos + lz * sin,
          SIDEWALK_HEIGHT + s.wallHeight * 0.54,
          p.z - m.houseLocalX * sin + lz * cos,
        );
        _dummy.rotation.set(0, p.facingAngle, 0);
        _dummy.scale.set(2.8, 0.16, 1.1);
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
  }, [sector, exteriorData, writePlotHouseInstances]);

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

    for (const prevId of prevIds) {
      if (!nextIds.has(prevId)) {
        const p = plotByIdLocal.get(prevId);
        if (p) writePlotHouseInstances(p, false);
      }
    }
    for (const id of nextIds) {
      if (!prevIds.has(id)) {
        const p = plotByIdLocal.get(id);
        if (p) writePlotHouseInstances(p, true);
      }
    }

    for (const mesh of [
      plinthMeshRef.current,
      wallMeshRef.current,
      trimMeshRef.current,
      gableRoofMeshRef.current,
      hipRoofMeshRef.current,
      flatRoofMeshRef.current,
      clereRoofMeshRef.current,
      garageBodyMeshRef.current,
      garageRoofMeshRef.current,
      garageDoorMeshRef.current,
      porchCanopyMeshRef.current,
      stepsMeshRef.current,
      doorMeshRef.current,
      windowMeshRef.current,
      sconceMeshRef.current,
      mailboxMeshRef.current,
      carBodyMeshRef.current,
      carCabinMeshRef.current,
    ]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }

    suppressedIdsRef.current = nextIds;
  }, [detailedPlots, sector, writePlotHouseInstances]);

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
        <>
          <instancedMesh
            ref={plinthMeshRef}
            args={[res.unitBoxGeo, res.plinthMat, sector.housePlots.length]}
            frustumCulled
          />
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
          <instancedMesh
            ref={trimMeshRef}
            args={[res.unitBoxGeo, res.trimMat, sector.housePlots.length]}
            frustumCulled
          />
          <instancedMesh
            ref={porchCanopyMeshRef}
            args={[res.unitBoxGeo, res.trimMat, sector.housePlots.length]}
            frustumCulled
          />
          <instancedMesh
            ref={stepsMeshRef}
            args={[res.unitBoxGeo, res.curbMat, sector.housePlots.length]}
            receiveShadow
            frustumCulled
          />
          <instancedMesh
            ref={doorMeshRef}
            args={[res.unitBoxGeo, res.doorMat, sector.housePlots.length]}
            frustumCulled
          />
          <instancedMesh
            ref={windowMeshRef}
            args={[res.unitBoxGeo, windowMat, sector.housePlots.length * 5]}
            frustumCulled
          />
          <instancedMesh
            ref={sconceMeshRef}
            args={[res.unitBoxGeo, lampGlobeMat, sector.housePlots.length * 2]}
            frustumCulled
          />
          <instancedMesh
            ref={mailboxMeshRef}
            args={[res.unitBoxGeo, res.trimMat, sector.housePlots.length]}
            frustumCulled
          />
          <instancedMesh
            ref={walkwayMeshRef}
            args={[res.unitBoxGeo, res.drivewayMat, sector.housePlots.length]}
            receiveShadow
            frustumCulled
          />
          <instancedMesh
            ref={drivewayMeshRef}
            args={[res.unitBoxGeo, res.drivewayMat, sector.housePlots.length]}
            receiveShadow
            frustumCulled
          />
          <instancedMesh
            ref={signPostMeshRef}
            args={[res.unitBoxGeo, res.signPostMat, sector.housePlots.length]}
            frustumCulled
          />
        </>
      )}

      {sector.gableRoofPlots.length > 0 && (
        <instancedMesh
          ref={gableRoofMeshRef}
          args={[res.gableRoofGeo, res.pitchedRoofMat, sector.gableRoofPlots.length]}
          frustumCulled
        />
      )}

      {sector.hipRoofPlots.length > 0 && (
        <instancedMesh
          ref={hipRoofMeshRef}
          args={[res.hipRoofGeo, res.pitchedRoofMat, sector.hipRoofPlots.length]}
          frustumCulled
        />
      )}

      {sector.flatRoofPlots.length > 0 && (
        <>
          <instancedMesh
            ref={flatRoofMeshRef}
            args={[res.unitBoxGeo, res.flatRoofMat, sector.flatRoofPlots.length]}
            frustumCulled
          />
          <instancedMesh
            ref={clereRoofMeshRef}
            args={[res.unitBoxGeo, res.flatRoofMat, sector.flatRoofPlots.length]}
            frustumCulled
          />
        </>
      )}

      {sector.garagePlots.length > 0 && (
        <>
          <instancedMesh
            ref={garageBodyMeshRef}
            args={[res.unitBoxGeo, res.wallMat, sector.garagePlots.length]}
            frustumCulled
          />
          <instancedMesh
            ref={garageRoofMeshRef}
            args={[res.unitBoxGeo, res.pitchedRoofMat, sector.garagePlots.length]}
            frustumCulled
          />
          <instancedMesh
            ref={garageDoorMeshRef}
            args={[res.unitBoxGeo, res.garageDoorMat, sector.garagePlots.length]}
            frustumCulled
          />
        </>
      )}

      {sector.carPlots.length > 0 && (
        <>
          <instancedMesh
            ref={carBodyMeshRef}
            args={[res.unitBoxGeo, res.carBodyMat, sector.carPlots.length]}
            frustumCulled
          />
          <instancedMesh
            ref={carCabinMeshRef}
            args={[res.unitBoxGeo, res.carCabinMat, sector.carPlots.length]}
            frustumCulled
          />
        </>
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

      {exteriorData.curbs.length > 0 && (
        <instancedMesh
          ref={curbMeshRef}
          args={[res.unitBoxGeo, res.curbMat, exteriorData.curbs.length]}
          receiveShadow
          frustumCulled
        />
      )}

      {exteriorData.flowerSoils.length > 0 && (
        <instancedMesh
          ref={flowerbedSoilRef}
          args={[res.unitBoxGeo, res.soilMat, exteriorData.flowerSoils.length]}
          receiveShadow
          frustumCulled
        />
      )}

      {exteriorData.flowerBlooms.length > 0 && (
        <instancedMesh
          ref={flowerBloomRef}
          args={[res.unitBoxGeo, res.flowerMat, exteriorData.flowerBlooms.length]}
          frustumCulled
        />
      )}

      {exteriorData.shrubs.length > 0 && (
        <instancedMesh
          ref={shrubMeshRef}
          args={[res.shrubGeo, res.flowerMat, exteriorData.shrubs.length]}
          frustumCulled
        />
      )}

      {exteriorData.plinths.length > 0 && (
        <instancedMesh
          ref={fencePlinthMeshRef}
          args={[res.unitBoxGeo, res.fencePlinthMat, exteriorData.plinths.length]}
          receiveShadow
          frustumCulled
        />
      )}

      {exteriorData.heritageBays.length > 0 && (
        <instancedMesh
          ref={fenceHeritageMeshRef}
          args={[res.fenceHeritageBayGeo, res.fenceBayMat, exteriorData.heritageBays.length]}
          frustumCulled
        />
      )}

      {exteriorData.modernBays.length > 0 && (
        <instancedMesh
          ref={fenceModernMeshRef}
          args={[res.fenceModernBayGeo, res.fenceBayMat, exteriorData.modernBays.length]}
          frustumCulled
        />
      )}

      {exteriorData.timberBays.length > 0 && (
        <instancedMesh
          ref={fenceTimberMeshRef}
          args={[res.fenceTimberBayGeo, res.fenceBayMat, exteriorData.timberBays.length]}
          frustumCulled
        />
      )}

      {exteriorData.pillars.length > 0 && (
        <instancedMesh
          ref={fencePillarMeshRef}
          args={[res.unitBoxGeo, res.fencePillarMat, exteriorData.pillars.length]}
          frustumCulled
        />
      )}

      {exteriorData.caps.length > 0 && (
        <instancedMesh
          ref={fenceCapMeshRef}
          args={[res.unitBoxGeo, res.fencePillarMat, exteriorData.caps.length]}
          frustumCulled
        />
      )}

      {exteriorData.gates.length > 0 && (
        <instancedMesh
          ref={fenceGateMeshRef}
          args={[res.unitBoxGeo, res.fenceBayMat, exteriorData.gates.length]}
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

  // Smooth Curved Roads Geos (Asphalt, Green Strips, Raised Sidewalks, Markings)
  const curvedRoadGeos = useMemo(
    () => buildCurvedRoadGeometries(world.curvedRoads),
    [world.curvedRoads],
  );

  useEffect(() => {
    return () => {
      curvedRoadGeos.asphaltGeo.dispose();
      curvedRoadGeos.greenStripGeo.dispose();
      curvedRoadGeos.sidewalkGeo.dispose();
      curvedRoadGeos.yellowLineGeo.dispose();
      curvedRoadGeos.whiteDashGeo.dispose();
    };
  }, [curvedRoadGeos]);

  // All 3,446 non-VIP resident @username physical signboards in batched texture atlases
  const signBatches = useMemo(
    () => buildNameplateAtlasBatches(world.plots),
    [world.plots],
  );

  useEffect(() => {
    return () => {
      for (const b of signBatches) {
        b.geo.dispose();
        b.tex.dispose();
        b.mat.dispose();
      }
    };
  }, [signBatches]);

  // Smooth circular asphalt joint discs + roadside stone curbs for scenic outer parkway
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

  // Road-aligned trees & landscaped bushes along boulevards, curved parkways & collectors
  const { blvdTrees, blvdBushes } = useMemo(() => {
    const rawTrees: Array<{ x: number; z: number; scale: number; tint: string }> = [];
    const bushes: Array<{ x: number; z: number; scale: number; tint: string }> = [];
    const treeTints = ['#4b7f43', '#5a8f4c', '#3d6d3b', '#679b55'];
    const districtTreeTint = (districtId: ExpansionDistrictId | undefined, idx: number): string => {
      switch (districtId) {
        case 'maplewood-district': {
          const pal = ['#c86d3b', '#d98a2b', '#b85432', '#7b9342'];
          return pal[idx % pal.length];
        }
        case 'highland-district': {
          const pal = ['#274d35', '#2f5c3e', '#396946', '#457a52'];
          return pal[idx % pal.length];
        }
        case 'riverside-district':
        case 'lakeside-district': {
          const pal = ['#4d9164', '#5ea672', '#3b7a57', '#68ab7d'];
          return pal[idx % pal.length];
        }
        case 'central-gardens': {
          const pal = ['#58a354', '#73b862', '#84cc16', '#67a959'];
          return pal[idx % pal.length];
        }
        case 'oakwood-district':
        case 'greenfield-district': {
          const pal = ['#4b7f43', '#5c934e', '#3f6f3b', '#699e57'];
          return pal[idx % pal.length];
        }
        default:
          return treeTints[idx % treeTints.length];
      }
    };

    // Trees & bushes flanking curvy scenic outer parkways
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

    // Trees lining district curved collectors & scenic crescents (verified against plots & roads)
    const gardenFlowerTints = ['#e286a8', '#f59e0b', '#ec4899', '#a855f7'];
    for (const cr of world.curvedRoads) {
      if (cr.tier === 'residential') continue;
      const pts = cr.sampledPoints;
      const offset = cr.width * 0.5 + cr.greenStripWidth + cr.sidewalkWidth + 1.4;
      for (let i = 2; i < pts.length - 2; i += 4) {
        const pPrev = pts[i - 1];
        const pNext = pts[i + 1];
        const dx = pNext.x - pPrev.x;
        const dz = pNext.z - pPrev.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;
        const side = i % 8 === 2 ? 1 : -1;
        const tx = pts[i].x + nx * offset * side;
        const tz = pts[i].z + nz * offset * side;
        if (!isClearOfExpansionInfra(tx, tz, world, 2.1)) continue;
        rawTrees.push({
          x: tx,
          z: tz,
          scale: 0.86 + (rawTrees.length % 3) * 0.1,
          tint: districtTreeTint(cr.districtId, rawTrees.length),
        });
        if (cr.districtId === 'central-gardens' && i % 8 === 2) {
          const fx = pts[i].x - nx * (cr.width * 0.5 + cr.greenStripWidth * 0.5) * side;
          const fz = pts[i].z - nz * (cr.width * 0.5 + cr.greenStripWidth * 0.5) * side;
          if (isClearOfExpansionInfra(fx, fz, world, 1.5)) {
            bushes.push({
              x: fx,
              z: fz,
              scale: 0.72,
              tint: gardenFlowerTints[bushes.length % gardenFlowerTints.length],
            });
          }
        }
      }
    }

    // Neat parallel boulevard tree rows flanking primary E-W boulevards
    for (const zAxis of [-130, 130, -330, 176]) {
      for (let x = -880; x <= 900; x += 28) {
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

    const trees = filterWithMinSpacing(rawTrees, 5.4);
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
          gableRoofPlots: [],
          hipRoofPlots: [],
          flatRoofPlots: [],
          garagePlots: [],
          chimneyPlots: [],
          balconyPlots: [],
          poolPlots: [],
          carPlots: [],
          treesData: [],
          houseIdxById: new Map(),
          gableIdxById: new Map(),
          hipIdxById: new Map(),
          flatIdxById: new Map(),
          garageIdxById: new Map(),
          carIdxById: new Map(),
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
    const getPlotFoliageTint = (districtId: ExpansionDistrictId, status: ExpansionPlotSpec['status'], idx: number) => {
      if (status === 'og' || districtId === 'og-premium-district') {
        return foliageTints[idx % foliageTints.length];
      }
      switch (districtId) {
        case 'maplewood-district': {
          const pal = ['#c86d3b', '#d98a2b', '#b85432', '#7b9342'];
          return pal[idx % pal.length];
        }
        case 'highland-district': {
          const pal = ['#274d35', '#2f5c3e', '#396946', '#457a52'];
          return pal[idx % pal.length];
        }
        case 'riverside-district':
        case 'lakeside-district': {
          const pal = ['#4d9164', '#5ea672', '#3b7a57', '#68ab7d'];
          return pal[idx % pal.length];
        }
        case 'central-gardens': {
          const pal = ['#58a354', '#73b862', '#84cc16', '#e286a8'];
          return pal[idx % pal.length];
        }
        case 'oakwood-district':
        case 'greenfield-district':
        default:
          return foliageTints[idx % foliageTints.length];
      }
    };
    world.plots.forEach((p, i) => {
      const s = ensure(getSectorKey(p.x, p.z));
      s.plots.push(p);

      if (p.status !== 'vip') {
        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const candidates: Array<[number, number]> =
          p.status === 'expansion-open'
            ? [[p.width * 0.34, -p.depth * 0.3]]
            : p.status === 'og'
              ? [[-p.width / 2 + 2.2, -p.depth / 2 + 2.2]]
              : i % 2 === 0
                ? [
                    [-p.width / 2 + 1.65, p.depth / 2 - 2.05],
                    [p.width / 2 - 1.65, -p.depth / 2 + 1.55],
                    [-p.width / 2 + 1.55, -p.depth / 2 + 1.55],
                  ]
                : [
                    [p.width / 2 - 1.65, -p.depth / 2 + 1.55],
                    [-p.width / 2 + 1.65, p.depth / 2 - 2.05],
                    [-p.width / 2 + 1.55, -p.depth / 2 + 1.55],
                  ];
        for (const [lx, lz] of candidates) {
          if (isExpansionPlotTreeSafe(p, lx, lz)) {
            s.treesData.push({
              x: p.x + lx * cos + lz * sin,
              z: p.z - lx * sin + lz * cos,
              scale: p.status === 'og' ? 1.05 : 0.7 + ((i % 4) * 0.055),
              tint: getPlotFoliageTint(p.districtId, p.status, i),
            });
            break;
          }
        }
      }

      if (p.status !== 'vip' && p.houseStyle !== null) {
        const wi = s.housePlots.length;
        s.housePlots.push(p);
        s.houseIdxById.set(p.plotId, wi);

        const arch = p.houseStyle.archetype;
        if (isFlatArchetype(arch)) {
          const fi = s.flatRoofPlots.length;
          s.flatRoofPlots.push(p);
          s.flatIdxById.set(p.plotId, fi);
        } else if (isGableArchetype(arch)) {
          const gi = s.gableRoofPlots.length;
          s.gableRoofPlots.push(p);
          s.gableIdxById.set(p.plotId, gi);
        } else {
          const hi = s.hipRoofPlots.length;
          s.hipRoofPlots.push(p);
          s.hipIdxById.set(p.plotId, hi);
        }

        if (p.houseStyle.hasGarageCarport) {
          const gai = s.garagePlots.length;
          s.garagePlots.push(p);
          s.garageIdxById.set(p.plotId, gai);
        }
        if (p.hasParkedCar) {
          const ci = s.carPlots.length;
          s.carPlots.push(p);
          s.carIdxById.set(p.plotId, ci);
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
    const hipRoofGeo = new THREE.ConeGeometry(0.71, 1, 4, 1);
    hipRoofGeo.rotateY(Math.PI / 4);
    hipRoofGeo.computeVertexNormals();
    const fenceBays = createUnitFenceBayGeometries();

    return {
      unitBoxGeo: new THREE.BoxGeometry(1, 1, 1),
      sidewalkBoxGeo: new THREE.BoxGeometry(1, SIDEWALK_HEIGHT - 0.018, 1),
      padBoxGeo: new THREE.BoxGeometry(1, SIDEWALK_HEIGHT, 1),
      lampPoleGeo: new THREE.CylinderGeometry(0.07, 0.1, 3.7, 6),
      lampGlobeGeo: new THREE.SphereGeometry(0.22, 8, 8),
      gableRoofGeo: createGableRoofGeo(),
      hipRoofGeo,
      signBoardGeo: new THREE.BoxGeometry(0.92, 0.85, 0.14),
      trunkGeo: createHdTrunkGeo(),
      canopyGeo: createHdBroadleafCrownGeo(),
      shrubGeo: new THREE.DodecahedronGeometry(0.55, 0),
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
      plinthMat: new THREE.MeshStandardMaterial({ color: '#7d7870', roughness: 0.9 }),
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
      doorMat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.56 }),
      garageDoorMat: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.5,
        metalness: 0.14,
      }),
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
      soilMat: new THREE.MeshStandardMaterial({ color: '#4e3725', roughness: 0.94 }),
      flowerMat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 }),
      carBodyMat: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.32,
        metalness: 0.45,
      }),
      carCabinMat: new THREE.MeshStandardMaterial({
        color: '#364152',
        roughness: 0.18,
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

  const windowMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6b8da3',
        emissive: '#ffbe6b',
        emissiveIntensity: 0.08,
        roughness: 0.16,
        metalness: 0.35,
      }),
    [],
  );

  useEffect(() => {
    lampGlobeMat.emissiveIntensity = isEvening ? 2.4 : 0.12;
    windowMat.emissiveIntensity = isEvening ? 1.45 : 0.08;
    windowMat.emissive.set(isEvening ? '#ffbe6b' : '#2a3744');
  }, [lampGlobeMat, windowMat, isEvening]);

  useEffect(() => {
    return () => {
      sharedRes.unitBoxGeo.dispose();
      sharedRes.sidewalkBoxGeo.dispose();
      sharedRes.padBoxGeo.dispose();
      sharedRes.lampPoleGeo.dispose();
      sharedRes.lampGlobeGeo.dispose();
      sharedRes.gableRoofGeo.dispose();
      sharedRes.hipRoofGeo.dispose();
      sharedRes.signBoardGeo.dispose();
      sharedRes.trunkGeo.dispose();
      sharedRes.canopyGeo.dispose();
      sharedRes.shrubGeo.dispose();
      sharedRes.fenceHeritageBayGeo.dispose();
      sharedRes.fenceModernBayGeo.dispose();
      sharedRes.fenceTimberBayGeo.dispose();
      sharedRes.sidewalkMat.dispose();
      sharedRes.lampPoleMat.dispose();
      sharedRes.padMat.dispose();
      sharedRes.plinthMat.dispose();
      sharedRes.drivewayMat.dispose();
      sharedRes.curbMat.dispose();
      sharedRes.fencePlinthMat.dispose();
      sharedRes.fenceBayMat.dispose();
      sharedRes.fencePillarMat.dispose();
      sharedRes.wallMat.dispose();
      sharedRes.pitchedRoofMat.dispose();
      sharedRes.flatRoofMat.dispose();
      sharedRes.trimMat.dispose();
      sharedRes.doorMat.dispose();
      sharedRes.garageDoorMat.dispose();
      sharedRes.chimneyMat.dispose();
      sharedRes.balconyMat.dispose();
      sharedRes.poolMat.dispose();
      sharedRes.signPostMat.dispose();
      sharedRes.soilMat.dispose();
      sharedRes.flowerMat.dispose();
      sharedRes.carBodyMat.dispose();
      sharedRes.carCabinMat.dispose();
      sharedRes.trunkMat.dispose();
      sharedRes.canopyMat.dispose();
      lampGlobeMat.dispose();
      windowMat.dispose();
    };
  }, [sharedRes, lampGlobeMat, windowMat]);

  // Populate Straight Roads & Center Lines
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

  // Proximity LOD Window
  const [detailedPlots, setDetailedPlots] = useState<ExpansionPlotSpec[]>([]);
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

    const near = queryNearbyExpansionPlots(world.spatialIndex, fx, fz, 72)
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

  const selectedPlot = selectedExpansionPlotId
    ? world.plotById.get(selectedExpansionPlotId) ?? null
    : null;

  return (
    <group>
      {/* Preserved Special Districts, Venice Canals, 35 Bridges & 7 Neighborhood Parks */}
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

      {/* Smooth Curved Road Network Ribbons (Asphalt, Sidewalks, Green Strips, Markings) */}
      <mesh geometry={curvedRoadGeos.asphaltGeo} receiveShadow>
        <meshStandardMaterial
          map={textures.asphalt}
          color="#373c44"
          roughness={0.85}
          polygonOffset
          polygonOffsetFactor={1}
        />
      </mesh>
      <mesh geometry={curvedRoadGeos.greenStripGeo} receiveShadow>
        <meshStandardMaterial color="#5d9448" roughness={0.92} />
      </mesh>
      <mesh geometry={curvedRoadGeos.sidewalkGeo} material={sharedRes.sidewalkMat} receiveShadow />
      <mesh geometry={curvedRoadGeos.yellowLineGeo}>
        <meshStandardMaterial
          color="#e5b84b"
          roughness={0.7}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      <mesh geometry={curvedRoadGeos.whiteDashGeo}>
        <meshStandardMaterial
          color="#f1f5f9"
          roughness={0.7}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>

      {/* Circular District Roundabouts */}
      <RoundaboutsLayer roundabouts={world.roundabouts} textures={textures} />

      {/* Physical @username + Plot Code Signboards on ALL 3,446 Non-VIP Homes */}
      {signBatches.map((batch, bi) => (
        <mesh key={`np-atlas-${bi}`} geometry={batch.geo} material={batch.mat} frustumCulled />
      ))}

      {/* High-Detail Articulated Proximity Houses + Parked Driveway Cars */}
      {detailedPlots.map((p) => {
        const { hx, hz } = getHouseOrigin(p);
        const m = getExpansionHouseMetrics(p);
        const sin = Math.sin(p.facingAngle);
        const cos = Math.cos(p.facingAngle);
        const styleSpec = p.houseStyle!;
        const showParkedCar = Boolean(p.hasParkedCar || (m.isOg && styleSpec.hasGarageCarport));
        const carLocalZ = m.isOg ? p.depth / 2 - 3.8 : p.depth / 2 - 2.35;
        const cx = p.x + m.drivewayX * cos + carLocalZ * sin;
        const cz = p.z - m.drivewayX * sin + carLocalZ * cos;
        const carScale = m.isOg ? 0.96 : 0.84;
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

      {/* Primary Boulevards, OG Roads & Panoramic Ring Road */}
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

      {/* Outer Parkway Seamless Vertex Joints & Stone Curbs */}
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

      {/* Road-Aligned Boulevard, Collector & Scenic Parkway Trees + Bushes */}
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

      {/* Frustum-Culled Spatial Sectors for Pads, Multi-Part 3D Houses, Exteriors & Trees */}
      {sectors.map((sector) => (
        <ExpansionSectorChunk
          key={sector.key}
          sector={sector}
          res={sharedRes}
          lampGlobeMat={lampGlobeMat}
          windowMat={windowMat}
          detailedPlots={detailedPlots}
          onSelectExpansionPlot={onSelectExpansionPlot}
        />
      ))}
    </group>
  );
};
