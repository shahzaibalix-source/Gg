import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TimeOfDay } from '../types';
import { FollowerRecord } from './types';
import { SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';
import { VIP_DISPLAY_LABEL } from './zipFollowerParser';

interface OGMonumentWallProps {
  position: [number, number, number];
  ogMembers: FollowerRecord[];
  timeOfDay: TimeOfDay;
  onOpenMonumentModal: () => void;
}

function buildMonumentTabletTexture(
  title: string,
  entries: FollowerRecord[],
  isHeroVip = false,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isHeroVip ? '#1b1407' : '#141923';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = isHeroVip ? '#facc15' : '#d4af37';
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, 992, 992);

  ctx.fillStyle = '#fde047';
  ctx.font = '700 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 512, 74, 920);

  ctx.strokeStyle = 'rgba(212,175,55,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 98);
  ctx.lineTo(960, 98);
  ctx.stroke();

  if (isHeroVip && entries[0]) {
    const vip = entries[0];
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 32px sans-serif';
    ctx.fillText('LINDENHOF HONOREE #1 · VIP SOVEREIGN', 512, 210, 920);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 84px sans-serif';
    ctx.fillText(VIP_DISPLAY_LABEL, 512, 345, 920);

    ctx.fillStyle = '#fde68a';
    ctx.font = '600 42px sans-serif';
    ctx.fillText(`@${vip.username}`, 512, 430, 920);

    ctx.fillStyle = '#d1d5db';
    ctx.font = '500 30px sans-serif';
    ctx.fillText(`Permanent ID: ${vip.residentId}  ·  Plot: ${vip.plotCode}`, 512, 540, 920);
    ctx.fillText(`Joined: ${vip.joinedAt}`, 512, 595, 920);
    ctx.fillText(`Verified Chronological Rank: #${vip.oldestRank} Oldest`, 512, 650, 920);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 28px sans-serif';
    ctx.fillText('TAP MONUMENT TO INSPECT ALL 50 OG MEMBERS', 512, 920, 920);
  } else {
    ctx.textAlign = 'left';
    const startY = 148;
    const rowH = 68;
    entries.slice(0, 13).forEach((m, i) => {
      const y = startY + i * rowH;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent';
      ctx.fillRect(42, y - 42, 940, rowH - 6);

      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 30px monospace';
      ctx.fillText(`#${String(m.ogRank ?? i + 1).padStart(2, '0')}`, 62, y);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 32px sans-serif';
      ctx.fillText(`@${m.username}`, 158, y, 520);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 24px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(m.joinedAt.replace(', 2026', ''), 962, y, 270);
      ctx.textAlign = 'left';
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Grand Architectural Monument Wall at the entrance to the OG Members Premium District
 * showcasing Sweet_thedevil (#1) and all 50 OG Member Instagram usernames.
 */
export const OGMonumentWall: React.FC<OGMonumentWallProps> = ({
  position,
  ogMembers,
  timeOfDay,
  onOpenMonumentModal,
}) => {
  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';

  const textures = useMemo(() => {
    const vip = ogMembers[0] ? [ogMembers[0]] : [];
    const others = ogMembers.slice(1);
    const panel1 = buildMonumentTabletTexture('★ #1 SPECIAL VIP HONOREE ★', vip, true);
    const panel2 = buildMonumentTabletTexture('OG FOUNDERS · #02 – #14', others.slice(0, 13));
    const panel3 = buildMonumentTabletTexture('OG FOUNDERS · #15 – #27', others.slice(13, 26));
    const panel4 = buildMonumentTabletTexture('OG FOUNDERS · #28 – #40', others.slice(26, 39));
    const panel5 = buildMonumentTabletTexture('OG FOUNDERS · #41 – #50', others.slice(39, 49));
    return { panel1, panel2, panel3, panel4, panel5 };
  }, [ogMembers]);

  useEffect(() => {
    return () => {
      textures.panel1.dispose();
      textures.panel2.dispose();
      textures.panel3.dispose();
      textures.panel4.dispose();
      textures.panel5.dispose();
    };
  }, [textures]);

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onOpenMonumentModal();
      }}
    >
      {/* Monument Marble Plaza Pad */}
      <mesh position={[0, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[34, SIDEWALK_HEIGHT, 14]} />
        <meshStandardMaterial color="#dbd3c4" roughness={0.72} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 0.2, 0]} receiveShadow>
        <boxGeometry args={[29, 0.4, 6.2]} />
        <meshStandardMaterial color="#cfc6b4" roughness={0.68} />
      </mesh>

      {/* Central Triumphal Hero Arch Honoring Sweet_thedevil */}
      <mesh position={[0, SIDEWALK_HEIGHT + 3.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.6, 7.0, 1.4]} />
        <meshStandardMaterial color="#ede6d6" roughness={0.62} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 7.75, 0]} castShadow>
        <boxGeometry args={[7.4, 0.7, 1.8]} />
        <meshStandardMaterial color="#d4af37" roughness={0.28} metalness={0.84} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 3.85, 0.74]}>
        <planeGeometry args={[5.8, 5.8]} />
        <meshStandardMaterial
          map={textures.panel1}
          emissive="#f59e0b"
          emissiveIntensity={isEvening ? 0.35 : 0.06}
          roughness={0.34}
        />
      </mesh>

      {/* Four Flanking Marble Tablets Listing All 50 OG Members */}
      {[
        { x: -11.4, tex: textures.panel2 },
        { x: -6.4, tex: textures.panel3 },
        { x: 6.4, tex: textures.panel4 },
        { x: 11.4, tex: textures.panel5 },
      ].map((wing, idx) => (
        <group key={idx} position={[wing.x, SIDEWALK_HEIGHT + 0.4, 0]}>
          <mesh position={[0, 2.7, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.6, 5.4, 0.9]} />
            <meshStandardMaterial color="#e3dccb" roughness={0.68} />
          </mesh>
          <mesh position={[0, 5.55, 0]}>
            <boxGeometry args={[4.85, 0.32, 1.1]} />
            <meshStandardMaterial color="#b99335" roughness={0.32} metalness={0.78} />
          </mesh>
          <mesh position={[0, 2.7, 0.48]}>
            <planeGeometry args={[4.2, 4.75]} />
            <meshStandardMaterial
              map={wing.tex}
              emissive="#e5b84b"
              emissiveIntensity={isEvening ? 0.25 : 0.04}
              roughness={0.38}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};
