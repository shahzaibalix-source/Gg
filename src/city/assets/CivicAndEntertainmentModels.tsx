import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PublicBuildingSpec, TimeOfDay } from '../types';
import { CityTextureSet } from '../materials/proceduralTextures';

interface CivicBuildingProps {
  spec: PublicBuildingSpec;
  textures: CityTextureSet;
  timeOfDay: TimeOfDay;
}

/**
 * Landmark European civic, public service, and entertainment complexes
 * (Town Hall, Hospital, School, University, Police, Fire Station, Cinema, Football Stadium).
 */
export const CivicOrEntertainmentBuilding: React.FC<CivicBuildingProps> = ({
  spec,
  textures,
  timeOfDay,
}) => {
  const isNight = timeOfDay === 'night' || timeOfDay === 'sunset';
  const marqueeMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (marqueeMatRef.current) {
      const base = isNight ? 1.9 : 0.45;
      marqueeMatRef.current.emissiveIntensity =
        base + Math.sin(state.clock.elapsedTime * 3.4) * 0.35;
    }
  });

  const winEmissive = isNight ? '#ffca78' : '#2a3c4a';
  const winIntensity = isNight ? 1.15 : 0.08;

  if (spec.category === 'town-hall') {
    return (
      <group>
        {/* Grand Limestone Step Plinth */}
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[18.2, 0.7, 11.8]} />
          <meshStandardMaterial color="#c9c2b4" roughness={0.85} />
        </mesh>
        {/* Main Neoclassical Civic Hall */}
        <mesh position={[0, 3.9, 0]} castShadow receiveShadow>
          <boxGeometry args={[17.2, 6.4, 10.6]} />
          <meshStandardMaterial map={textures.plaster} color="#eee6d6" roughness={0.8} />
        </mesh>
        {/* Mansard Slate Roof */}
        <mesh position={[0, 8.0, 0]} castShadow>
          <boxGeometry args={[17.8, 1.9, 11.2]} />
          <meshStandardMaterial map={textures.slateRoof} color="#3a424d" roughness={0.74} />
        </mesh>
        {/* Front Portico Columns & Pediment */}
        {[-3.6, -2.1, -0.7, 0.7, 2.1, 3.6].map((cx, i) => (
          <mesh key={i} position={[cx, 3.6, 5.7]} castShadow>
            <cylinderGeometry args={[0.24, 0.28, 5.8, 12]} />
            <meshStandardMaterial color="#f2ece0" roughness={0.75} />
          </mesh>
        ))}
        <mesh position={[0, 6.75, 5.7]} castShadow>
          <boxGeometry args={[8.4, 0.7, 1.5]} />
          <meshStandardMaterial color="#e4dccb" roughness={0.78} />
        </mesh>
        {/* Tall Central Clock Tower & Copper Dome */}
        <mesh position={[0, 10.9, 0.4]} castShadow>
          <boxGeometry args={[3.8, 5.2, 3.8]} />
          <meshStandardMaterial color="#eae1cf" roughness={0.8} />
        </mesh>
        <mesh position={[0, 14.3, 0.4]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[2.65, 2.8, 4]} />
          <meshStandardMaterial color="#4c7a6b" roughness={0.48} metalness={0.32} />
        </mesh>
        {/* Illuminated Clock Face (oriented forward along +Z) */}
        <group position={[0, 11.6, 2.34]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.98, 0.98, 0.06, 24]} />
            <meshStandardMaterial color="#8f723e" roughness={0.35} metalness={0.75} />
          </mesh>
          <mesh position={[0, 0, 0.025]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.88, 0.88, 0.04, 24]} />
            <meshStandardMaterial
              color="#fff8e8"
              emissive="#ffe2a3"
              emissiveIntensity={isNight ? 1.8 : 0.25}
            />
          </mesh>
          <mesh position={[0, 0.2, 0.055]}>
            <boxGeometry args={[0.05, 0.46, 0.02]} />
            <meshStandardMaterial color="#1f2328" roughness={0.4} />
          </mesh>
          <mesh position={[0.18, 0, 0.055]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.045, 0.36, 0.02]} />
            <meshStandardMaterial color="#1f2328" roughness={0.4} />
          </mesh>
        </group>
        {/* Arched Entrance & Windows */}
        {[-6.2, -3.8, 3.8, 6.2].map((wx, i) => (
          <React.Fragment key={i}>
            <mesh position={[wx, 2.5, 5.34]}>
              <boxGeometry args={[1.35, 2.1, 0.08]} />
              <meshStandardMaterial
                color="#7c9eb2"
                emissive={winEmissive}
                emissiveIntensity={winIntensity}
                roughness={0.1}
              />
            </mesh>
            <mesh position={[wx, 5.3, 5.34]}>
              <boxGeometry args={[1.35, 1.7, 0.08]} />
              <meshStandardMaterial
                color="#7c9eb2"
                emissive={winEmissive}
                emissiveIntensity={winIntensity}
                roughness={0.1}
              />
            </mesh>
          </React.Fragment>
        ))}
      </group>
    );
  }

  if (spec.category === 'stadium') {
    return (
      <group>
        {/* Football Turf Pitch */}
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[26, 0.16, 17]} />
          <meshStandardMaterial color="#3c7a3b" roughness={0.92} />
        </mesh>
        {/* White Pitch Markings */}
        <mesh position={[0, 0.168, 0]}>
          <boxGeometry args={[0.14, 0.016, 15.2]} />
          <meshStandardMaterial color="#f4f3ee" roughness={0.7} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
        <mesh position={[0, 0.168, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.1, 2.26, 28]} />
          <meshStandardMaterial color="#f4f3ee" roughness={0.7} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
        {/* Clean Goal Frames */}
        {[-12.2, 12.2].map((gx, gi) => {
          const dir = gx < 0 ? -1 : 1;
          return (
            <group key={gi} position={[gx, 0.16, 0]}>
              <mesh position={[0, 0.78, -1.9]} castShadow>
                <cylinderGeometry args={[0.05, 0.05, 1.56, 8]} />
                <meshStandardMaterial color="#f4f3ee" roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.78, 1.9]} castShadow>
                <cylinderGeometry args={[0.05, 0.05, 1.56, 8]} />
                <meshStandardMaterial color="#f4f3ee" roughness={0.4} />
              </mesh>
              <mesh position={[0, 1.56, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.05, 3.9, 8]} />
                <meshStandardMaterial color="#f4f3ee" roughness={0.4} />
              </mesh>
              <mesh position={[dir * 0.45, 0.78, 0]}>
                <boxGeometry args={[0.85, 1.5, 3.76]} />
                <meshStandardMaterial
                  color="#e7e5e4"
                  transparent
                  opacity={0.22}
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        })}
        {/* North & South Tiered Spectator Stands */}
        {[-10.2, 10.2].map((sz, si) => (
          <group key={si} position={[0, 0, sz]}>
            {[0, 1, 2].map((tier) => (
              <mesh
                key={tier}
                position={[0, 0.5 + tier * 0.7, (si === 0 ? -1 : 1) * tier * 0.9]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[23, 0.7, 1.1]} />
                <meshStandardMaterial
                  color={tier === 1 ? '#365878' : '#b7b2a6'}
                  roughness={0.8}
                />
              </mesh>
            ))}
          </group>
        ))}
        {/* 4 Stadium Floodlight Towers */}
        {[
          [-13.5, -10.5],
          [13.5, -10.5],
          [-13.5, 10.5],
          [13.5, 10.5],
        ].map(([fx, fz], fi) => (
          <group key={fi} position={[fx, 0, fz]}>
            <mesh position={[0, 4.4, 0]} castShadow>
              <cylinderGeometry args={[0.14, 0.22, 8.8, 8]} />
              <meshStandardMaterial color="#3c424a" roughness={0.45} metalness={0.75} />
            </mesh>
            <mesh position={[0, 8.8, 0]}>
              <boxGeometry args={[1.4, 0.65, 0.45]} />
              <meshStandardMaterial
                color="#fffbe6"
                emissive="#fff2c2"
                emissiveIntensity={isNight ? 2.6 : 0.2}
              />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (spec.category === 'cinema') {
    return (
      <group>
        <mesh position={[0, 3.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[spec.width, 7.2, spec.depth]} />
          <meshStandardMaterial color="#36323b" roughness={0.75} />
        </mesh>
        {/* Art-Deco Vertical Ribbing */}
        {[-4.5, -2.5, 2.5, 4.5].map((rx, i) => (
          <mesh key={i} position={[rx, 3.8, spec.depth / 2 + 0.12]} castShadow>
            <boxGeometry args={[0.55, 6.8, 0.24]} />
            <meshStandardMaterial color="#d4b475" roughness={0.45} metalness={0.45} />
          </mesh>
        ))}
        {/* Projecting Animated Illuminated Marquee */}
        <mesh position={[0, 3.4, spec.depth / 2 + 1.0]} castShadow>
          <boxGeometry args={[6.8, 1.35, 1.9]} />
          <meshStandardMaterial
            ref={marqueeMatRef}
            color="#9b2f35"
            emissive="#ffb84d"
            emissiveIntensity={isNight ? 1.8 : 0.4}
            roughness={0.35}
          />
        </mesh>
        {/* Red Carpet Entrance */}
        <mesh position={[0, 0.03, spec.depth / 2 + 1.1]} receiveShadow>
          <boxGeometry args={[2.6, 0.04, 2.2]} />
          <meshStandardMaterial color="#9e2a2f" roughness={0.88} />
        </mesh>
      </group>
    );
  }

  if (spec.category === 'hospital') {
    return (
      <group>
        <mesh position={[0, 3.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[spec.width, 7.2, spec.depth]} />
          <meshStandardMaterial color="#f2f4f7" roughness={0.62} />
        </mesh>
        <mesh position={[0, 7.35, 0]} castShadow>
          <boxGeometry args={[spec.width + 0.3, 0.3, spec.depth + 0.3]} />
          <meshStandardMaterial color="#3a5f7d" roughness={0.5} />
        </mesh>
        {/* Red Cross Emblem (non-coplanar depths to prevent Z-fighting) */}
        <mesh position={[0, 5.4, spec.depth / 2 + 0.08]}>
          <boxGeometry args={[1.5, 0.45, 0.075]} />
          <meshStandardMaterial color="#cf2f2f" emissive="#cf2f2f" emissiveIntensity={isNight ? 1.2 : 0.2} />
        </mesh>
        <mesh position={[0, 5.4, spec.depth / 2 + 0.084]}>
          <boxGeometry args={[0.45, 1.5, 0.08]} />
          <meshStandardMaterial color="#cf2f2f" emissive="#cf2f2f" emissiveIntensity={isNight ? 1.2 : 0.2} />
        </mesh>
        {/* Ambulance Canopy & Glazed Windows */}
        <mesh position={[0, 2.4, spec.depth / 2 + 1.1]} castShadow>
          <boxGeometry args={[5.2, 0.22, 2.2]} />
          <meshStandardMaterial color="#3a5f7d" roughness={0.45} />
        </mesh>
        {[-4.2, -2.1, 2.1, 4.2].map((wx, i) => (
          <mesh key={i} position={[wx, 4.2, spec.depth / 2 + 0.04]}>
            <boxGeometry args={[1.45, 1.5, 0.08]} />
            <meshStandardMaterial color="#87b2c9" emissive={winEmissive} emissiveIntensity={winIntensity} />
          </mesh>
        ))}
      </group>
    );
  }

  if (spec.category === 'university') {
    return (
      <group>
        <mesh position={[0, 3.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[spec.width, 6.8, spec.depth]} />
          <meshStandardMaterial map={textures.plaster} color="#e7dfd0" roughness={0.82} />
        </mesh>
        {/* Copper Dome */}
        <mesh position={[0, 7.6, 0]} castShadow>
          <sphereGeometry args={[2.6, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color="#4e7d6c" roughness={0.45} metalness={0.35} />
        </mesh>
        {/* Classical Portico Columns */}
        {[-3.2, -1.6, 0, 1.6, 3.2].map((cx, i) => (
          <mesh key={i} position={[cx, 2.9, spec.depth / 2 + 0.65]} castShadow>
            <cylinderGeometry args={[0.22, 0.26, 5.8, 10]} />
            <meshStandardMaterial color="#f2ece0" roughness={0.78} />
          </mesh>
        ))}
        <mesh position={[0, 6.0, spec.depth / 2 + 0.65]} castShadow>
          <boxGeometry args={[7.4, 0.55, 1.4]} />
          <meshStandardMaterial color="#dcd3c1" roughness={0.8} />
        </mesh>
      </group>
    );
  }

  if (spec.category === 'fire-station') {
    return (
      <group>
        <mesh position={[0, 2.9, 0]} castShadow receiveShadow>
          <boxGeometry args={[spec.width, 5.8, spec.depth]} />
          <meshStandardMaterial map={textures.brick} color="#9e4235" roughness={0.86} />
        </mesh>
        {/* Hose Drying Tower */}
        <mesh position={[spec.width * 0.32, 5.6, -spec.depth * 0.2]} castShadow>
          <boxGeometry args={[2.2, 4.6, 2.2]} />
          <meshStandardMaterial map={textures.brick} color="#8a382c" roughness={0.86} />
        </mesh>
        {/* Dual Red Engine Bay Doors */}
        {[-2.1, 2.1].map((bx, i) => (
          <mesh key={i} position={[bx, 1.65, spec.depth / 2 + 0.05]}>
            <boxGeometry args={[3.1, 3.0, 0.1]} />
            <meshStandardMaterial color="#bf342c" roughness={0.45} metalness={0.25} />
          </mesh>
        ))}
      </group>
    );
  }

  if (spec.category === 'police') {
    return (
      <group>
        <mesh position={[0, 2.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[spec.width, 5.2, spec.depth]} />
          <meshStandardMaterial color="#d4d8de" roughness={0.72} />
        </mesh>
        {/* Blue Civic Trim & Beacon Bar */}
        <mesh position={[0, 4.9, spec.depth / 2 + 0.06]}>
          <boxGeometry args={[spec.width, 0.42, 0.12]} />
          <meshStandardMaterial
            color="#26548a"
            emissive="#3b82f6"
            emissiveIntensity={isNight ? 1.6 : 0.25}
          />
        </mesh>
        {[-2.4, 0, 2.4].map((wx, i) => (
          <mesh key={i} position={[wx, 2.6, spec.depth / 2 + 0.04]}>
            <boxGeometry args={[1.45, 2.1, 0.08]} />
            <meshStandardMaterial color="#6789a3" emissive={winEmissive} emissiveIntensity={winIntensity} />
          </mesh>
        ))}
      </group>
    );
  }

  // School (Lindenhof Primary Academy)
  return (
    <group>
      <mesh position={[0, 2.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[spec.width, 5.2, spec.depth]} />
        <meshStandardMaterial map={textures.brick} color="#b05c46" roughness={0.86} />
      </mesh>
      <mesh position={[0, 5.8, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[spec.width * 0.65, 2.2, 4]} />
        <meshStandardMaterial map={textures.slateRoof} color="#3a424d" roughness={0.78} />
      </mesh>
      {[-3.1, 0, 3.1].map((wx, i) => (
        <mesh key={i} position={[wx, 2.7, spec.depth / 2 + 0.04]}>
          <boxGeometry args={[1.35, 1.75, 0.08]} />
          <meshStandardMaterial color="#87a6ba" emissive={winEmissive} emissiveIntensity={winIntensity} />
        </mesh>
      ))}
    </group>
  );
};
