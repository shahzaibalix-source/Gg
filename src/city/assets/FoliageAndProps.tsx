import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeOfDay } from '../types';

/**
 * Shared wind-sway uniform updated once per frame in WindTimeUpdater.
 */
export const globalWindUniform = { value: 0 };

export const WindTimeUpdater: React.FC = () => {
  useFrame((state) => {
    globalWindUniform.value = state.clock.elapsedTime;
  });
  return null;
};

function createWindFoliageMaterial(baseColor: string, roughness = 0.84): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness: 0.02,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = globalWindUniform;
    shader.vertexShader =
      `uniform float uWindTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
        float swayWeight = clamp((position.y + 0.5) * 0.45, 0.0, 1.5);
        float gust = sin(uWindTime * 1.45 + worldPos.x * 0.22 + worldPos.z * 0.19);
        float flutter = cos(uWindTime * 2.6 + worldPos.z * 0.65) * 0.35;
        transformed.x += (gust + flutter) * 0.055 * swayWeight;
        transformed.z += (gust * 0.6 - flutter) * 0.045 * swayWeight;
        `,
      );
  };
  mat.customProgramCacheKey = () => `wind_foliage_${baseColor}`;
  return mat;
}

// -----------------------------------------------------------------------------
// Module-Level Shared Geometries & Materials (eliminates ~420+ duplicate shaders)
// -----------------------------------------------------------------------------
const TREE_MATERIALS = {
  barkDefault: new THREE.MeshStandardMaterial({ color: '#584234', roughness: 0.94, metalness: 0.01 }),
  barkOrnamental: new THREE.MeshStandardMaterial({ color: '#6b5344', roughness: 0.94, metalness: 0.01 }),
  broadleafPrimary: createWindFoliageMaterial('#436e3d', 0.84),
  broadleafSecondary: createWindFoliageMaterial('#528046', 0.82),
  cypressPrimary: createWindFoliageMaterial('#33593a', 0.84),
  cypressSecondary: createWindFoliageMaterial('#3d6944', 0.82),
  ornamentalPrimary: createWindFoliageMaterial('#6c8b4e', 0.84),
  ornamentalSecondary: createWindFoliageMaterial('#819f5c', 0.82),
};

const TREE_GEOS = {
  cypressTrunk: new THREE.CylinderGeometry(0.12, 0.2, 1.3, 8),
  cypressCone1: new THREE.ConeGeometry(0.82, 2.7, 10),
  cypressCone2: new THREE.ConeGeometry(0.64, 2.2, 10),
  cypressCone3: new THREE.ConeGeometry(0.38, 1.4, 9),

  ornamentalTrunk: new THREE.CylinderGeometry(0.1, 0.16, 1.5, 8),
  ornamentalBranch: new THREE.CylinderGeometry(0.05, 0.08, 0.85, 6),
  ornamentalCrownMain: new THREE.DodecahedronGeometry(1.05, 1),
  ornamentalCrownSideL: new THREE.DodecahedronGeometry(0.68, 1),
  ornamentalCrownSideR: new THREE.DodecahedronGeometry(0.65, 1),

  broadTrunk: new THREE.CylinderGeometry(0.17, 0.3, 2.2, 10),
  broadBranch: new THREE.CylinderGeometry(0.07, 0.11, 1.1, 7),
  broadCrownMain: new THREE.IcosahedronGeometry(1.45, 1),
  broadCrownSideL: new THREE.IcosahedronGeometry(0.98, 1),
  broadCrownSideR: new THREE.IcosahedronGeometry(0.95, 1),
  broadCrownFront: new THREE.IcosahedronGeometry(0.88, 1),
  broadCrownTop: new THREE.IcosahedronGeometry(0.92, 1),
};

interface TreeProps {
  position: [number, number, number];
  scale?: number;
  variant?: 'broadleaf' | 'cypress' | 'ornamental';
  rotationY?: number;
  castShadow?: boolean;
}

