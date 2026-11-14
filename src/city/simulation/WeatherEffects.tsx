import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { TimeOfDay, WeatherMode } from '../types';

interface WeatherEffectsProps {
  weather: WeatherMode;
  timeOfDay: TimeOfDay;
}

const DROP_COUNT = 520;
const MIST_COUNT = 34;
const _dummy = new THREE.Object3D();

function createMistTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(205, 224, 255, 0.72)');
  grad.addColorStop(0.42, 'rgba(165, 195, 240, 0.34)');
  grad.addColorStop(0.75, 'rgba(120, 152, 208, 0.10)');
  grad.addColorStop(1, 'rgba(90, 120, 180, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Automated environmental weather effects:
 * 1. Instanced rain streaks when weather === 'rainy'
 * 2. Automated low-lying drifting night mist over lake, meadows & vast countryside
 *    whenever timeOfDay === 'night' (amplified if weather === 'foggy')
 */
export const WeatherEffects: React.FC<WeatherEffectsProps> = ({ weather, timeOfDay }) => {
  const rainRef = useRef<THREE.InstancedMesh>(null);
  const mistRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  const mistTex = useMemo(() => createMistTexture(), []);
  useEffect(() => () => mistTex.dispose(), [mistTex]);

  const drops = useMemo(() => {
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: DROP_COUNT }, () => ({
      ox: (rand() - 0.5) * 110,
      oy: rand() * 48,
      oz: (rand() - 0.5) * 110,
      speed: 26 + rand() * 10,
    }));
  }, []);

  // Automated low-lying mist banks: lake/park pockets + vast outer meadow ring
  const mistBanks = useMemo(() => {
    let seed = 9041;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const banks: Array<{
      baseX: number;
      baseZ: number;
      y: number;
      scale: number;
      phase: number;
      speed: number;
    }> = [
      // Gentle mist hovering just above Central Park Lake
      { baseX: 56, baseZ: -4, y: 0.55, scale: 26, phase: 0.4, speed: 0.35 },
      { baseX: 60, baseZ: 3, y: 0.65, scale: 24, phase: 1.9, speed: 0.3 },
    ];

    for (let i = 2; i < MIST_COUNT; i++) {
      const angle = (i / (MIST_COUNT - 2)) * Math.PI * 2 + rand() * 0.25;
      const dist = 148 + rand() * 260;
      banks.push({
        baseX: Math.cos(angle) * dist,
        baseZ: Math.sin(angle) * dist,
        y: 1.1 + rand() * 2.2,
        scale: 46 + rand() * 54,
        phase: rand() * Math.PI * 2,
        speed: 0.16 + rand() * 0.18,
      });
    }
    return banks;
  }, []);

  const showMist = timeOfDay === 'night' || weather === 'foggy';
  const mistOpacity =
    weather === 'foggy'
      ? timeOfDay === 'night'
        ? 0.28
        : 0.24
      : timeOfDay === 'night'
        ? weather === 'rainy'
          ? 0.2
          : 0.15
        : 0;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);

    if (weather === 'rainy' && rainRef.current) {
      const cx = THREE.MathUtils.clamp(camera.position.x, -420, 420);
      const cz = THREE.MathUtils.clamp(camera.position.z, -420, 420);

      for (let i = 0; i < DROP_COUNT; i++) {
        const d = drops[i];
        d.oy -= d.speed * dt;
        if (d.oy < 0) d.oy = 46;

        _dummy.position.set(cx + d.ox, d.oy, cz + d.oz);
        _dummy.rotation.set(0.06, 0, -0.08);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        rainRef.current.setMatrixAt(i, _dummy.matrix);
      }
      rainRef.current.instanceMatrix.needsUpdate = true;
    }

    if (showMist && mistRef.current) {
      const t = state.clock.elapsedTime;
      for (let i = 0; i < mistBanks.length; i++) {
        const m = mistBanks[i];
        const driftX = Math.sin(t * m.speed + m.phase) * 9;
        const driftZ = Math.cos(t * m.speed * 0.8 + m.phase) * 7;
        _dummy.position.set(m.baseX + driftX, m.y, m.baseZ + driftZ);
        _dummy.rotation.set(-Math.PI / 2, 0, t * 0.03 + m.phase);
        _dummy.scale.set(m.scale, m.scale, 1);
        _dummy.updateMatrix();
        mistRef.current.setMatrixAt(i, _dummy.matrix);
      }
      mistRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {weather === 'rainy' && (
        <instancedMesh ref={rainRef} args={[undefined, undefined, DROP_COUNT]} frustumCulled={false}>
          <boxGeometry args={[0.045, 0.85, 0.045]} />
          <meshBasicMaterial color="#bfd8eb" transparent opacity={0.48} />
        </instancedMesh>
      )}

      {showMist && mistOpacity > 0.01 && (
        <instancedMesh
          ref={mistRef}
          args={[undefined, undefined, MIST_COUNT]}
          frustumCulled={false}
          renderOrder={3}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={mistTex}
            color={timeOfDay === 'night' ? '#8cb2eb' : '#e6eef5'}
            transparent
            opacity={mistOpacity}
            depthWrite={false}
          />
        </instancedMesh>
      )}
    </>
  );
};
