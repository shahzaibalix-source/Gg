import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { SIDEWALK_HEIGHT, STREET_LAMPS } from './MasterTownBlueprint';
import { TimeOfDay } from '../types';
import type { MasterCityMap } from '../planning/types';

interface NightStreetLightsProps {
  timeOfDay: TimeOfDay;
  isSoftwareGl: boolean;
  masterPlan?: MasterCityMap | null;
}

const POOL_SIZE = 5;
const _camDir = new THREE.Vector3();
const _focus = new THREE.Vector3();

/**
 * Functional shadow-casting streetlight spotlight pool activated automatically at 'night'.
 * Dynamically tracks the 5 nearest streetlamps from MasterCityMap (or static STREET_LAMPS),
 * casting real shadows onto streets, sidewalks, vehicles, benches, and characters
 * while staying safely within WebGL's 16-texture-unit hardware limit.
 */
export const NightStreetLights: React.FC<NightStreetLightsProps> = ({
  timeOfDay,
  isSoftwareGl,
  masterPlan,
}) => {
  const { camera } = useThree();
  const spotRefs = useRef<Array<THREE.SpotLight | null>>([]);
  const targetRefs = useRef<Array<THREE.Object3D | null>>([]);
  const prevIndices = useMemo(() => {
    const arr = new Int32Array(POOL_SIZE);
    arr.fill(-1);
    return arr;
  }, []);
  const rankedIndices = useMemo(() => {
    const arr = new Int32Array(POOL_SIZE);
    arr.fill(-1);
    return arr;
  }, []);
  const bestDists = useMemo(() => new Float64Array(POOL_SIZE), []);

  const activeLamps = masterPlan?.streetLamps ?? STREET_LAMPS;

  // Precomputed bulb + ground target world coordinates (zero GC per frame)
  const lampWorldCoords = useMemo(() => {
    prevIndices.fill(-1);
    return activeLamps.map((lamp) => {
      const sin = Math.sin(lamp.rotationY);
      const cos = Math.cos(lamp.rotationY);
      return {
        bx: lamp.x + sin * 0.68,
        by: SIDEWALK_HEIGHT + 3.44,
        bz: lamp.z + cos * 0.68,
        tx: lamp.x + sin * 1.65,
        ty: 0.04,
        tz: lamp.z + cos * 1.65,
      };
    });
  }, [activeLamps, prevIndices]);

  useFrame(() => {
    if (timeOfDay !== 'night') return;

    camera.getWorldDirection(_camDir);
    const lookDist = camera.position.y > 45 ? 0 : 12;
    _focus.set(
      camera.position.x + _camDir.x * lookDist,
      0,
      camera.position.z + _camDir.z * lookDist,
    );

    // Find closest lamps to the current ground focus without heap allocations
    for (let k = 0; k < POOL_SIZE; k++) {
      rankedIndices[k] = -1;
      bestDists[k] = Infinity;
    }

    for (let i = 0; i < lampWorldCoords.length; i++) {
      const c = lampWorldCoords[i];
      const dx = c.bx - _focus.x;
      const dz = c.bz - _focus.z;
      const dSq = dx * dx + dz * dz;

      if (dSq < bestDists[POOL_SIZE - 1]) {
        let insertAt = POOL_SIZE - 1;
        while (insertAt > 0 && dSq < bestDists[insertAt - 1]) {
          bestDists[insertAt] = bestDists[insertAt - 1];
          rankedIndices[insertAt] = rankedIndices[insertAt - 1];
          insertAt--;
        }
        bestDists[insertAt] = dSq;
        rankedIndices[insertAt] = i;
      }
    }

    for (let k = 0; k < POOL_SIZE; k++) {
      const idx = rankedIndices[k];
      if (idx < 0 || idx === prevIndices[k]) continue;
      prevIndices[k] = idx;

      const spot = spotRefs.current[k];
      const tgt = targetRefs.current[k];
      if (!spot || !tgt) continue;

      const c = lampWorldCoords[idx];
      spot.position.set(c.bx, c.by, c.bz);
      tgt.position.set(c.tx, c.ty, c.tz);
      tgt.updateMatrixWorld();
      spot.target = tgt;
    }
  });

  if (timeOfDay !== 'night') return null;

  return (
    <group>
      {Array.from({ length: POOL_SIZE }).map((_, idx) => (
        <React.Fragment key={idx}>
          <object3D
            ref={(el) => {
              targetRefs.current[idx] = el;
            }}
          />
          <spotLight
            ref={(el) => {
              spotRefs.current[idx] = el;
            }}
            color="#ffd488"
            intensity={22}
            distance={25}
            angle={Math.PI * 0.4}
            penumbra={0.75}
            decay={1.4}
            castShadow={!isSoftwareGl}
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
            shadow-camera-near={0.6}
            shadow-camera-far={22}
            shadow-bias={-0.0008}
            shadow-normalBias={0.03}
          />
        </React.Fragment>
      ))}
    </group>
  );
};
