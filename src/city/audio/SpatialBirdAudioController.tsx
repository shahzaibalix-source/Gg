import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraMode, TimeOfDay, TownPlot, WeatherMode } from '../types';
import { ROUNDABOUT_CENTERS, SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';
import { terrainHeightAt } from '../world/VastCountryside';
import { SpatialBirdEmitter, spatialBirdAudio } from './SpatialBirdAudio';

interface SpatialBirdAudioControllerProps {
  plots: TownPlot[];
  cameraMode: CameraMode;
  timeOfDay: TimeOfDay;
  weather: WeatherMode;
  enabled: boolean;
}

const CENTRAL_PARK_EMITTERS: SpatialBirdEmitter[] = [
  { x: 36.2, y: 3.8, z: -15.8, weight: 2.2, zone: 'park' },
  { x: 48.2, y: 3.6, z: -15.6, weight: 2.2, zone: 'park' },
  { x: 67.8, y: 3.8, z: -15.5, weight: 2.2, zone: 'park' },
  { x: 68.0, y: 3.8, z: -1.5, weight: 2.0, zone: 'park' },
  { x: 36.2, y: 3.6, z: 4.5, weight: 2.2, zone: 'park' },
  { x: 49.0, y: 3.5, z: 15.6, weight: 2.0, zone: 'park' },
  { x: 36.2, y: 3.8, z: 15.6, weight: 2.2, zone: 'park' },
  { x: 58.0, y: 3.2, z: -8.5, weight: 2.0, zone: 'park' },
];

const TOWN_SQUARE_EMITTERS: SpatialBirdEmitter[] = [
  { x: -14.8, y: 3.4, z: -14.8, weight: 1.3, zone: 'square' },
  { x: 14.8, y: 3.4, z: -14.8, weight: 1.3, zone: 'square' },
  { x: -14.8, y: 3.5, z: 14.8, weight: 1.3, zone: 'square' },
  { x: 14.8, y: 3.5, z: 14.8, weight: 1.3, zone: 'square' },
  { x: -14.8, y: 3.5, z: 3.5, weight: 1.2, zone: 'square' },
  { x: 14.8, y: 3.5, z: 3.5, weight: 1.2, zone: 'square' },
];

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _listenPos = new THREE.Vector3();

/**
 * Spatial 3D bird chirping controller mounted inside CityScene.
 * Syncs Web Audio AudioListener with the active viewport/character camera
 * and randomly triggers localized bird calls near trees, parks, and woods.
 */
export const SpatialBirdAudioController: React.FC<SpatialBirdAudioControllerProps> = ({
  plots,
  cameraMode,
  timeOfDay,
  weather,
  enabled,
}) => {
  const { camera } = useThree();
  const nextChirpTimerRef = useRef(0.9);
  const listenerSyncAccumRef = useRef(0);
  const candidatePoolRef = useRef<Array<{ emitter: SpatialBirdEmitter; score: number }>>([]);

  // Sync enabled state & bind first-interaction Web Audio unlock
  useEffect(() => {
    spatialBirdAudio.setEnabled(enabled);
    if (!enabled) return;
    return spatialBirdAudio.bindGestureUnlock();
  }, [enabled]);

  // Build spatial emitter index across all town trees, parks, roundabouts & countryside groves
  const emitters = useMemo<SpatialBirdEmitter[]>(() => {
    const list: SpatialBirdEmitter[] = [...CENTRAL_PARK_EMITTERS, ...TOWN_SQUARE_EMITTERS];

    for (const rb of ROUNDABOUT_CENTERS) {
      list.push({ x: rb.x, y: 3.2, z: rb.z, weight: 1.1, zone: 'square' });
    }

    for (const plot of plots) {
      if (!plot.gardenTrees || plot.gardenTrees.length === 0) continue;
      const cos = Math.cos(plot.facingAngle);
      const sin = Math.sin(plot.facingAngle);
      for (const gt of plot.gardenTrees) {
        const wx = plot.center.x + gt.x * cos + gt.z * sin;
        const wz = plot.center.z - gt.x * sin + gt.z * cos;
        list.push({
          x: wx,
          y: SIDEWALK_HEIGHT + 3.2 * gt.scale,
          z: wz,
          weight: 1.15,
          zone: 'garden',
        });
      }
    }

    // Representative countryside & perimeter woodland grove emitters
    let seed = 5109;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 42; i++) {
      const angle = (i / 42) * Math.PI * 2 + rand() * 0.14;
      const radius = 114 + rand() * 260;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      list.push({
        x,
        y: terrainHeightAt(x, z) + 4.2,
        z,
        weight: 1.25,
        zone: 'countryside',
      });
    }

    return list;
  }, [plots]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const dt = Math.min(delta, 0.1);

    // Derive camera forward & up vectors without allocations
    _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

    // Determine effective spatial listener coordinates:
    // - Walking mode listens straight from eye/follow camera
    // - Elevated modes (Free / Iso / Aerial / Tour) project gaze onto ground focus so
    //   panning over Central Park or gardens keeps nearby tree chirps vivid and localized
    if (cameraMode === 'walking') {
      _listenPos.copy(camera.position);
    } else {
      const lookY = _fwd.y;
      if (lookY < -0.08) {
        const tGround = THREE.MathUtils.clamp(-camera.position.y / lookY, 8, 220);
        _listenPos.set(
          camera.position.x + _fwd.x * tGround,
          Math.min(12, camera.position.y * 0.22),
          camera.position.z + _fwd.z * tGround,
        );
      } else {
        _listenPos.set(
          camera.position.x + _fwd.x * 35,
          Math.min(14, camera.position.y * 0.3),
          camera.position.z + _fwd.z * 35,
        );
      }
    }

    listenerSyncAccumRef.current += dt;
    if (listenerSyncAccumRef.current >= 0.05) {
      listenerSyncAccumRef.current = 0;
      spatialBirdAudio.updateListener(
        _listenPos.x,
        _listenPos.y,
        _listenPos.z,
        _fwd.x,
        _fwd.y,
        _fwd.z,
        _up.x,
        _up.y,
        _up.z,
      );
    }

    nextChirpTimerRef.current -= dt;
    if (nextChirpTimerRef.current > 0) return;

    // Schedule next randomized chirp interval based on time of day & weather
    const baseDelay =
      timeOfDay === 'morning'
        ? 0.85 + Math.random() * 1.4
        : timeOfDay === 'afternoon'
          ? 1.15 + Math.random() * 1.85
          : timeOfDay === 'sunset'
            ? 1.55 + Math.random() * 2.1
            : 2.6 + Math.random() * 3.2;
    const weatherMult = weather === 'rainy' ? 2.1 : weather === 'foggy' ? 1.35 : 1.0;
    nextChirpTimerRef.current = baseDelay * weatherMult;

    // Find trees / park zones within listening radius
    const maxRadius = cameraMode === 'walking' ? 68 : 95;
    const maxDistSq = maxRadius * maxRadius;
    const pool = candidatePoolRef.current;
    pool.length = 0;
    let totalScore = 0;

    for (let i = 0; i < emitters.length; i++) {
      const em = emitters[i];
      const dx = em.x - _listenPos.x;
      const dz = em.z - _listenPos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > maxDistSq) continue;

      const dist = Math.sqrt(distSq);
      const proximity = Math.max(0.12, 1 - dist / maxRadius);
      const score = proximity * proximity * em.weight;
      pool.push({ emitter: em, score });
      totalScore += score;
    }

    if (pool.length === 0 || totalScore <= 0) return;

    // Weighted random pick favoring closer trees and park zones
    let pick = Math.random() * totalScore;
    let chosen = pool[pool.length - 1].emitter;
    for (let i = 0; i < pool.length; i++) {
      pick -= pool[i].score;
      if (pick <= 0) {
        chosen = pool[i].emitter;
        break;
      }
    }

    const timeGain =
      timeOfDay === 'morning'
        ? 1.1
        : timeOfDay === 'afternoon'
          ? 0.95
          : timeOfDay === 'sunset'
            ? 0.82
            : 0.52;
    const weatherGain = weather === 'rainy' ? 0.45 : 1.0;

    spatialBirdAudio.triggerChirpAt(
      chosen.x,
      chosen.y,
      chosen.z,
      timeGain * weatherGain,
      cameraMode === 'walking' ? 10 : 18,
      maxRadius,
    );
  });

  return null;
};