export const StylizedTree: React.FC<TreeProps> = ({
  position,
  scale = 1,
  variant = 'broadleaf',
  rotationY = 0,
  castShadow = true,
}) => {
  if (variant === 'cypress') {
    return (
      <group position={position} scale={scale} rotation={[0, rotationY, 0]}>
        <mesh
          position={[0, 0.65, 0]}
          geometry={TREE_GEOS.cypressTrunk}
          material={TREE_MATERIALS.barkDefault}
          castShadow={castShadow}
          receiveShadow
        />
        <mesh
          position={[0, 2.35, 0]}
          geometry={TREE_GEOS.cypressCone1}
          material={TREE_MATERIALS.cypressPrimary}
          castShadow={castShadow}
          receiveShadow
        />
        <mesh
          position={[0, 3.65, 0]}
          geometry={TREE_GEOS.cypressCone2}
          material={TREE_MATERIALS.cypressSecondary}
          castShadow={castShadow}
          receiveShadow
        />
        <mesh
          position={[0, 4.75, 0]}
          geometry={TREE_GEOS.cypressCone3}
          material={TREE_MATERIALS.cypressPrimary}
          castShadow={castShadow}
        />
      </group>
    );
  }

  if (variant === 'ornamental') {
    return (
      <group position={position} scale={scale} rotation={[0, rotationY, 0]}>
        <mesh
          position={[0, 0.75, 0]}
          geometry={TREE_GEOS.ornamentalTrunk}
          material={TREE_MATERIALS.barkOrnamental}
          castShadow={castShadow}
          receiveShadow
        />
        <mesh
          position={[-0.25, 1.55, 0.1]}
          rotation={[0.18, 0, 0.38]}
          geometry={TREE_GEOS.ornamentalBranch}
          material={TREE_MATERIALS.barkOrnamental}
        />
        <mesh
          position={[0.25, 1.55, -0.08]}
          rotation={[-0.14, 0, -0.35]}
          geometry={TREE_GEOS.ornamentalBranch}
          material={TREE_MATERIALS.barkOrnamental}
        />
        <mesh
          position={[0, 2.25, 0]}
          geometry={TREE_GEOS.ornamentalCrownMain}
          material={TREE_MATERIALS.ornamentalPrimary}
          castShadow={castShadow}
          receiveShadow
        />
        <mesh
          position={[-0.55, 1.95, 0.3]}
          geometry={TREE_GEOS.ornamentalCrownSideL}
          material={TREE_MATERIALS.ornamentalSecondary}
          castShadow={castShadow}
        />
        <mesh
          position={[0.52, 2.0, -0.26]}
          geometry={TREE_GEOS.ornamentalCrownSideR}
          material={TREE_MATERIALS.ornamentalSecondary}
          castShadow={castShadow}
        />
      </group>
    );
  }

  // Broadleaf Linden / Oak tree (5-part crown + flared trunk + branches)
  return (
    <group position={position} scale={scale} rotation={[0, rotationY, 0]}>
      <mesh
        position={[0, 1.1, 0]}
        geometry={TREE_GEOS.broadTrunk}
        material={TREE_MATERIALS.barkDefault}
        castShadow={castShadow}
        receiveShadow
      />
      <mesh
        position={[-0.36, 2.25, 0.18]}
        rotation={[0.2, 0, 0.45]}
        geometry={TREE_GEOS.broadBranch}
        material={TREE_MATERIALS.barkDefault}
      />
      <mesh
        position={[0.38, 2.2, -0.15]}
        rotation={[-0.18, 0, -0.42]}
        geometry={TREE_GEOS.broadBranch}
        material={TREE_MATERIALS.barkDefault}
      />
      <mesh
        position={[0, 3.4, 0]}
        geometry={TREE_GEOS.broadCrownMain}
        material={TREE_MATERIALS.broadleafPrimary}
        castShadow={castShadow}
        receiveShadow
      />
      <mesh
        position={[-0.85, 2.95, 0.42]}
        geometry={TREE_GEOS.broadCrownSideL}
        material={TREE_MATERIALS.broadleafSecondary}
        castShadow={castShadow}
        receiveShadow
      />
      <mesh
        position={[0.88, 3.0, -0.35]}
        geometry={TREE_GEOS.broadCrownSideR}
        material={TREE_MATERIALS.broadleafSecondary}
        castShadow={castShadow}
        receiveShadow
      />
      <mesh
        position={[0.12, 3.05, 0.82]}
        geometry={TREE_GEOS.broadCrownFront}
        material={TREE_MATERIALS.broadleafPrimary}
        castShadow={castShadow}
      />
      <mesh
        position={[-0.15, 4.15, -0.15]}
        geometry={TREE_GEOS.broadCrownTop}
        material={TREE_MATERIALS.broadleafSecondary}
        castShadow={castShadow}
      />
    </group>
  );
};

