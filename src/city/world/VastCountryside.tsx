import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CityTextureSet } from '../materials/proceduralTextures';

interface VastCountrysideProps {
  textures: CityTextureSet;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * River centerline X coordinate as a function of Z (east of built town).
 */
export function riverCenterXAtZ(z: number): number {
  return 212 + Math.sin(z * 0.013) * 28 + Math.cos(z * 0.0055) * 16;
}

/**
 * Continuous heightfield for the vast open countryside surrounding the built town.
 * Strictly 0 inside the city footprint (|x|, |z| <= 132) so no built road, park,
 * building, or plot is ever displaced.
 */
export function terrainHeightAt(x: number, z: number): number {
  const edgeDist = Math.max(Math.abs(x), Math.abs(z));
  const cityMask = smoothstep(150, 215, edgeDist);
  if (cityMask <= 0.0001) return 0;

  // Undulating rolling countryside hills
  const rollA =
    Math.sin(x * 0.017 + 0.4) * Math.cos(z * 0.015 - 0.3) * 8.5 +
    Math.sin((x + z) * 0.009) * 6.0;
  const rollB = Math.cos(x * 0.036 - z * 0.028) * 2.4;

  // Distant mountain foothill ring (520m -> 1080m)
  const radial = Math.hypot(x, z);
  const ridgeMask = smoothstep(430, 880, radial);
  const ridgeNoise =
    0.55 +
    0.45 *
      (Math.sin(Math.atan2(z, x) * 5.0 + 0.7) * 0.6 +
        Math.cos(Math.atan2(z, x) * 11.0 - 1.2) * 0.4);
  const mountainHeight = ridgeMask * ridgeNoise * 64;

  // Gentle river channel depression along the eastern valley
  const rx = riverCenterXAtZ(z);
  const distToRiver = Math.abs(x - rx);
  const riverCarve = (1 - smoothstep(6, 26, distToRiver)) * smoothstep(155, 205, Math.abs(x));

  // Keep eastern bridge approach roads slightly leveled near z = -26 & z = 78
  const trailFlattenZ =
    Math.max(1 - smoothstep(5, 16, Math.abs(z + 26)), 1 - smoothstep(5, 16, Math.abs(z - 78))) *
    (1 - smoothstep(150, 320, Math.abs(x)));

  const rawHills = Math.max(-0.4, (rollA + rollB + 4.8) * (1 - trailFlattenZ * 0.7)) + mountainHeight;
  let h = cityMask * rawHills;
  h -= riverCarve * 5.2;

  return Math.max(-2.6, h);
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

const TRAIL_SEGMENTS: Array<{ x1: number; z1: number; x2: number; z2: number; width: number }> = [
  // West dirt country road
  { x1: -135, z1: -26, x2: -290, z2: -48, width: 5.2 },
  // North countryside lane
  { x1: -26, z1: -135, x2: -44, z2: -310, width: 5.0 },
  // South countryside lane
  { x1: 26, z1: 135, x2: 52, z2: 310, width: 5.0 },
  // East riverside country road (crosses the stone arch bridge at x ~ 212)
  { x1: 135, z1: 78, x2: 330, z2: 78, width: 5.4 },
];

export const VastCountryside: React.FC<VastCountrysideProps> = ({ textures }) => {
  const trunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const pineMeshRef = useRef<THREE.InstancedMesh>(null);
  const broadleafMeshRef = useRef<THREE.InstancedMesh>(null);
  const rockMeshRef = useRef<THREE.InstancedMesh>(null);
  const hayMeshRef = useRef<THREE.InstancedMesh>(null);

  // Sculpted vertex-colored 2400m x 2400m countryside terrain (25m grid aligns at ±150m)
  const terrainGeo = useMemo(() => {
    const size = 2400;
    const segs = 96;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const cMeadow = new THREE.Color('#8bb275');
    const cPasture = new THREE.Color('#6f9659');
    const cHill = new THREE.Color('#5a7e4a');
    const cRidge = new THREE.Color('#476246');
    const cBank = new THREE.Color('#8e8469');

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const edgeDist = Math.max(Math.abs(x), Math.abs(z));
      const y = edgeDist < 149.9 ? -0.03 : edgeDist < 150.1 ? 0 : terrainHeightAt(x, z);
      pos.setY(i, y);

      const radial = Math.hypot(x, z);
      const distToRiver = Math.abs(x - riverCenterXAtZ(z));

      _color.copy(cMeadow);
      _color.lerp(cPasture, smoothstep(150, 230, edgeDist));
      _color.lerp(cHill, smoothstep(6, 20, y));
      _color.lerp(cRidge, smoothstep(420, 860, radial) * 0.85);

      if (distToRiver < 16 && x > 140) {
        const bankMix = 1 - smoothstep(7, 16, distToRiver);
        _color.lerp(cBank, bankMix * 0.8);
      }

      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Continuous winding eastern river ribbon
  const riverGeo = useMemo(() => {
    const zSteps = 90;
    const zMin = -580;
    const zMax = 580;
    const halfWidth = 10.5;
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
    return geo;
  }, []);

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
        const h = terrainHeightAt(cx, cz) + 0.035;
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
      return geo;
    });
  }, []);

