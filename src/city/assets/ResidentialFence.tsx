import React, { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HouseArchetype } from '../types';

export type FenceStyleVariant = 'modern-slat' | 'heritage-iron' | 'european-timber';

export interface FenceOpeningSpec {
  /** Local X center of opening along the front (+Z) fence */
  centerX: number;
  /** Clear opening width between gate pillar inner faces */
  width: number;
  /** Render twin open/ajar pedestrian gate leaves tucked neatly beside the pathway */
  hasGateLeaves?: boolean;
}

export interface ResidentialFenceProps {
  plotWidth: number;
  plotDepth: number;
  archetype?: HouseArchetype | null;
  trimColor?: string;
  accentColor?: string;
  /** Distance inward from plot boundary to fence centerline (prevents neighbor overlap) */
  inset?: number;
  /** Front fence openings (pedestrian gate, driveway access, ceremonial entrance) */
  frontOpenings: FenceOpeningSpec[];
  /** Optional royal gold/limestone styling for VIP estate */
  isRoyal?: boolean;
}

export function getFenceStyleForArchetype(
  archetype?: HouseArchetype | null,
): FenceStyleVariant {
  if (
    archetype === 'modern-villa' ||
    archetype === 'luxury-modern' ||
    archetype === 'contemporary-villa' ||
    archetype === 'modern-minimalist' ||
    archetype === 'modern-family'
  ) {
    return 'modern-slat';
  }
  if (
    archetype === 'tudor' ||
    archetype === 'townhouse' ||
    archetype === 'luxury-mansion' ||
    archetype === 'premium-residence'
  ) {
    return 'heritage-iron';
  }
  return 'european-timber';
}

// ---------------------------------------------------------------------------
// Shared Base Geometries & Instanced 1.8m Unit Bay Geometries
// ---------------------------------------------------------------------------
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

function normalizeGeo(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIdx = geo.index ? geo.toNonIndexed() : geo;
  if (!nonIdx.attributes.normal) {
    nonIdx.computeVertexNormals();
  }
  const clean = new THREE.BufferGeometry();
  clean.setAttribute('position', nonIdx.attributes.position.clone());
  clean.setAttribute('normal', nonIdx.attributes.normal.clone());
  if (nonIdx !== geo) nonIdx.dispose();
  geo.dispose();
  return clean;
}

function addBoxPart(
  parts: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  const b = new THREE.BoxGeometry(w, h, d);
  b.translate(x, y, z);
  parts.push(normalizeGeo(b));
}

export const INSTANCED_BAY_UNIT_LEN = 1.8;

/**
 * Builds 3 merged 1.8m-wide upper-fence bay geometries (y = 0.22..1.04) for instanced
 * rendering across 3,400+ residential plots with zero vertical picket distortion.
 */
export function createUnitFenceBayGeometries(): {
  heritageBay: THREE.BufferGeometry;
  modernBay: THREE.BufferGeometry;
  timberBay: THREE.BufferGeometry;
} {
  const L = INSTANCED_BAY_UNIT_LEN;

  // 1. Heritage Wrought-Iron Pickets + Rails + Bay Post
  const hParts: THREE.BufferGeometry[] = [];
  addBoxPart(hParts, L, 0.055, 0.06, 0, 0.34, 0);
  addBoxPart(hParts, L, 0.055, 0.06, 0, 0.94, 0);
  addBoxPart(hParts, L, 0.045, 0.075, 0, 1.03, 0);
  for (let i = -2; i <= 2; i++) {
    addBoxPart(hParts, 0.036, 0.72, 0.036, i * 0.32, 0.64, 0);
  }
  addBoxPart(hParts, 0.11, 0.88, 0.11, -L / 2, 0.66, 0);
  const heritageBay = mergeGeometries(hParts, false);
  hParts.forEach((p) => p.dispose());
  heritageBay.computeBoundingSphere();

  // 2. Modern Architectural Horizontal Louver Slats + Top Coping + Bay Post
  const mParts: THREE.BufferGeometry[] = [];
  for (const sy of [0.34, 0.52, 0.70, 0.88]) {
    addBoxPart(mParts, L, 0.095, 0.045, 0, sy, 0);
  }
  addBoxPart(mParts, L, 0.055, 0.095, 0, 1.02, 0);
  addBoxPart(mParts, 0.11, 0.88, 0.11, -L / 2, 0.66, 0);
  const modernBay = mergeGeometries(mParts, false);
  mParts.forEach((p) => p.dispose());
  modernBay.computeBoundingSphere();

  // 3. European Timber Post-and-Slat Fence Bay
  const tParts: THREE.BufferGeometry[] = [];
  addBoxPart(tParts, L, 0.06, 0.055, 0, 0.36, 0.015);
  addBoxPart(tParts, L, 0.06, 0.055, 0, 0.88, 0.015);
  for (let i = -2; i <= 2; i++) {
    addBoxPart(tParts, 0.11, 0.76, 0.036, i * 0.32, 0.63, -0.015);
  }
  addBoxPart(tParts, 0.12, 0.9, 0.12, -L / 2, 0.66, 0);
  const timberBay = mergeGeometries(tParts, false);
  tParts.forEach((p) => p.dispose());
  timberBay.computeBoundingSphere();

  return { heritageBay, modernBay, timberBay };
}