// -----------------------------------------------------------------------------
// Shared Streetlamp Resources + Soft Radial Glow Pool Texture
// -----------------------------------------------------------------------------
function makeRadialPoolTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 218, 138, 0.45)');
  grad.addColorStop(0.45, 'rgba(255, 206, 118, 0.20)');
  grad.addColorStop(0.8, 'rgba(255, 196, 100, 0.05)');
  grad.addColorStop(1, 'rgba(255, 196, 100, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeLightConeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255, 224, 150, 0.34)');
  grad.addColorStop(0.55, 'rgba(255, 212, 130, 0.12)');
  grad.addColorStop(1, 'rgba(255, 205, 115, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const LAMP_GEOS = {
  base: new THREE.CylinderGeometry(0.14, 0.22, 0.5, 10),
  pole: new THREE.CylinderGeometry(0.055, 0.095, 3.4, 10),
  arm: new THREE.CylinderGeometry(0.04, 0.045, 0.72, 8),
  cap: new THREE.ConeGeometry(0.24, 0.18, 6),
  globe: new THREE.CylinderGeometry(0.16, 0.12, 0.28, 6),
  cone: new THREE.ConeGeometry(2.1, 3.1, 14, 1, true),
  pool: new THREE.PlaneGeometry(7.2, 7.2),
};

const LAMP_MATERIALS = {
  base: new THREE.MeshStandardMaterial({ color: '#25292e', roughness: 0.45, metalness: 0.78 }),
  pole: new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.42, metalness: 0.8 }),
  cap: new THREE.MeshStandardMaterial({ color: '#1f2328', roughness: 0.4, metalness: 0.82 }),
  globeDay: new THREE.MeshStandardMaterial({
    color: '#e8e4d9',
    emissive: '#ffb84d',
    emissiveIntensity: 0.05,
    roughness: 0.2,
  }),
  globeSunset: new THREE.MeshStandardMaterial({
    color: '#ffe6ab',
    emissive: '#ffb84d',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  }),
  globeNight: new THREE.MeshStandardMaterial({
    color: '#ffe6ab',
    emissive: '#ffb84d',
    emissiveIntensity: 3.6,
    roughness: 0.2,
  }),
  cone: new THREE.MeshBasicMaterial({
    map: makeLightConeTexture(),
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }),
  pool: new THREE.MeshBasicMaterial({
    map: makeRadialPoolTexture(),
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  }),
};

interface StreetLampProps {
  position: [number, number, number];
  rotationY: number;
  timeOfDay: TimeOfDay;
}

