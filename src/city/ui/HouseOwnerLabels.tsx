import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraMode, TownPlot } from '../types';
import { PlayerPoseState } from '../player/WalkingPlayerController';
import {
  ExpansionCityWorld,
  queryNearbyExpansionPlots,
} from '../expansion/ExpansionMasterPlan';

interface HouseOwnerLabelsProps {
  plots: TownPlot[];
  expansionWorld?: ExpansionCityWorld | null;
  cameraMode: CameraMode;
  playerPoseRef: React.MutableRefObject<PlayerPoseState>;
}

interface LabelCandidate {
  id: string;
  plotCode: string;
  ownerName: string;
  tier: 'vip' | 'og' | 'core' | 'resident' | 'open';
  x: number;
  y: number;
  z: number;
  distSq: number;
}

const MAX_BADGES = 30;
const QUERY_RADIUS = 105;
const MAX_CACHE_TEXTURES = 96;
const _lookDir = new THREE.Vector3();

function drawBadgeTexture(
  plotCode: string,
  ownerName: string,
  tier: LabelCandidate['tier'],
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, 512, 144);

    const isVip = tier === 'vip';
    const isOg = tier === 'og';
    const bg = isVip
      ? 'rgba(30, 20, 8, 0.92)'
      : isOg
        ? 'rgba(19, 25, 38, 0.9)'
        : 'rgba(15, 23, 36, 0.88)';
    const border = isVip
      ? '#facc15'
      : isOg
        ? '#f59e0b'
        : tier === 'open'
          ? '#4ade80'
          : '#38bdf8';
    const subColor = isVip
      ? '#fde68a'
      : isOg
        ? '#fcd34d'
        : tier === 'open'
          ? '#86efac'
          : '#93c5fd';

    // Rounded pill card with pointer notch
    const rx = 18;
    const ry = 10;
    const rw = 476;
    const rh = 106;
    const rad = 24;

    ctx.beginPath();
    ctx.moveTo(rx + rad, ry);
    ctx.lineTo(rx + rw - rad, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rad);
    ctx.lineTo(rx + rw, ry + rh - rad);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rad, ry + rh);
    ctx.lineTo(272, ry + rh);
    ctx.lineTo(256, ry + rh + 18);
    ctx.lineTo(240, ry + rh);
    ctx.lineTo(rx + rad, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rad);
    ctx.lineTo(rx, ry + rad);
    ctx.quadraticCurveTo(rx, ry, rx + rad, ry);
    ctx.closePath();

    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = isVip ? 5 : 3.5;
    ctx.strokeStyle = border;
    ctx.stroke();

    // Top tiny badge code line
    ctx.fillStyle = subColor;
    ctx.font = '700 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tagPrefix = isVip
      ? 'NO. 1 ROYAL PALACE • '
      : isOg
        ? 'OG VILLA • '
        : tier === 'open'
          ? 'OPEN PLOT • '
          : 'HOME • ';
    ctx.fillText(`${tagPrefix}${plotCode}`, 256, 40);

    // Owner username line
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 34px system-ui, -apple-system, sans-serif';
    const clippedOwner = ownerName.length > 22 ? `${ownerName.slice(0, 20)}..` : ownerName;
    ctx.fillText(clippedOwner, 256, 82);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const SingleOwnerSprite: React.FC<{
  item: LabelCandidate;
  textureCache: Map<string, THREE.CanvasTexture>;
}> = ({ item, textureCache }) => {
  const spriteRef = useRef<THREE.Sprite>(null);

  const texture = useMemo(() => {
    const key = `${item.tier}:${item.plotCode}:${item.ownerName}`;
    const existing = textureCache.get(key);
    if (existing) {
      // Refresh LRU insertion order
      textureCache.delete(key);
      textureCache.set(key, existing);
      return existing;
    }
    const created = drawBadgeTexture(item.plotCode, item.ownerName, item.tier);
    textureCache.set(key, created);
    while (textureCache.size > MAX_CACHE_TEXTURES) {
      const oldestKey = textureCache.keys().next().value;
      if (!oldestKey) break;
      const oldestTex = textureCache.get(oldestKey);
      textureCache.delete(oldestKey);
      oldestTex?.dispose();
    }
    return created;
  }, [item.tier, item.plotCode, item.ownerName, textureCache]);

  const baseScale = item.tier === 'vip' ? 1.32 : item.tier === 'og' ? 1.08 : 0.96;

  useFrame((state) => {
    if (spriteRef.current) {
      const bob = Math.sin(state.clock.elapsedTime * 1.9 + item.x * 0.17) * 0.16;
      spriteRef.current.position.set(item.x, item.y + bob, item.z);
    }
  });

  return (
    <sprite
      ref={spriteRef}
      position={[item.x, item.y, item.z]}
      scale={[6.8 * baseScale, 1.92 * baseScale, 1]}
      renderOrder={8}
    >
      <spriteMaterial map={texture} transparent depthTest depthWrite={false} />
    </sprite>
  );
};

/**
 * Pure-WebGL floating overhead house-owner badges above nearby homes.
 * Shows house code & resident @username without HTML overlays or canvas bloat.
 */