  useEffect(() => {
    return () => {
      terrainGeo.dispose();
      riverGeo.dispose();
      trailGeos.forEach((g) => g.dispose());
    };
  }, [terrainGeo, riverGeo, trailGeos]);

  // Procedural foliage, boulder & pasture placement across vast outer land
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

    const pineTints = ['#3b6a46', '#45764c', '#335d3e', '#4f7f51'];
    const leafTints = ['#548547', '#63934f', '#6d9b54', '#4d7a42'];

    const isClearOfPaths = (x: number, z: number) => {
      if (Math.max(Math.abs(x), Math.abs(z)) < 138) return false;
      if (Math.abs(x - riverCenterXAtZ(z)) < 18) return false;
      if (Math.abs(z - 78) < 11 && x > 130 && x < 340) return false;
      if (Math.abs(z + 26) < 11 && x < -130 && x > -300) return false;
      if (Math.abs(x + 26) < 11 && z < -130 && z > -320) return false;
      if (Math.abs(x - 26) < 11 && z > 130 && z < 320) return false;
      return true;
    };

    for (let i = 0; i < 420; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 144 + Math.pow(rand(), 0.78) * 390;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!isClearOfPaths(x, z)) continue;

      const y = terrainHeightAt(x, z);
      const scale = 0.95 + rand() * 0.95;
      if (rand() < 0.54) {
        pines.push({ x, y, z, scale, tint: pineTints[i % pineTints.length] });
      } else {
        broadleafs.push({ x, y, z, scale, tint: leafTints[i % leafTints.length] });
      }
    }

    for (let i = 0; i < 95; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 148 + rand() * 340;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.max(Math.abs(x), Math.abs(z)) < 140) continue;
      const y = terrainHeightAt(x, z);
      const base = 0.7 + rand() * 1.4;
      rocks.push({
        x,
        y: y + base * 0.3,
        z,
        sx: base * (0.9 + rand() * 0.6),
        sy: base * (0.55 + rand() * 0.4),
        sz: base * (0.85 + rand() * 0.6),
        rot: rand() * Math.PI * 2,
      });
    }

    for (let i = 0; i < 36; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 152 + rand() * 150;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!isClearOfPaths(x, z)) continue;
      const y = terrainHeightAt(x, z);
      hays.push({ x, y: y + 0.55, z, rot: rand() * Math.PI });
    }

    return { pines, broadleafs, rocks, hays };
  }, []);

  useEffect(() => {
    const allTrees = [...countrysideProps.pines, ...countrysideProps.broadleafs];

    if (trunkMeshRef.current) {
      allTrees.forEach((t, i) => {
        _dummy.position.set(t.x, t.y + 1.15 * t.scale, t.z);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(t.scale, t.scale, t.scale);
        _dummy.updateMatrix();
        trunkMeshRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      trunkMeshRef.current.instanceMatrix.needsUpdate = true;
      trunkMeshRef.current.computeBoundingSphere();
    }

    if (pineMeshRef.current) {
      countrysideProps.pines.forEach((t, i) => {
        _dummy.position.set(t.x, t.y + 3.4 * t.scale, t.z);
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
        _dummy.position.set(t.x, t.y + 3.0 * t.scale, t.z);
        _dummy.rotation.set(0, i * 1.1, 0);
        _dummy.scale.set(t.scale * 1.05, t.scale * 0.92, t.scale * 1.05);
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
      {/* Flat High-Detail Meadow Ground Beneath the Built Town Footprint */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial
          map={textures.grass}
          color="#8bb275"
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* Vast Undulating Open Countryside & Distant Horizon Hills (2400m x 2400m) */}
      <mesh geometry={terrainGeo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.96} metalness={0} />
      </mesh>

      {/* Winding Eastern Valley River */}
      <mesh geometry={riverGeo} receiveShadow>
        <meshPhysicalMaterial
          color="#2f6f8e"
          roughness={0.14}
          metalness={0.05}
          clearcoat={0.92}
          clearcoatRoughness={0.1}
          envMapIntensity={1.35}
        />
      </mesh>

      {/* Country Gravel Trails Extending Out from City Road Stubs */}
      {trailGeos.map((geo, idx) => (
        <mesh key={`ctrail-${idx}`} geometry={geo} receiveShadow>
          <meshStandardMaterial color="#b49e7e" roughness={0.94} metalness={0} />
        </mesh>
      ))}

      {/* Rustic Stone & Timber Country Bridge Crossing the Eastern River (Z = 78) */}
      <group position={[bridgeX, -0.1, 78]}>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <boxGeometry args={[24, 0.45, 5.8]} />
          <meshStandardMaterial color="#9c9385" roughness={0.86} />
        </mesh>
        <mesh position={[0, 1.35, -2.75]}>
          <boxGeometry args={[23.6, 0.55, 0.25]} />
          <meshStandardMaterial color="#7d5d3f" roughness={0.84} />
        </mesh>
        <mesh position={[0, 1.35, 2.75]}>
          <boxGeometry args={[23.6, 0.55, 0.25]} />
          <meshStandardMaterial color="#7d5d3f" roughness={0.84} />
        </mesh>
        {[-9, 0, 9].map((px) => (
          <mesh key={px} position={[px, -0.35, 0]}>
            <boxGeometry args={[1.4, 2.0, 5.4]} />
            <meshStandardMaterial color="#7b756b" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Instanced Countryside Forest Trees (Only 3 draw calls for 350+ trees) */}
      {totalTrees > 0 && (
        <instancedMesh ref={trunkMeshRef} args={[undefined, undefined, totalTrees]}>
          <cylinderGeometry args={[0.2, 0.34, 2.3, 6]} />
          <meshStandardMaterial color="#674931" roughness={0.92} />
        </instancedMesh>
      )}
      {countrysideProps.pines.length > 0 && (
        <instancedMesh
          ref={pineMeshRef}
          args={[undefined, undefined, countrysideProps.pines.length]}
        >
          <coneGeometry args={[1.65, 4.4, 7]} />
          <meshStandardMaterial color="#ffffff" roughness={0.88} />
        </instancedMesh>
      )}
      {countrysideProps.broadleafs.length > 0 && (
        <instancedMesh
          ref={broadleafMeshRef}
          args={[undefined, undefined, countrysideProps.broadleafs.length]}
        >
          <dodecahedronGeometry args={[1.75, 1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.88} />
        </instancedMesh>
      )}

      {/* Instanced Countryside Field Boulders */}
      {countrysideProps.rocks.length > 0 && (
        <instancedMesh
          ref={rockMeshRef}
          args={[undefined, undefined, countrysideProps.rocks.length]}
        >
          <dodecahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color="#7e827d" roughness={0.92} />
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
