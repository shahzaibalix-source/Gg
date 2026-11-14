import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TimeOfDay } from '../types';
import { ExpansionPlotSpec } from './types';
import { SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';
import { VIP_DISPLAY_LABEL } from './zipFollowerParser';

interface SweetTheDevilPalaceProps {
  plot: ExpansionPlotSpec;
  timeOfDay: TimeOfDay;
  isSelected: boolean;
  onSelect: (plot: ExpansionPlotSpec) => void;
}

/**
 * The Most Prestigious Mansion in Lindenhof — Exclusive Royal VIP Estate honoring "Sweet_thedevil"
 * Positioned at the grand central axial plaza directly north of Town Hall & OG Monument.
 */
export const SweetTheDevilPalace: React.FC<SweetTheDevilPalaceProps> = ({
  plot,
  timeOfDay,
  isSelected,
  onSelect,
}) => {
  const crownRef = useRef<THREE.Mesh>(null);
  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';
  const username = plot.resident?.username ?? VIP_DISPLAY_LABEL;
  const joinedAt = plot.resident?.joinedAt ?? 'Verified OG #1 VIP';

  // Monumental Gold & Obsidian Recognition Display Marquee Texture
  const marqueeTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 448;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 1024, 448);
    grad.addColorStop(0, '#181105');
    grad.addColorStop(0.5, '#2b1e07');
    grad.addColorStop(1, '#140e04');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 448);

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 18;
    ctx.strokeRect(18, 18, 988, 412);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, 952, 376);

    ctx.fillStyle = '#fde047';
    ctx.font = '700 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ LINDENHOF SPECIAL #1 ROYAL VIP ESTATE ★', 512, 108, 900);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 84px sans-serif';
    ctx.fillText(VIP_DISPLAY_LABEL, 512, 224, 900);

    ctx.fillStyle = '#fcd34d';
    ctx.font = '600 34px sans-serif';
    ctx.fillText(`@${username}  ·  ${plot.plotCode}  ·  ${plot.resident?.residentId ?? 'RES-0001'}`, 512, 304, 900);

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '500 28px sans-serif';
    ctx.fillText(`Joined ${joinedAt}  ·  Founding Sovereign Honor`, 512, 368, 900);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }, [username, joinedAt, plot.plotCode, plot.resident?.residentId]);

  useEffect(() => {
    return () => marqueeTexture.dispose();
  }, [marqueeTexture]);

  useFrame((state, delta) => {
    if (crownRef.current) {
      crownRef.current.rotation.y += delta * 0.7;
      crownRef.current.position.y = 14.3 + Math.sin(state.clock.elapsedTime * 1.8) * 0.25;
    }
  });

  return (
    <group
      position={[plot.x, 0, plot.z]}
      rotation={[0, plot.facingAngle, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(plot);
      }}
    >
      {/* Royal Marble Forecourt Pad (48m x 40m) */}
      <mesh position={[0, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[plot.width, SIDEWALK_HEIGHT, plot.depth]} />
        <meshStandardMaterial color="#e6dfd1" roughness={0.62} metalness={0.04} />
      </mesh>

      {/* Emerald Lawn Wings */}
      {[-15.5, 15.5].map((lx) => (
        <mesh key={lx} position={[lx, SIDEWALK_HEIGHT + 0.02, 2]} receiveShadow>
          <boxGeometry args={[14, 0.04, 30]} />
          <meshStandardMaterial color="#4f8f4e" roughness={0.9} />
        </mesh>
      ))}

      {/* Grand Central Marble Staircase & Stepped Plinth */}
      <mesh position={[0, SIDEWALK_HEIGHT + 0.35, -3.5]} castShadow receiveShadow>
        <boxGeometry args={[32, 0.7, 16]} />
        <meshStandardMaterial color="#d8d0c0" roughness={0.58} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 0.2, 6.2]} receiveShadow>
        <boxGeometry args={[10, 0.4, 3.6]} />
        <meshStandardMaterial color="#cec5b3" roughness={0.62} />
      </mesh>

      {/* Main 3-Story Travertine Royal Chateau */}
      <mesh position={[0, SIDEWALK_HEIGHT + 5.1, -3.5]} castShadow receiveShadow>
        <boxGeometry args={[19.5, 9.0, 12.2]} />
        <meshStandardMaterial color="#fbf6ea" roughness={0.64} />
      </mesh>

      {/* Flanking Twin Luxury Pavilions */}
      {[-14.2, 14.2].map((wx) => (
        <group key={wx} position={[wx, SIDEWALK_HEIGHT + 0.7, -3.2]}>
          <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[8.6, 6.4, 9.8]} />
            <meshStandardMaterial color="#f5eedf" roughness={0.68} />
          </mesh>
          <mesh position={[0, 7.1, 0]} castShadow>
            <boxGeometry args={[9.2, 1.4, 10.4]} />
            <meshStandardMaterial color="#253245" roughness={0.55} metalness={0.18} />
          </mesh>
          <mesh position={[0, 7.9, 0]}>
            <boxGeometry args={[9.3, 0.18, 10.5]} />
            <meshStandardMaterial color="#d4af37" roughness={0.28} metalness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Classical Colonnade Portico (6 Fluted Marble Columns + Gold Pediment) */}
      {[-6.2, -3.7, -1.2, 1.2, 3.7, 6.2].map((cx) => (
        <mesh key={cx} position={[cx, SIDEWALK_HEIGHT + 3.4, 3.6]} castShadow>
          <cylinderGeometry args={[0.34, 0.4, 5.6, 14]} />
          <meshStandardMaterial color="#f8f4ea" roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, SIDEWALK_HEIGHT + 6.5, 3.6]} castShadow>
        <boxGeometry args={[14.8, 0.75, 2.2]} />
        <meshStandardMaterial color="#e7dcc4" roughness={0.55} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 7.25, 3.6]} castShadow>
        <coneGeometry args={[7.8, 1.6, 4]} />
        <meshStandardMaterial color="#d4af37" roughness={0.28} metalness={0.84} />
      </mesh>

      {/* Mansard Main Roof + Golden Triumphal Cupola Dome */}
      <mesh position={[0, SIDEWALK_HEIGHT + 10.35, -3.5]} castShadow>
        <boxGeometry args={[20.2, 1.6, 13.0]} />
        <meshStandardMaterial color="#253245" roughness={0.52} metalness={0.22} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 12.1, -3.5]} castShadow>
        <cylinderGeometry args={[3.4, 3.8, 2.2, 24]} />
        <meshStandardMaterial color="#fbf6ea" roughness={0.55} />
      </mesh>
      <mesh position={[0, SIDEWALK_HEIGHT + 13.2, -3.5]} castShadow>
        <sphereGeometry args={[3.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#d4af37"
          roughness={0.22}
          metalness={0.9}
          emissive={isEvening ? '#8a620f' : '#000000'}
          emissiveIntensity={isEvening ? 0.45 : 0}
        />
      </mesh>

      {/* Floating Golden VIP Beacon Finial */}
      <mesh ref={crownRef} position={[0, 14.3, -3.5]}>
        <octahedronGeometry args={[1.15, 0]} />
        <meshStandardMaterial
          color="#fde047"
          emissive="#f59e0b"
          emissiveIntensity={isEvening ? 2.2 : 0.8}
          roughness={0.18}
          metalness={0.85}
        />
      </mesh>

      {/* Glowing Grand Estate Windows */}
      {[-6.5, -2.5, 2.5, 6.5].map((wx) => (
        <React.Fragment key={wx}>
          <mesh position={[wx, SIDEWALK_HEIGHT + 3.2, 2.65]}>
            <boxGeometry args={[1.8, 2.6, 0.12]} />
            <meshStandardMaterial
              color="#7da0b5"
              emissive={isEvening ? '#ffd07b' : '#263442'}
              emissiveIntensity={isEvening ? 1.5 : 0.1}
              roughness={0.1}
              metalness={0.35}
            />
          </mesh>
          <mesh position={[wx, SIDEWALK_HEIGHT + 7.2, 2.65]}>
            <boxGeometry args={[1.6, 2.2, 0.12]} />
            <meshStandardMaterial
              color="#7da0b5"
              emissive={isEvening ? '#ffd07b' : '#263442'}
              emissiveIntensity={isEvening ? 1.5 : 0.1}
              roughness={0.1}
              metalness={0.35}
            />
          </mesh>
        </React.Fragment>
      ))}

      {/* Royal Turquoise Courtyard Fountain */}
      <group position={[0, SIDEWALK_HEIGHT, 11.8]}>
        <mesh position={[0, 0.28, 0]} receiveShadow>
          <cylinderGeometry args={[3.4, 3.6, 0.55, 24]} />
          <meshStandardMaterial color="#e6dfd1" roughness={0.62} />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <cylinderGeometry args={[2.9, 2.9, 0.08, 24]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            roughness={0.08}
            metalness={0.12}
            clearcoat={0.95}
          />
        </mesh>
      </group>

      {/* LARGEST RECOGNITION DISPLAY IN LINDENHOF AT COURTYARD FRONT (+Z) */}
      <group position={[0, SIDEWALK_HEIGHT, 17.5]}>
        <mesh position={[-3.2, 2.2, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.34, 4.4, 12]} />
          <meshStandardMaterial color="#d4af37" roughness={0.26} metalness={0.86} />
        </mesh>
        <mesh position={[3.2, 2.2, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.34, 4.4, 12]} />
          <meshStandardMaterial color="#d4af37" roughness={0.26} metalness={0.86} />
        </mesh>
        <mesh position={[0, 3.1, 0]} castShadow>
          <boxGeometry args={[7.0, 3.1, 0.32]} />
          <meshStandardMaterial color="#2a1e0b" roughness={0.45} metalness={0.55} />
        </mesh>
        <mesh position={[0, 3.1, 0.18]}>
          <planeGeometry args={[6.6, 2.85]} />
          <meshStandardMaterial
            map={marqueeTexture}
            emissive="#f59e0b"
            emissiveIntensity={isEvening ? 0.38 : 0.08}
            roughness={0.32}
            metalness={0.18}
          />
        </mesh>
      </group>

      {/* Selection Outline Ring */}
      {isSelected && (
        <mesh position={[0, SIDEWALK_HEIGHT + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[24.5, 25.4, 48]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};