export const EuropeanStreetLamp: React.FC<StreetLampProps> = ({
  position,
  rotationY,
  timeOfDay,
}) => {
  const isNight = timeOfDay === 'night';
  const globeMat = isNight
    ? LAMP_MATERIALS.globeNight
    : timeOfDay === 'sunset'
      ? LAMP_MATERIALS.globeSunset
      : LAMP_MATERIALS.globeDay;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh
        position={[0, 0.25, 0]}
        geometry={LAMP_GEOS.base}
        material={LAMP_MATERIALS.base}
        castShadow
        receiveShadow
      />
      <mesh
        position={[0, 2.05, 0]}
        geometry={LAMP_GEOS.pole}
        material={LAMP_MATERIALS.pole}
        castShadow
      />
      <mesh
        position={[0, 3.72, 0.34]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={LAMP_GEOS.arm}
        material={LAMP_MATERIALS.pole}
      />
      <mesh
        position={[0, 3.68, 0.68]}
        geometry={LAMP_GEOS.cap}
        material={LAMP_MATERIALS.cap}
      />
      <mesh position={[0, 3.48, 0.68]} geometry={LAMP_GEOS.globe} material={globeMat} />
      {isNight && (
        <group position={[0, 0, 0.68]}>
          <mesh
            position={[0, 1.85, 0]}
            geometry={LAMP_GEOS.cone}
            material={LAMP_MATERIALS.cone}
          />
          <mesh
            position={[0, 0.02, 0.25]}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={LAMP_GEOS.pool}
            material={LAMP_MATERIALS.pool}
          />
        </group>
      )}
    </group>
  );
};

// -----------------------------------------------------------------------------
// Shared Bench Resources
// -----------------------------------------------------------------------------
const BENCH_GEOS = {
  leg: new THREE.BoxGeometry(0.08, 0.44, 0.56),
  seat: new THREE.BoxGeometry(1.76, 0.06, 0.5),
  back: new THREE.BoxGeometry(1.76, 0.32, 0.05),
};

const BENCH_MATERIALS = {
  iron: new THREE.MeshStandardMaterial({ color: '#262a2e', roughness: 0.45, metalness: 0.75 }),
  wood: new THREE.MeshStandardMaterial({ color: '#8f5d38', roughness: 0.76 }),
};

interface ParkBenchProps {
  position: [number, number, number];
  rotationY?: number;
}

export const ParkBench: React.FC<ParkBenchProps> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[-0.75, 0.22, 0]} geometry={BENCH_GEOS.leg} material={BENCH_MATERIALS.iron} castShadow />
    <mesh position={[0.75, 0.22, 0]} geometry={BENCH_GEOS.leg} material={BENCH_MATERIALS.iron} castShadow />
    <mesh
      position={[0, 0.44, 0.04]}
      geometry={BENCH_GEOS.seat}
      material={BENCH_MATERIALS.wood}
      castShadow
      receiveShadow
    />
    <mesh
      position={[0, 0.72, -0.22]}
      rotation={[-0.2, 0, 0]}
      geometry={BENCH_GEOS.back}
      material={BENCH_MATERIALS.wood}
      castShadow
    />
  </group>
);

// -----------------------------------------------------------------------------
// Shared Nameplate Post/Board Resources
// -----------------------------------------------------------------------------
const SIGN_GEOS = {
  post: new THREE.BoxGeometry(0.08, 0.96, 0.08),
  board: new THREE.BoxGeometry(1.05, 0.46, 0.06),
  plate: new THREE.PlaneGeometry(0.98, 0.42),
};

const SIGN_MATERIALS = {
  post: new THREE.MeshStandardMaterial({ color: '#59402e', roughness: 0.86 }),
  board: new THREE.MeshStandardMaterial({ color: '#423124', roughness: 0.78 }),
};

interface PlotNameplateSignProps {
  position: [number, number, number];
  rotationY?: number;
  plotCode: string;
  ownerUsername: string | null;
}

/**
 * Personalized community wooden & brass plot nameplate sign.
 * Renders crisp resident name or "Claim Residence" directly on a procedural CanvasTexture.
 */
