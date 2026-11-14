import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PEDESTRIAN_LOOPS, SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';
import { CharacterAppearance, CharacterMesh } from '../assets/CharacterMesh';
import { Vec2 } from '../types';

interface PedestrianSpec {
  id: string;
  loopIndex: number;
  initialProgress: number;
  appearance: CharacterAppearance;
}

const PEDESTRIANS: PedestrianSpec[] = [
  {
    id: 'ped-1',
    loopIndex: 0,
    initialProgress: 0.12,
    appearance: {
      jacketColor: '#3f5d78',
      trouserColor: '#2d3138',
      skinColor: '#e8c1a0',
      hairColor: '#3c2a1e',
      shoeColor: '#2a221c',
    },
  },
  {
    id: 'ped-2',
    loopIndex: 0,
    initialProgress: 0.62,
    appearance: {
      jacketColor: '#a25343',
      trouserColor: '#373e47',
      skinColor: '#d9aa88',
      hairColor: '#231c18',
      shoeColor: '#29292d',
    },
  },
  {
    id: 'ped-3',
    loopIndex: 1,
    initialProgress: 0.18,
    appearance: {
      jacketColor: '#567554',
      trouserColor: '#d5cbb8',
      skinColor: '#edd0b6',
      hairColor: '#8d643c',
      shoeColor: '#4d3828',
    },
  },
  {
    id: 'ped-4',
    loopIndex: 1,
    initialProgress: 0.72,
    appearance: {
      jacketColor: '#c4975a',
      trouserColor: '#2e3540',
      skinColor: '#c9906b',
      hairColor: '#1f1b18',
      shoeColor: '#262320',
    },
  },
  {
    id: 'ped-5',
    loopIndex: 2,
    initialProgress: 0.35,
    appearance: {
      jacketColor: '#6b536b',
      trouserColor: '#31363f',
      skinColor: '#e6be9c',
      hairColor: '#593c28',
      shoeColor: '#282524',
    },
  },
  {
    id: 'ped-6',
    loopIndex: 2,
    initialProgress: 0.85,
    appearance: {
      jacketColor: '#486b7a',
      trouserColor: '#45484f',
      skinColor: '#d7a884',
      hairColor: '#b7925b',
      shoeColor: '#342c24',
    },
  },
  {
    id: 'ped-7',
    loopIndex: 3,
    initialProgress: 0.25,
    appearance: {
      jacketColor: '#7a634b',
      trouserColor: '#2d333c',
      skinColor: '#e5bea0',
      hairColor: '#2b221c',
      shoeColor: '#1e1d1c',
    },
  },
  {
    id: 'ped-8',
    loopIndex: 3,
    initialProgress: 0.75,
    appearance: {
      jacketColor: '#3a6658',
      trouserColor: '#2c3138',
      skinColor: '#f0cbb0',
      hairColor: '#69472b',
      shoeColor: '#2a221c',
    },
  },
  {
    id: 'ped-9',
    loopIndex: 4,
    initialProgress: 0.15,
    appearance: {
      jacketColor: '#2d4159',
      trouserColor: '#d8d2c6',
      skinColor: '#deb594',
      hairColor: '#241e19',
      shoeColor: '#36271d',
    },
  },
  {
    id: 'ped-10',
    loopIndex: 4,
    initialProgress: 0.65,
    appearance: {
      jacketColor: '#8c4b4b',
      trouserColor: '#30343b',
      skinColor: '#d4a381',
      hairColor: '#3a2b20',
      shoeColor: '#222226',
    },
  },
];

interface PedPath {
  waypoints: THREE.Vector3[];
  cumLengths: number[];
  totalLength: number;
}

function buildPedPath(waypoints: Vec2[]): PedPath {
  const pts = waypoints.map((w) => new THREE.Vector3(w.x, SIDEWALK_HEIGHT, w.z));
  const cum: number[] = [0];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    acc += a.distanceTo(b);
    cum.push(acc);
  }
  return { waypoints: pts, cumLengths: cum, totalLength: acc };
}

function samplePedPath(path: PedPath, dist: number, outPos: THREE.Vector3, outDir: THREE.Vector3): void {
  const d = ((dist % path.totalLength) + path.totalLength) % path.totalLength;
  const n = path.waypoints.length;
  for (let i = 0; i < n; i++) {
    if (d <= path.cumLengths[i + 1] || i === n - 1) {
      const segLen = path.cumLengths[i + 1] - path.cumLengths[i];
      const t = segLen > 0 ? (d - path.cumLengths[i]) / segLen : 0;
      const a = path.waypoints[i];
      const b = path.waypoints[(i + 1) % n];
      outPos.lerpVectors(a, b, t);
      outDir.subVectors(b, a).normalize();
      return;
    }
  }
}

const _pPos = new THREE.Vector3();
const _pDir = new THREE.Vector3();

export const PedestrianManager: React.FC = () => {
  const paths = useMemo(() => PEDESTRIAN_LOOPS.map((l) => buildPedPath(l.waypoints)), []);

  return (
    <group>
      {PEDESTRIANS.map((spec) => (
        <StrollingPedestrian
          key={spec.id}
          spec={spec}
          path={paths[spec.loopIndex]}
          walkSpeed={PEDESTRIAN_LOOPS[spec.loopIndex].walkSpeed}
        />
      ))}
    </group>
  );
};

interface StrollingPedestrianProps {
  spec: PedestrianSpec;
  path: PedPath;
  walkSpeed: number;
}

const StrollingPedestrian: React.FC<StrollingPedestrianProps> = ({ spec, path, walkSpeed }) => {
  const groupRef = useRef<THREE.Group>(null);
  const distRef = useRef(spec.initialProgress * path.totalLength);
  const yawRef = useRef(0);
  const speedRef = useRef(walkSpeed);

  const initialPos = useMemo(() => {
    const p = new THREE.Vector3();
    const d = new THREE.Vector3();
    samplePedPath(path, spec.initialProgress * path.totalLength, p, d);
    return [p.x, p.y, p.z] as [number, number, number];
  }, [path, spec.initialProgress]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    distRef.current += walkSpeed * dt;
    samplePedPath(path, distRef.current, _pPos, _pDir);

    const targetYaw = Math.atan2(_pDir.x, _pDir.z);
    let diff = targetYaw - yawRef.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yawRef.current += diff * Math.min(1, dt * 8);

    if (groupRef.current) {
      groupRef.current.position.copy(_pPos);
      groupRef.current.rotation.y = yawRef.current;
    }
  });

  return (
    <group ref={groupRef} position={initialPos}>
      <CharacterMesh appearance={spec.appearance} speedRef={speedRef} />
    </group>
  );
};