interface FenceRun {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

// ---------------------------------------------------------------------------
// Articulated Single-Plot Residential Fence Component (Core Town + VIP Estate)
// ---------------------------------------------------------------------------
export const ResidentialFence: React.FC<ResidentialFenceProps> = React.memo(({
  plotWidth,
  plotDepth,
  archetype = null,
  trimColor = '#dcd5c7',
  accentColor = '#7d5b3d',
  inset = 0.28,
  frontOpenings,
  isRoyal = false,
}) => {
  const style = isRoyal ? 'heritage-iron' : getFenceStyleForArchetype(archetype);
  const halfW = plotWidth / 2 - inset;
  const halfD = plotDepth / 2 - inset;

  const palette = useMemo(() => {
    if (isRoyal) {
      return {
        plinth: '#e7dfd1',
        pier: '#f3ede0',
        cap: '#d4af37',
        infill: '#1e242c',
        gate: '#252c36',
      };
    }
    if (style === 'modern-slat') {
      return {
        plinth: archetype === 'luxury-modern' ? '#434952' : '#d2ccc0',
        pier: trimColor || '#2f353d',
        cap: '#242930',
        infill: archetype === 'luxury-modern' ? '#2c323b' : accentColor || '#8c6544',
        gate: '#2b3038',
      };
    }
    if (style === 'heritage-iron') {
      return {
        plinth: '#cfc8ba',
        pier: '#dfd8ca',
        cap: '#b7afa1',
        infill: '#232830',
        gate: '#1e232a',
      };
    }
    return {
      plinth: '#d4cdc0',
      pier: trimColor && trimColor !== '#32373e' ? trimColor : '#e4ddd0',
      cap: '#b8b0a1',
      infill: accentColor || '#8a6343',
      gate: accentColor || '#7d583a',
    };
  }, [style, archetype, trimColor, accentColor, isRoyal]);

  // Compute clean non-overlapping fence runs around all 4 sides + front openings
  const { runs, gatePillars, cornerPosts, intermediatePosts } = useMemo(() => {
    const outRuns: FenceRun[] = [];
    // Side & rear continuous boundaries
    outRuns.push({ x1: -halfW, z1: -halfD, x2: -halfW, z2: halfD });
    outRuns.push({ x1: halfW, z1: -halfD, x2: halfW, z2: halfD });
    outRuns.push({ x1: -halfW, z1: -halfD, x2: halfW, z2: -halfD });

    // Front (+Z) boundary split cleanly around pedestrian gate & driveway openings
    const sortedOpenings = [...frontOpenings].sort((a, b) => a.centerX - b.centerX);
    const pillars: Array<{ x: number; z: number; isWide: boolean }> = [];
    let cursorX = -halfW;

    for (const op of sortedOpenings) {
      const gapStart = Math.max(-halfW, op.centerX - op.width / 2);
      const gapEnd = Math.min(halfW, op.centerX + op.width / 2);
      if (gapStart - cursorX > 0.14) {
        outRuns.push({ x1: cursorX, z1: halfD, x2: gapStart, z2: halfD });
      }
      const pillarOffset = op.width >= 3.2 ? 0.15 : 0.13;
      pillars.push({ x: gapStart - pillarOffset, z: halfD, isWide: op.width >= 3.2 });
      pillars.push({ x: gapEnd + pillarOffset, z: halfD, isWide: op.width >= 3.2 });
      cursorX = gapEnd;
    }

    if (halfW - cursorX > 0.14) {
      outRuns.push({ x1: cursorX, z1: halfD, x2: halfW, z2: halfD });
    }

    const corners: Array<[number, number]> = [
      [-halfW, -halfD],
      [halfW, -halfD],
      [-halfW, halfD],
      [halfW, halfD],
    ];

    const mids: Array<[number, number]> = [];
    for (const r of outRuns) {
      const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
      if (len < 3.4) continue;
      const divisions = Math.max(2, Math.round(len / 2.8));
      for (let k = 1; k < divisions; k++) {
        const t = k / divisions;
        mids.push([r.x1 + (r.x2 - r.x1) * t, r.z1 + (r.z2 - r.z1) * t]);
      }
    }

    return {
      runs: outRuns,
      gatePillars: pillars,
      cornerPosts: corners,
      intermediatePosts: mids,
    };
  }, [halfW, halfD, frontOpenings]);

  const plinthHeight = style === 'heritage-iron' ? 0.28 : style === 'modern-slat' ? 0.24 : 0.18;
  const fenceHeight = isRoyal ? 1.24 : 1.04;

  return (
    <group>
      {/* Perimeter Fence Runs */}
      {runs.map((run, idx) => {
        const dx = run.x2 - run.x1;
        const dz = run.z2 - run.z1;
        const len = Math.hypot(dx, dz);
        if (len < 0.12) return null;
        const cx = (run.x1 + run.x2) / 2;
        const cz = (run.z1 + run.z2) / 2;
        const angle = Math.atan2(-dz, dx);
        const picketCount = style === 'modern-slat' ? 0 : Math.max(2, Math.floor(len / 0.28));

        return (
          <group key={`fr-${idx}`} position={[cx, 0, cz]} rotation={[0, angle, 0]}>
            {/* Masonry / Concrete Plinth Base */}
            <mesh
              position={[0, plinthHeight / 2, 0]}
              geometry={UNIT_BOX}
              scale={[len, plinthHeight, 0.16]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={palette.plinth} roughness={0.86} />
            </mesh>

            {style === 'modern-slat' && (
              <>
                {/* 4 Horizontal Architectural Louver Slats */}
                {[0.36, 0.54, 0.72, 0.90].map((sy, si) => (
                  <mesh
                    key={si}
                    position={[0, sy, 0]}
                    geometry={UNIT_BOX}
                    scale={[len, 0.095, 0.05]}
                    castShadow
                  >
                    <meshStandardMaterial color={palette.infill} roughness={0.58} metalness={0.22} />
                  </mesh>
                ))}
                {/* Clean Coping Top Cap */}
                <mesh
                  position={[0, fenceHeight - 0.025, 0]}
                  geometry={UNIT_BOX}
                  scale={[len, 0.05, 0.11]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.pier} roughness={0.52} metalness={0.28} />
                </mesh>
              </>
            )}

            {style === 'heritage-iron' && (
              <>
                {/* Lower & Upper Iron Rails */}
                <mesh
                  position={[0, plinthHeight + 0.08, 0]}
                  geometry={UNIT_BOX}
                  scale={[len, 0.045, 0.055]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.infill} roughness={0.42} metalness={0.72} />
                </mesh>
                <mesh
                  position={[0, fenceHeight - 0.08, 0]}
                  geometry={UNIT_BOX}
                  scale={[len, 0.05, 0.065]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.infill} roughness={0.42} metalness={0.72} />
                </mesh>
                {/* Vertical Wrought-Iron Pickets */}
                {Array.from({ length: picketCount }).map((_, pi) => {
                  const px = -len / 2 + ((pi + 0.5) / picketCount) * len;
                  const picketH = fenceHeight - plinthHeight + 0.04;
                  return (
                    <mesh
                      key={pi}
                      position={[px, plinthHeight + picketH / 2 - 0.02, 0]}
                      geometry={UNIT_BOX}
                      scale={[0.032, picketH, 0.032]}
                      castShadow
                    >
                      <meshStandardMaterial color={palette.infill} roughness={0.42} metalness={0.72} />
                    </mesh>
                  );
                })}
              </>
            )}

            {style === 'european-timber' && (
              <>
                {/* Horizontal Timber Rails */}
                <mesh
                  position={[0, plinthHeight + 0.16, 0.02]}
                  geometry={UNIT_BOX}
                  scale={[len, 0.055, 0.05]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.infill} roughness={0.78} />
                </mesh>
                <mesh
                  position={[0, fenceHeight - 0.14, 0.02]}
                  geometry={UNIT_BOX}
                  scale={[len, 0.055, 0.05]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.infill} roughness={0.78} />
                </mesh>
                {/* Vertical Slatted Timber Pickets */}
                {Array.from({ length: picketCount }).map((_, pi) => {
                  const px = -len / 2 + ((pi + 0.5) / picketCount) * len;
                  const slatH = fenceHeight - plinthHeight - 0.04;
                  return (
                    <mesh
                      key={pi}
                      position={[px, plinthHeight + slatH / 2 + 0.02, -0.015]}
                      geometry={UNIT_BOX}
                      scale={[0.095, slatH, 0.035]}
                      castShadow
                    >
                      <meshStandardMaterial color={palette.infill} roughness={0.76} />
                    </mesh>
                  );
                })}
              </>
            )}
          </group>
        );
      })}

      {/* Corner & Intermediate Structural Posts */}
      {cornerPosts.map(([px, pz], idx) => (
        <group key={`cp-${idx}`} position={[px, 0, pz]}>
          <mesh
            position={[0, (fenceHeight + 0.12) / 2, 0]}
            geometry={UNIT_BOX}
            scale={[0.2, fenceHeight + 0.12, 0.2]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={palette.pier} roughness={0.72} />
          </mesh>
          <mesh
            position={[0, fenceHeight + 0.14, 0]}
            geometry={UNIT_BOX}
            scale={[0.25, 0.06, 0.25]}
            castShadow
          >
            <meshStandardMaterial
              color={palette.cap}
              roughness={isRoyal ? 0.3 : 0.65}
              metalness={isRoyal ? 0.78 : 0.08}
            />
          </mesh>
        </group>
      ))}

      {intermediatePosts.map(([px, pz], idx) => (
        <mesh
          key={`mp-${idx}`}
          position={[px, (fenceHeight + 0.04) / 2, pz]}
          geometry={UNIT_BOX}
          scale={[0.13, fenceHeight + 0.04, 0.13]}
          castShadow
        >
          <meshStandardMaterial
            color={style === 'heritage-iron' ? palette.pier : palette.pier}
            roughness={0.68}
          />
        </mesh>
      ))}

      {/* Capped Front Gate & Driveway Entrance Pillars */}
      {gatePillars.map((gp, idx) => {
        const w = gp.isWide ? 0.3 : 0.26;
        const h = isRoyal ? 1.65 : gp.isWide ? 1.38 : 1.32;
        return (
          <group key={`gp-${idx}`} position={[gp.x, 0, gp.z]}>
            <mesh
              position={[0, h / 2, 0]}
              geometry={UNIT_BOX}
              scale={[w, h, w]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={palette.pier} roughness={0.7} />
            </mesh>
            <mesh
              position={[0, h + 0.04, 0]}
              geometry={UNIT_BOX}
              scale={[w + 0.08, 0.08, w + 0.08]}
              castShadow
            >
              <meshStandardMaterial
                color={palette.cap}
                roughness={isRoyal ? 0.26 : 0.6}
                metalness={isRoyal ? 0.82 : 0.12}
              />
            </mesh>
          </group>
        );
      })}

      {/* Welcoming Open Pedestrian Gate Leaves (Swung 86° Inward — Zero Walkway Encroachment) */}
      {frontOpenings
        .filter((op) => op.hasGateLeaves)
        .map((op, idx) => {
          const leafWidth = 1.05;
          const leafH = 0.9;
          const hingeLeftX = op.centerX - op.width / 2;
          const hingeRightX = op.centerX + op.width / 2;
          return (
            <React.Fragment key={`gl-${idx}`}>
              {/* Left open leaf */}
              <group position={[hingeLeftX, 0.1, halfD]} rotation={[0, 1.5, 0]}>
                <mesh
                  position={[leafWidth / 2, leafH / 2, 0]}
                  geometry={UNIT_BOX}
                  scale={[leafWidth, 0.05, 0.05]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.gate} roughness={0.5} metalness={0.45} />
                </mesh>
                <mesh
                  position={[leafWidth / 2, leafH - 0.04, 0]}
                  geometry={UNIT_BOX}
                  scale={[leafWidth, 0.05, 0.05]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.gate} roughness={0.5} metalness={0.45} />
                </mesh>
                <mesh
                  position={[leafWidth / 2, leafH / 2, 0]}
                  geometry={UNIT_BOX}
                  scale={[leafWidth - 0.08, leafH - 0.12, 0.025]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.gate} roughness={0.58} metalness={0.35} />
                </mesh>
              </group>
              {/* Right open leaf */}
              <group position={[hingeRightX, 0.1, halfD]} rotation={[0, -1.5, 0]}>
                <mesh
                  position={[-leafWidth / 2, leafH / 2, 0]}
                  geometry={UNIT_BOX}
                  scale={[leafWidth, 0.05, 0.05]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.gate} roughness={0.5} metalness={0.45} />
                </mesh>
                <mesh
                  position={[-leafWidth / 2, leafH - 0.04, 0]}
                  geometry={UNIT_BOX}
                  scale={[leafWidth, 0.05, 0.05]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.gate} roughness={0.5} metalness={0.45} />
                </mesh>
                <mesh
                  position={[-leafWidth / 2, leafH / 2, 0]}
                  geometry={UNIT_BOX}
                  scale={[leafWidth - 0.08, leafH - 0.12, 0.025]}
                  castShadow
                >
                  <meshStandardMaterial color={palette.gate} roughness={0.58} metalness={0.35} />
                </mesh>
              </group>
            </React.Fragment>
          );
        })}
    </group>
  );
});