export const HouseOwnerLabels: React.FC<HouseOwnerLabelsProps> = ({
  plots,
  expansionWorld,
  cameraMode,
  playerPoseRef,
}) => {
  const { camera } = useThree();
  const [visibleBadges, setVisibleBadges] = useState<LabelCandidate[]>([]);
  const textureCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());
  const lastCheckRef = useRef<{ t: number; fx: number; fz: number; key: string }>({
    t: -10,
    fx: 9999,
    fz: 9999,
    key: '',
  });

  useEffect(() => {
    const cache = textureCacheRef.current;
    return () => {
      cache.forEach((tex) => tex.dispose());
      cache.clear();
    };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (t - lastCheckRef.current.t < 0.24) return;

    let fx: number;
    let fz: number;
    if (cameraMode === 'walking') {
      fx = playerPoseRef.current.x;
      fz = playerPoseRef.current.z;
    } else {
      camera.getWorldDirection(_lookDir);
      const scale =
        Math.abs(_lookDir.y) > 0.14 ? camera.position.y / -_lookDir.y : 42;
      const clamped = THREE.MathUtils.clamp(scale, 8, 95);
      fx = camera.position.x + _lookDir.x * clamped;
      fz = camera.position.z + _lookDir.z * clamped;
    }

    if (
      camera.position.y > 220 &&
      cameraMode !== 'walking'
    ) {
      if (lastCheckRef.current.key !== '') {
        lastCheckRef.current = { t, fx, fz, key: '' };
        setVisibleBadges([]);
      } else {
        lastCheckRef.current.t = t;
      }
      return;
    }

    const moved = Math.hypot(fx - lastCheckRef.current.fx, fz - lastCheckRef.current.fz);
    if (moved < 4.0 && lastCheckRef.current.key !== '') {
      lastCheckRef.current.t = t;
      return;
    }

    const candidates: LabelCandidate[] = [];
    const maxRadiusSq = QUERY_RADIUS * QUERY_RADIUS;

    // 1. Core district houses
    for (let i = 0; i < plots.length; i++) {
      const p = plots[i];
      if (!p.house) continue;
      const dx = p.center.x - fx;
      const dz = p.center.z - fz;
      const dSq = dx * dx + dz * dz;
      if (dSq > maxRadiusSq) continue;
      const handle = p.ownerUsername
        ? `@${p.ownerUsername.replace(/^@/, '')}`
        : p.ownershipStatus === 'available'
          ? 'Available Home'
          : 'Lindenhof Home';
      candidates.push({
        id: p.id,
        plotCode: p.plotCode,
        ownerName: handle,
        tier: p.ownerUsername ? 'core' : 'open',
        x: p.center.x,
        y: p.house.wallHeight + 5.1,
        z: p.center.z,
        distSq: dSq,
      });
    }

    // 2. Expansion district built houses + VIP Palace
    if (expansionWorld) {
      const vip = expansionWorld.vipPlot;
      if (vip) {
        const dx = vip.x - fx;
        const dz = vip.z - fz;
        const dSq = dx * dx + dz * dz;
        if (dSq <= 128 * 128) {
          candidates.push({
            id: vip.plotId,
            plotCode: vip.plotCode,
            ownerName: `@${(vip.resident?.username ?? 'Sweet_thedevil').replace(/^@/, '')}`,
            tier: 'vip',
            x: vip.x,
            y: 19.2,
            z: vip.z,
            distSq: dSq * 0.45,
          });
        }
      }

      const nearExp = queryNearbyExpansionPlots(
        expansionWorld.spatialIndex,
        fx,
        fz,
        QUERY_RADIUS,
      );
      for (let i = 0; i < nearExp.length; i++) {
        const ep = nearExp[i];
        if (ep.status === 'vip' || !ep.houseStyle) continue;
        const dx = ep.x - fx;
        const dz = ep.z - fz;
        const dSq = dx * dx + dz * dz;
        if (dSq > maxRadiusSq) continue;
        const owner = ep.resident?.username
          ? `@${ep.resident.username.replace(/^@/, '')}`
          : 'Surveyed Home';
        candidates.push({
          id: ep.plotId,
          plotCode: ep.plotCode,
          ownerName: owner,
          tier: ep.status === 'og' ? 'og' : ep.resident ? 'resident' : 'open',
          x: ep.x,
          y: ep.houseStyle.wallHeight + (ep.status === 'og' ? 6.1 : 4.8),
          z: ep.z,
          distSq: dSq,
        });
      }
    }

    candidates.sort((a, b) => a.distSq - b.distSq);
    const top = candidates.slice(0, MAX_BADGES);
    const nextKey = top.map((c) => `${c.id}:${c.ownerName}`).join('|');

    lastCheckRef.current = { t, fx, fz, key: nextKey };
    if (nextKey !== visibleBadges.map((c) => `${c.id}:${c.ownerName}`).join('|')) {
      setVisibleBadges(top);
    }
  });

  if (visibleBadges.length === 0) return null;

  return (
    <group>
      {visibleBadges.map((item) => (
        <SingleOwnerSprite
          key={item.id}
          item={item}
          textureCache={textureCacheRef.current}
        />
      ))}
    </group>
  );
};
