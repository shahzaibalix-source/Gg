import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CityTextureSet } from '../materials/proceduralTextures';
import {
  createHdBroadleafCrownGeo,
  createHdPineCrownGeo,
  createHdTrunkGeo,
  createRealisticWaterMaterial,
} from '../materials/realisticNature';
import { GrassTuftPlacement, InstancedGrassField } from '../assets/NaturePropsAndWater';

interface VastCountrysideProps {
  textures: CityTextureSet;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * River centerline X coordinate as a function of Z (east of expanded Lindenhof).
 */
export function riverCenterXAtZ(z: number): number {
  return 1235 + Math.sin(z * 0.011) * 34 + Math.cos(z * 0.0045) * 18;
}

/**
 * Continuous heightfield for the rolling meadows, forest hills & alpine mountain frame.
 * Strictly 0 inside the urban city basin (|x|, |z| <= 1095) so no built road, canal,
 * park, or plot is ever displaced.
 */
export function terrainHeightAt(x: number, z: number): number {
  const edgeDist = Math.max(Math.abs(x), Math.abs(z));
  const cityMask = smoothstep(1095, 1245, edgeDist);
  if (cityMask <= 0.0001) return 0;

  // Lush undulating foothills
  const rollA =
    Math.sin(x * 0.011 + 0.4) * Math.cos(z * 0.0105 - 0.3) * 12.0 +
    Math.sin((x + z) * 0.0068) * 8.0;
  const rollB = Math.cos(x * 0.025 - z * 0.021) * 3.4;

  // Dramatic multi-ridge Alpine mountain ring framing Lindenhof (1250m -> 2050m)
  const radial = Math.hypot(x, z);
  const angle = Math.atan2(z, x);
  const ridgeMask = smoothstep(1250, 1980, radial);
  const peakA = Math.abs(Math.sin(angle * 4.0 + 0.6));
  const peakB = 0.5 + 0.5 * Math.cos(angle * 9.0 - 1.1);
  const peakC = 0.5 + 0.5 * Math.sin(angle * 15.0 + x * 0.003);
  const ridgeNoise = 0.38 + peakA * 0.42 + peakB * 0.25 + peakC * 0.16;
  const mountainHeight = ridgeMask * ridgeNoise * 130;

  // River valley carving along eastern border
  const rx = riverCenterXAtZ(z);
  const distToRiver = Math.abs(x - rx);
  const riverCarve = (1 - smoothstep(6, 28, distToRiver)) * smoothstep(1110, 1200, Math.abs(x));

  // Level eastern bridge corridor near Z = 78
  const trailFlattenZ =
    (1 - smoothstep(5, 18, Math.abs(z - 78))) * (1 - smoothstep(1080, 1380, Math.abs(x)));

  const rawHills =
    Math.max(-0.4, (rollA + rollB + 5.6) * (1 - trailFlattenZ * 0.7)) + mountainHeight;
  let h = cityMask * rawHills;
  h -= riverCarve * 5.6;

  return Math.max(-2.8, h);
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

const TRAIL_SEGMENTS: Array<{ x1: number; z1: number; x2: number; z2: number; width: number }> = [
  { x1: -810, z1: -26, x2: -1080, z2: -48, width: 5.5 },
  { x1: -26, z1: -650, x2: -48, z2: -960, width: 5.2 },
  { x1: 26, z1: 682, x2: 52, z2: 980, width: 5.2 },
  { x1: 910, z1: 78, x2: 1220, z2: 78, width: 5.6 },
];

export const VastCountryside: React.FC<VastCountrysideProps> = ({ textures }) => {
  const trunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const pineMeshRef = useRef<THREE.InstancedMesh>(null);
  const broadleafMeshRef = useRef<THREE.InstancedMesh>(null);
  const rockMeshRef = useRef<THREE.InstancedMesh>(null);
  const hayMeshRef = useRef<THREE.InstancedMesh>(null);

  const hdTrunkGeo = useMemo(() => createHdTrunkGeo(), []);
  const hdPineGeo = useMemo(() => createHdPineCrownGeo(), []);
  const hdBroadleafGeo = useMemo(() => createHdBroadleafCrownGeo(), []);

  // Sculpted vertex-colored 4400m x 4400m alpine valley & green meadow terrain
  const terrainGeo = useMemo(() => {
    const size = 4400;
    const segs = 124;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const colors = new Float32Array(pos.count * 3);

    const cMeadow = new THREE.Color('#80ab67');
    const cPasture = new THREE.Color('#66924f');
    const cForestHill = new THREE.Color('#4b7341');
    const cRock = new THREE.Color('#6b727a');
    const cSnow = new THREE.Color('#eef4fb');
    const cBank = new THREE.Color('#8e8469');

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const edgeDist = Math.max(Math.abs(x), Math.abs(z));
      const y = edgeDist < 1095 ? 0 : terrainHeightAt(x, z);
      pos.setY(i, y);

      if (uv) {
        uv.setXY(i, uv.getX(i) * 10, uv.getY(i) * 10);
      }

      const distToRiver = Math.abs(x - riverCenterXAtZ(z));

      _color.copy(cMeadow);
      _color.lerp(cPasture, smoothstep(1095, 1245, edgeDist));
      _color.lerp(cForestHill, smoothstep(8, 34, y));
      _color.lerp(cRock, smoothstep(38, 72, y));
      _color.lerp(cSnow, smoothstep(78, 114, y));

      if (distToRiver < 18 && x > 1085) {
        const bankMix = 1 - smoothstep(7, 18, distToRiver);
        _color.lerp(cBank, bankMix * 0.8);
      }

      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    if (uv) uv.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, []);

  // Winding eastern river ribbon with animated 3D GLSL water
  const riverGeo = useMemo(() => {
    const zSteps = 120;
    const zMin = -1350;
    const zMax = 1350;
    const halfWidth = 12.5;
    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= zSteps; i++) {
      const z = THREE.MathUtils.lerp(zMin, zMax, i / zSteps);
      const cx = riverCenterXAtZ(z);
      positions.push(cx - halfWidth, -0.75, z);
      positions.push(cx + halfWidth, -0.75, z);

      if (i < zSteps) {
        const base = i * 2;
        indices.push(base, base + 2, base + 1);
        indices.push(base + 1, base + 2, base + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, []);

  const riverWaterMat = useMemo(
    () =>
      createRealisticWaterMaterial({
        baseColor: '#1f6b8b',
        crestColor: '#91d9ed',
        waveAmp: 0.036,
        rippleScale: 0.85,
        opacity: 0.94,
        tag: 'countryside-river',
      }),
    [],
  );

  // Country dirt trails hugging terrain elevation
  const trailGeos = useMemo(() => {
    return TRAIL_SEGMENTS.map((seg) => {
      const steps = 22;
      const halfW = seg.width / 2;
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;

      const positions: number[] = [];
      const indices: number[] = [];

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = THREE.MathUtils.lerp(seg.x1, seg.x2, t);
        const cz = THREE.MathUtils.lerp(seg.z1, seg.z2, t);
        const h = terrainHeightAt(cx, cz) + 0.045;
        positions.push(cx - nx * halfW, h, cz - nz * halfW);
        positions.push(cx + nx * halfW, h, cz + nz * halfW);
        if (i < steps) {
          const b = i * 2;
          indices.push(b, b + 2, b + 1);
          indices.push(b + 1, b + 2, b + 3);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      return geo;
    });
  }, []);

  useEffect(() => {
    return () => {
      hdTrunkGeo.dispose();
      hdPineGeo.dispose();
      hdBroadleafGeo.dispose();
      terrainGeo.dispose();
      riverGeo.dispose();
      riverWaterMat.dispose();
      trailGeos.forEach((g) => g.dispose());
    };
  }, [hdTrunkGeo, hdPineGeo, hdBroadleafGeo, terrainGeo, riverGeo, riverWaterMat, trailGeos]);

  // Dense forests, alpine boulders, hay bales & 3D meadow grass tufts framing Lindenhof
  const countrysideProps = useMemo(() => {
    let seed = 7731;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const pines: Array<{ x: number; y: number; z: number; scale: number; tint: string }> = [];
    const broadleafs: Array<{ x: number; y: number; z: number; scale: number; tint: string }> = [];
    const rocks: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: number }> = [];
    const hays: Array<{ x: number; y: number; z: number; rot: number }> = [];
    const meadowGrass: GrassTuftPlacement[] = [];

    const pineTints = ['#315e3d', '#3d6e46', '#2a5335', '#467a4c'];
    const leafTints = ['#4f8244', '#5e924c', '#699b52', '#47763e'];
    const grassTints = ['#629845', '#73ab51', '#518539', '#7db559'];

    const isClearOfPaths = (x: number, z: number) => {
      if (Math.max(Math.abs(x), Math.abs(z)) < 1090) return false;
      if (Math.abs(x - riverCenterXAtZ(z)) < 21) return false;
      if (Math.abs(z - 78) < 12 && x > 1060 && x < 1380) return false;
      if (Math.abs(z + 26) < 12 && x < -1050 && x > -1285) return false;
      if (Math.abs(x + 26) < 12 && z < -780 && z > -1080) return false;
      if (Math.abs(x - 26) < 12 && z > 780 && z < 1100) return false;
      return true;
    };

    // 1,050 HD Alpine & Forest Trees surrounding the residential basin
    for (let i = 0; i < 1150; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 1092 + Math.pow(rand(), 0.72) * 690;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!isClearOfPaths(x, z)) continue;

      const y = terrainHeightAt(x, z);
      if (y > 68) continue; // Keep upper alpine snow peaks rocky & open
      const scale = 1.05 + rand() * 1.15;
      if (y > 24 || rand() < 0.56) {
        pines.push({ x, y, z, scale, tint: pineTints[i % pineTints.length] });
      } else {
        broadleafs.push({ x, y, z, scale, tint: leafTints[i % leafTints.length] });
      }
    }

    // Scenic rocky outcrops along hills and mountain foothills
    for (let i = 0; i < 165; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 1110 + rand() * 640;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.max(Math.abs(x), Math.abs(z)) < 1095) continue;
      const y = terrainHeightAt(x, z);
      const base = 0.9 + rand() * 1.9;
      rocks.push({
        x,
        y: y + base * 0.25,
        z,
        sx: base * (0.9 + rand() * 0.65),
        sy: base * (0.58 + rand() * 0.45),
        sz: base * (0.85 + rand() * 0.6),
        rot: rand() * Math.PI * 2,
      });
    }

    for (let i = 0; i < 48; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 1100 + rand() * 240;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!isClearOfPaths(x, z)) continue;
      const y = terrainHeightAt(x, z);
      hays.push({ x, y: y + 0.55, z, rot: rand() * Math.PI });
    }

    // 1,600+ wind-animated 3D grass tufts along the lush outer meadow ring
    for (let i = 0; i < 1900 && meadowGrass.length < 1600; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 1090 + rand() * 260;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.max(Math.abs(x), Math.abs(z)) < 1080) continue;
      if (!isClearOfPaths(x, z)) continue;
      const y = terrainHeightAt(x, z);
      if (y > 22) continue;
      meadowGrass.push({
        x,
        y,
        z,
        scale: 1.15 + rand() * 0.9,
        rotY: rand() * Math.PI * 2,
        tint: grassTints[meadowGrass.length % grassTints.length],
      });
    }

    return { pines, broadleafs, rocks, hays, meadowGrass };
  }, []);

  useEffect(() => {
    const allTrees = [...countrysideProps.pines, ...countrysideProps.broadleafs];

    if (trunkMeshRef.current) {
      allTrees.forEach((t, i) => {
        _dummy.position.set(t.x, t.y + 1.1 * t.scale, t.z);
        _dummy.rotation.set(0, (i * 0.9) % (Math.PI * 2), 0);
        _dummy.scale.set(t.scale, t.scale, t.scale);
        _dummy.updateMatrix();
        trunkMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      trunkMeshRef.current.instanceMatrix.needsUpdate = true;
      trunkMeshRef.current.computeBoundingSphere();
    }

    if (pineMeshRef.current) {
      countrysideProps.pines.forEach((t, i) => {
        _dummy.position.set(t.x, t.y + 3.15 * t.scale, t.z);
        _dummy.rotation.set(0, i * 0.7, 0);
        _dummy.scale.set(t.scale, t.scale * 1.15, t.scale);
        _dummy.updateMatrix();
        pineMeshRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(t.tint);
        pineMeshRef.current!.setColorAt(i, _color);
      });
      pineMeshRef.current.instanceMatrix.needsUpdate = true;
      if (pineMeshRef.current.instanceColor) pineMeshRef.current.instanceColor.needsUpdate = true;
      pineMeshRef.current.computeBoundingSphere();
    }

    if (broadleafMeshRef.current) {
      countrysideProps.broadleafs.forEach((t, i) => {
        _dummy.position.set(t.x, t.y + 2.85 * t.scale, t.z);
        _dummy.rotation.set(0, i * 1.1, 0);
        _dummy.scale.set(t.scale * 1.05, t.scale * 0.96, t.scale * 1.05);
        _dummy.updateMatrix();
        broadleafMeshRef.current!.setMatrixAt(i, _dummy.matrix);
        _color.set(t.tint);
        broadleafMeshRef.current!.setColorAt(i, _color);
      });
      broadleafMeshRef.current.instanceMatrix.needsUpdate = true;
      if (broadleafMeshRef.current.instanceColor) {
        broadleafMeshRef.current.instanceColor.needsUpdate = true;
      }
      broadleafMeshRef.current.computeBoundingSphere();
    }

    if (rockMeshRef.current) {
      countrysideProps.rocks.forEach((r, i) => {
        _dummy.position.set(r.x, r.y, r.z);
        _dummy.rotation.set(r.rot * 0.3, r.rot, 0);
        _dummy.scale.set(r.sx, r.sy, r.sz);
        _dummy.updateMatrix();
        rockMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      rockMeshRef.current.instanceMatrix.needsUpdate = true;
      rockMeshRef.current.computeBoundingSphere();
    }

    if (hayMeshRef.current) {
      countrysideProps.hays.forEach((h, i) => {
        _dummy.position.set(h.x, h.y, h.z);
        _dummy.rotation.set(Math.PI / 2, 0, h.rot);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        hayMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      hayMeshRef.current.instanceMatrix.needsUpdate = true;
      hayMeshRef.current.computeBoundingSphere();
    }
  }, [countrysideProps]);

  const totalTrees = countrysideProps.pines.length + countrysideProps.broadleafs.length;
  const bridgeX = riverCenterXAtZ(78);

  return (
    <group>
      {/* Unified Sculpted Alpine Mountains, Rolling Foothills & City Meadow Ground */}
      <mesh geometry={terrainGeo} receiveShadow>
        <meshStandardMaterial
          map={textures.grass}
          vertexColors
          roughness={0.95}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>

      {/* Winding Eastern Valley River with Animated 3D GLSL Water Waves */}
      <mesh geometry={riverGeo} material={riverWaterMat} receiveShadow />

      {/* 3D Wind-Swaying Meadow Grass Tufts */}
      <InstancedGrassField tufts={countrysideProps.meadowGrass} />

      {/* Country Gravel Trails Extending Out from City Road Stubs */}
      {trailGeos.map((geo, idx) => (
        <mesh key={`ctrail-${idx}`} geometry={geo} receiveShadow>
          <meshStandardMaterial color="#b49e7e" roughness={0.94} metalness={0} />
        </mesh>
      ))}

      {/* Rustic Stone & Timber Country Bridge Crossing the Eastern River (Z = 78) */}
      <group position={[bridgeX, -0.1, 78]}>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <boxGeometry args={[26, 0.45, 5.8]} />
          <meshStandardMaterial color="#9c9385" roughness={0.86} />
        </mesh>
        <mesh position={[0, 1.35, -2.75]}>
          <boxGeometry args={[25.6, 0.55, 0.25]} />
          <meshStandardMaterial color="#7d5d3f" roughness={0.84} />
        </mesh>
        <mesh position={[0, 1.35, 2.75]}>
          <boxGeometry args={[25.6, 0.55, 0.25]} />
          <meshStandardMaterial color="#7d5d3f" roughness={0.84} />
        </mesh>
        {[-10, 0, 10].map((px) => (
          <mesh key={px} position={[px, -0.35, 0]}>
            <boxGeometry args={[1.4, 2.0, 5.4]} />
            <meshStandardMaterial color="#7b756b" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Instanced HD Forest Trees (Merged multi-lobe broadleaf + 4-tier pines + Y-fork trunks) */}
      {totalTrees > 0 && (
        <instancedMesh ref={trunkMeshRef} args={[hdTrunkGeo, undefined, totalTrees]}>
          <meshStandardMaterial color="#5d432e" roughness={0.93} />
        </instancedMesh>
      )}
      {countrysideProps.pines.length > 0 && (
        <instancedMesh
          ref={pineMeshRef}
          args={[hdPineGeo, undefined, countrysideProps.pines.length]}
        >
          <meshStandardMaterial color="#ffffff" roughness={0.87} />
        </instancedMesh>
      )}
      {countrysideProps.broadleafs.length > 0 && (
        <instancedMesh
          ref={broadleafMeshRef}
          args={[hdBroadleafGeo, undefined, countrysideProps.broadleafs.length]}
        >
          <meshStandardMaterial color="#ffffff" roughness={0.86} />
        </instancedMesh>
      )}

      {/* Instanced Alpine & Field Boulders */}
      {countrysideProps.rocks.length > 0 && (
        <instancedMesh
          ref={rockMeshRef}
          args={[undefined, undefined, countrysideProps.rocks.length]}
        >
          <dodecahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color="#767b78" roughness={0.92} />
        </instancedMesh>
      )}

      {/* Instanced Meadow Hay Bales */}
      {countrysideProps.hays.length > 0 && (
        <instancedMesh ref={hayMeshRef} args={[undefined, undefined, countrysideProps.hays.length]}>
          <cylinderGeometry args={[0.72, 0.72, 1.35, 12]} />
          <meshStandardMaterial color="#ccb062" roughness={0.9} />
        </instancedMesh>
      )}
    </group>
  );
};