export const PlotNameplateSign: React.FC<PlotNameplateSignProps> = ({
  position,
  rotationY = 0,
  plotCode,
  ownerUsername,
}) => {
  const signTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 224;
    const ctx = canvas.getContext('2d')!;

    if (ownerUsername) {
      ctx.fillStyle = '#2b333d';
      ctx.fillRect(0, 0, 512, 224);
      ctx.strokeStyle = '#c8a96e';
      ctx.lineWidth = 10;
      ctx.strokeRect(12, 12, 488, 200);

      ctx.fillStyle = '#c8a96e';
      ctx.font = '600 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(plotCode, 256, 72);

      ctx.fillStyle = '#f8f5ef';
      ctx.font = '700 42px sans-serif';
      ctx.fillText(ownerUsername, 256, 146);
    } else {
      ctx.fillStyle = '#eef3ed';
      ctx.fillRect(0, 0, 512, 224);
      ctx.strokeStyle = '#3f6a4b';
      ctx.lineWidth = 12;
      ctx.strokeRect(12, 12, 488, 200);

      ctx.fillStyle = '#3f6a4b';
      ctx.font = '700 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`PLOT ${plotCode} · OPEN`, 256, 86);

      ctx.fillStyle = '#1f2933';
      ctx.font = '600 34px sans-serif';
      ctx.fillText('Claim Residence', 256, 148);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [plotCode, ownerUsername]);

  useEffect(() => {
    return () => {
      signTexture.dispose();
    };
  }, [signTexture]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[-0.36, 0.48, 0]} geometry={SIGN_GEOS.post} material={SIGN_MATERIALS.post} castShadow />
      <mesh position={[0.36, 0.48, 0]} geometry={SIGN_GEOS.post} material={SIGN_MATERIALS.post} castShadow />
      <mesh position={[0, 0.78, 0.03]} geometry={SIGN_GEOS.board} material={SIGN_MATERIALS.board} castShadow />
      <mesh position={[0, 0.78, 0.068]} geometry={SIGN_GEOS.plate}>
        <meshStandardMaterial
          map={signTexture}
          roughness={0.42}
          metalness={0.1}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  );
};

/**
 * Animated tiered stone fountain for Lindenhof Central Park.
 */
export const ParkFountain: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const waterRef = useRef<THREE.Mesh>(null);
  const sprayRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (waterRef.current) {
      waterRef.current.position.y = 0.44 + Math.sin(t * 2.2) * 0.012;
    }
    if (sprayRef.current) {
      const s = 0.92 + Math.sin(t * 4.5) * 0.1;
      sprayRef.current.scale.set(s, 0.9 + Math.cos(t * 5.2) * 0.14, s);
    }
  });

  return (
    <group position={position}>
      {/* Outer octagonal basin wall */}
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.2, 3.35, 0.56, 16]} />
        <meshStandardMaterial color="#c4bdb0" roughness={0.84} />
      </mesh>
      {/* Water basin surface */}
      <mesh ref={waterRef} position={[0, 0.44, 0]} receiveShadow>
        <cylinderGeometry args={[2.9, 2.9, 0.08, 24]} />
        <meshPhysicalMaterial
          color="#468ea8"
          roughness={0.08}
          metalness={0.14}
          clearcoat={0.95}
          envMapIntensity={1.4}
          transparent
          opacity={0.88}
        />
      </mesh>
      {/* Center Pedestal */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.62, 1.2, 12]} />
        <meshStandardMaterial color="#b7b0a2" roughness={0.82} />
      </mesh>
      {/* Upper Bowl */}
      <mesh position={[0, 1.48, 0]} castShadow>
        <cylinderGeometry args={[1.15, 0.45, 0.34, 16]} />
        <meshStandardMaterial color="#c9c2b5" roughness={0.82} />
      </mesh>
      {/* Top Finial */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.24, 0.55, 10]} />
        <meshStandardMaterial color="#b7b0a2" roughness={0.82} />
      </mesh>
      {/* Animated Water Spray Jet */}
      <mesh ref={sprayRef} position={[0, 2.38, 0]}>
        <coneGeometry args={[0.38, 0.72, 12, 1, true]} />
        <meshStandardMaterial
          color="#c8ebfa"
          transparent
          opacity={0.55}
          roughness={0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
