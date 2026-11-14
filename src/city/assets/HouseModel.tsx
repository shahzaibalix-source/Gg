import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HouseStyleSpec, TimeOfDay } from '../types';
import { CityTextureSet } from '../materials/proceduralTextures';

interface HouseModelProps {
  spec: HouseStyleSpec;
  textures: CityTextureSet;
  timeOfDay: TimeOfDay;
  doorOpen?: boolean;
  garageOpen?: boolean;
  houseNumber?: string;
}

/**
 * Multi-part procedural European & modern architectural house assembly.
 * Origin is bottom-center of the house footprint (y = 0 sits on the plot pad).
 * Local +Z faces the street.
 */
export const HouseModel: React.FC<HouseModelProps> = ({
  spec,
  textures,
  timeOfDay,
  doorOpen = false,
  garageOpen,
  houseNumber,
}) => {
  const doorHingeRef = useRef<THREE.Group>(null);
  const garageDoorRef = useRef<THREE.Group>(null);
  const garageProgressRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (doorHingeRef.current) {
      const targetAngle = doorOpen ? -Math.PI * 0.44 : 0;
      doorHingeRef.current.rotation.y = THREE.MathUtils.damp(
        doorHingeRef.current.rotation.y,
        targetAngle,
        9,
        dt,
      );
    }
    if (garageDoorRef.current) {
      const targetGarage = (garageOpen ?? doorOpen) ? 1 : 0;
      garageProgressRef.current = THREE.MathUtils.damp(
        garageProgressRef.current,
        targetGarage,
        7,
        dt,
      );
      const p = garageProgressRef.current;
      garageDoorRef.current.position.y = 1.16 + p * 1.12;
      garageDoorRef.current.position.z = 2.24 - p * 0.96;
      garageDoorRef.current.rotation.x = -p * (Math.PI * 0.44);
    }
  });
  const {
    archetype,
    wallColor,
    trimColor,
    roofColor,
    accentColor,
    shutterColor,
    hasBalcony,
    hasChimney,
    hasDormers,
    hasGarageCarport,
    width,
    depth,
    wallHeight,
  } = spec;

  const isFlatModern =
    archetype === 'modern-villa' ||
    archetype === 'luxury-modern' ||
    archetype === 'contemporary-villa' ||
    archetype === 'modern-minimalist';
  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';
  const windowEmissive = isEvening ? '#ffbe6b' : '#2a3744';
  const windowEmissiveIntensity = isEvening ? 1.45 : 0.06;

  // Crisp architectural house number plaque texture (disposed on change/unmount)
  const houseNumTexture = useMemo(() => {
    if (!houseNumber || typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, 128, 64);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, 122, 58);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(houseNumber.slice(0, 7), 64, 33);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [houseNumber]);

  React.useEffect(() => {
    return () => {
      houseNumTexture?.dispose();
    };
  }, [houseNumTexture]);

  const wallMap = useMemo(() => {
    if (archetype === 'townhouse' || archetype === 'traditional-home') return textures.brick;
    if (archetype === 'nordic' || archetype === 'modern-family') return textures.timber;
    return textures.plaster;
  }, [archetype, textures]);

  const roofMap = useMemo(() => {
    if (archetype === 'tudor' || archetype === 'mediterranean' || archetype === 'traditional-home') {
      return textures.roofTile;
    }
    return textures.slateRoof;
  }, [archetype, textures]);

  // Gable wall triangle (matches facade wall material)
  const gableWallGeo = useMemo(() => {
    const ridgeHeight =
      archetype === 'tudor' ||
      archetype === 'townhouse' ||
      archetype === 'luxury-mansion' ||
      archetype === 'premium-residence'
        ? 2.75
        : archetype === 'nordic' || archetype === 'modern-family'
          ? 1.75
          : archetype === 'mediterranean'
            ? 1.65
            : archetype === 'traditional-home' || archetype === 'suburban-two-storey'
              ? 2.45
              : 2.35;

    const halfW = width / 2;
    const shape = new THREE.Shape();

    if (archetype === 'nordic') {
      shape.moveTo(-halfW, 0);
      shape.lineTo(halfW, 0);
      shape.lineTo(halfW * 0.45, ridgeHeight);
      shape.lineTo(-halfW, 0.35);
      shape.closePath();
    } else {
      shape.moveTo(-halfW, 0);
      shape.lineTo(halfW, 0);
      shape.lineTo(0, ridgeHeight);
      shape.closePath();
    }

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: depth - 0.02,
      bevelEnabled: false,
    });
    geo.translate(0, 0, -(depth - 0.02) / 2);
    const uvAttr = geo.attributes.uv;
    if (uvAttr) {
      for (let i = 0; i < uvAttr.count; i++) {
        uvAttr.setXY(i, uvAttr.getX(i) / Math.max(1, width), uvAttr.getY(i) / Math.max(1, wallHeight));
      }
      uvAttr.needsUpdate = true;
    }
    geo.computeVertexNormals();
    return { geo, ridgeHeight };
  }, [archetype, width, depth, wallHeight]);

  // Roof slope angle & slab length calculations for crisp overhanging eaves
  const roofSlopes = useMemo(() => {
    const ridgeH = gableWallGeo.ridgeHeight;
    const halfW = width / 2;
    if (archetype === 'nordic') {
      const peakX = halfW * 0.45;
      const leftRise = ridgeH - 0.35;
      const leftRun = peakX - -halfW;
      const rightRun = halfW - peakX;
      return {
        leftLen: Math.hypot(leftRun, leftRise) + 0.7,
        leftAngle: Math.atan2(leftRise, leftRun),
        leftCenter: [(-halfW + peakX) / 2 - 0.15, (0.35 + ridgeH) / 2 + 0.08] as [number, number],
        rightLen: Math.hypot(rightRun, ridgeH) + 0.7,
        rightAngle: -Math.atan2(ridgeH, rightRun),
        rightCenter: [(peakX + halfW) / 2 + 0.15, ridgeH / 2 + 0.08] as [number, number],
      };
    }
    const len = Math.hypot(halfW, ridgeH) + 0.75;
    const angle = Math.atan2(ridgeH, halfW);
    return {
      leftLen: len,
      leftAngle: angle,
      leftCenter: [-halfW / 2 - 0.12, ridgeH / 2 + 0.06] as [number, number],
      rightLen: len,
      rightAngle: -angle,
      rightCenter: [halfW / 2 + 0.12, ridgeH / 2 + 0.06] as [number, number],
    };
  }, [archetype, width, gableWallGeo.ridgeHeight]);

  // Stepped Dutch gable facade silhouette for townhouse
  const dutchGableGeo = useMemo(() => {
    if (archetype !== 'townhouse') return null;
    const hw = width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(hw, 0.7);
    shape.lineTo(hw * 0.72, 0.7);
    shape.lineTo(hw * 0.72, 1.45);
    shape.lineTo(hw * 0.42, 1.45);
    shape.lineTo(hw * 0.42, 2.25);
    shape.lineTo(hw * 0.18, 2.25);
    shape.lineTo(hw * 0.18, 2.85);
    shape.lineTo(-hw * 0.18, 2.85);
    shape.lineTo(-hw * 0.18, 2.25);
    shape.lineTo(-hw * 0.42, 2.25);
    shape.lineTo(-hw * 0.42, 1.45);
    shape.lineTo(-hw * 0.72, 1.45);
    shape.lineTo(-hw * 0.72, 0.7);
    shape.lineTo(-hw, 0.7);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    const uvAttr = geo.attributes.uv;
    if (uvAttr) {
      for (let i = 0; i < uvAttr.count; i++) {
        uvAttr.setXY(i, uvAttr.getX(i) / Math.max(1, width), uvAttr.getY(i) / Math.max(1, wallHeight));
      }
      uvAttr.needsUpdate = true;
    }
    geo.computeVertexNormals();
    return geo;
  }, [archetype, width, wallHeight]);

  React.useEffect(() => {
    return () => {
      gableWallGeo.geo.dispose();
    };
  }, [gableWallGeo]);

  React.useEffect(() => {
    return () => {
      dutchGableGeo?.dispose();
    };
  }, [dutchGableGeo]);

  const plinthH = 0.28;
  const bodyH = wallHeight - plinthH;
  const frontZ = depth / 2;
  const backZ = -depth / 2;

  // Window placement helper positions
  const frontWindowOffsetsX = useMemo(() => {
    if (width >= 10.6) return [-3.4, 3.4];
    if (width >= 9.4) return [-2.8, 2.8];
    return [-2.3, 2.3];
  }, [width]);

  return (
    <group>
      {/* 1. Stone Foundation Plinth */}
      <mesh position={[0, plinthH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.24, plinthH, depth + 0.24]} />
        <meshStandardMaterial color="#7d7870" roughness={0.92} metalness={0.02} />
      </mesh>

      {/* 2. Main Facade Shell */}
      <mesh position={[0, plinthH + bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, bodyH, depth]} />
        <meshStandardMaterial
          map={wallMap}
          color={wallColor}
          roughness={isFlatModern ? 0.68 : 0.85}
          metalness={0.02}
        />
      </mesh>

      {/* 3. Architectural Belt Course / Floor Divider Trim */}
      <mesh position={[0, plinthH + bodyH * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.08, 0.14, depth + 0.08]} />
        <meshStandardMaterial color={trimColor} roughness={0.65} metalness={0.05} />
      </mesh>

      {/* 4. Roof System */}
      {isFlatModern ? (
        <group position={[0, wallHeight, 0]}>
          {/* Main flat cantilevered roof deck with fascia */}
          <mesh position={[0, 0.22, 0.25]} castShadow receiveShadow>
            <boxGeometry args={[width + 1.1, 0.38, depth + 1.3]} />
            <meshStandardMaterial color={roofColor} roughness={0.55} metalness={0.18} />
          </mesh>
          {/* Warm wood soffit under overhang */}
          <mesh position={[0, 0.02, 0.25]} receiveShadow>
            <boxGeometry args={[width + 0.96, 0.06, depth + 1.16]} />
            <meshStandardMaterial color={accentColor} roughness={0.72} />
          </mesh>
          {/* Upper architectural parapet / clerestory skylight */}
          <mesh position={[-width * 0.18, 0.58, -0.4]} castShadow>
            <boxGeometry args={[width * 0.45, 0.42, depth * 0.45]} />
            <meshStandardMaterial color="#373e47" roughness={0.45} metalness={0.3} />
          </mesh>
        </group>
      ) : (
        <group position={[0, wallHeight, 0]}>
          {/* Gable Wall Infill matching Facade Material */}
          <mesh geometry={gableWallGeo.geo} castShadow receiveShadow>
            <meshStandardMaterial
              map={wallMap}
              color={wallColor}
              roughness={0.85}
              metalness={0.02}
            />
          </mesh>

          {/* Left Overhanging Pitched Roof Slab */}
          <mesh
            position={[roofSlopes.leftCenter[0], roofSlopes.leftCenter[1], 0]}
            rotation={[0, 0, roofSlopes.leftAngle]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[roofSlopes.leftLen, 0.2, depth + 0.92]} />
            <meshStandardMaterial map={roofMap} color={roofColor} roughness={0.78} metalness={0.06} />
          </mesh>

          {/* Right Overhanging Pitched Roof Slab */}
          <mesh
            position={[roofSlopes.rightCenter[0], roofSlopes.rightCenter[1], 0]}
            rotation={[0, 0, roofSlopes.rightAngle]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[roofSlopes.rightLen, 0.2, depth + 0.92]} />
            <meshStandardMaterial map={roofMap} color={roofColor} roughness={0.78} metalness={0.06} />
          </mesh>

          {/* Ridge Cap Beam */}
          <mesh
            position={[
              archetype === 'nordic' ? width * 0.225 : 0,
              gableWallGeo.ridgeHeight + 0.13,
              0,
            ]}
            castShadow
          >
            <boxGeometry args={[0.24, 0.16, depth + 0.96]} />
            <meshStandardMaterial color={trimColor} roughness={0.62} />
          </mesh>

          {/* Eaves Fascia & Gutter Trim */}
          <mesh
            position={[-width / 2 - 0.36, archetype === 'nordic' ? 0.39 : 0.04, 0]}
            castShadow
          >
            <boxGeometry args={[0.1, 0.14, depth + 0.94]} />
            <meshStandardMaterial color={trimColor} roughness={0.55} metalness={0.2} />
          </mesh>
          <mesh position={[width / 2 + 0.36, 0.04, 0]} castShadow>
            <boxGeometry args={[0.1, 0.14, depth + 0.94]} />
            <meshStandardMaterial color={trimColor} roughness={0.55} metalness={0.2} />
          </mesh>

          {/* Stepped Dutch Gable Front & Back */}
          {dutchGableGeo && (
            <>
              <mesh geometry={dutchGableGeo} position={[0, -0.05, frontZ - 0.18]} castShadow>
                <meshStandardMaterial map={textures.brick} color={wallColor} roughness={0.86} />
              </mesh>
              <mesh geometry={dutchGableGeo} position={[0, -0.05, backZ - 0.16]} castShadow>
                <meshStandardMaterial map={textures.brick} color={wallColor} roughness={0.86} />
              </mesh>
            </>
          )}

          {/* Dormer Windows on Cottage & Tudor */}
          {hasDormers && (
            <>
              {[-width * 0.24, width * 0.24].map((dx, i) => (
                <group key={i} position={[dx, 0.85, frontZ * 0.56]}>
                  <mesh castShadow>
                    <boxGeometry args={[1.35, 1.15, 1.3]} />
                    <meshStandardMaterial color={wallColor} roughness={0.82} />
                  </mesh>
                  <mesh position={[0, 0.65, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                    <coneGeometry args={[1.05, 0.65, 4]} />
                    <meshStandardMaterial color={roofColor} roughness={0.75} />
                  </mesh>
                  <mesh position={[0, 0, 0.66]}>
                    <boxGeometry args={[0.85, 0.75, 0.08]} />
                    <meshStandardMaterial
                      color="#9fb7c7"
                      emissive={windowEmissive}
                      emissiveIntensity={windowEmissiveIntensity}
                      roughness={0.12}
                      metalness={0.25}
                    />
                  </mesh>
                </group>
              ))}
            </>
          )}
        </group>
      )}

      {/* 5. Bavarian Half-Timber & Craftsman Framing */}
      {(archetype === 'tudor' || archetype === 'premium-residence') && (
        <group>
          {[-width / 2 + 0.1, -width * 0.2, width * 0.2, width / 2 - 0.1].map((tx, idx) => (
            <mesh key={`v-${idx}`} position={[tx, wallHeight * 0.52, frontZ + 0.03]} castShadow>
              <boxGeometry args={[0.18, wallHeight - 0.3, 0.07]} />
              <meshStandardMaterial color={trimColor} roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, wallHeight - 0.25, frontZ + 0.03]} castShadow>
            <boxGeometry args={[width + 0.08, 0.18, 0.07]} />
            <meshStandardMaterial color={trimColor} roughness={0.85} />
          </mesh>
          {/* Gable triangle timber framing */}
          <mesh position={[0, wallHeight + 0.85, frontZ + 0.03]} castShadow>
            <boxGeometry args={[width * 0.56, 0.16, 0.08]} />
            <meshStandardMaterial color={trimColor} roughness={0.85} />
          </mesh>
          <mesh position={[0, wallHeight + 1.4, frontZ + 0.03]} castShadow>
            <boxGeometry args={[0.18, 2.2, 0.08]} />
            <meshStandardMaterial color={trimColor} roughness={0.85} />
          </mesh>
        </group>
      )}

      {/* Minimalist & Contemporary Vertical Cedar Privacy Louvers */}
      {(archetype === 'modern-minimalist' || archetype === 'contemporary-villa') && (
        <group position={[-width * 0.36, plinthH + bodyH * 0.5, frontZ + 0.06]}>
          {[-0.24, -0.08, 0.08, 0.24].map((lx, idx) => (
            <mesh key={`louv-${idx}`} position={[lx, 0, 0]} castShadow>
              <boxGeometry args={[0.07, bodyH * 0.92, 0.1]} />
              <meshStandardMaterial color={accentColor} roughness={0.72} />
            </mesh>
          ))}
        </group>
      )}

      {/* 6. Chimney Stack */}
      {hasChimney && (
        <group position={[width * 0.28, wallHeight + 1.6, -depth * 0.22]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.82, 2.5, 0.82]} />
            <meshStandardMaterial map={textures.brick} color="#8e5242" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.3, 0]} castShadow>
            <boxGeometry args={[0.98, 0.14, 0.98]} />
            <meshStandardMaterial color="#6e6961" roughness={0.85} />
          </mesh>
          <mesh position={[-0.16, 1.48, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.13, 0.32, 10]} />
            <meshStandardMaterial color="#9f5b43" roughness={0.8} />
          </mesh>
          <mesh position={[0.16, 1.48, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.13, 0.32, 10]} />
            <meshStandardMaterial color="#9f5b43" roughness={0.8} />
          </mesh>
        </group>
      )}

      {/* 7. Front Entrance Door, Stone Stoop & Portico */}
      <group position={[0, plinthH, frontZ]}>
        {/* Stone steps */}
        <mesh position={[0, -0.14, 0.55]} receiveShadow castShadow>
          <boxGeometry args={[2.1, 0.28, 1.1]} />
          <meshStandardMaterial color="#b4aea2" roughness={0.88} />
        </mesh>
        {/* Door frame */}
        <mesh position={[0, 1.15, 0.04]} castShadow>
          <boxGeometry args={[1.38, 2.32, 0.14]} />
          <meshStandardMaterial color={trimColor} roughness={0.62} />
        </mesh>
        {/* Warm Interior Vestibule Backing visible when door opens */}
        <mesh position={[0, 1.12, 0.015]}>
          <boxGeometry args={[1.08, 2.14, 0.04]} />
          <meshStandardMaterial
            color="#4a3727"
            emissive="#ffca7a"
            emissiveIntensity={doorOpen ? 0.65 : 0.05}
            roughness={0.85}
          />
        </mesh>
        {/* Hinged Paneled Door Leaf + Brass Handle */}
        <group ref={doorHingeRef} position={[-0.55, 1.12, 0.08]}>
          <mesh position={[0.55, 0, 0]} castShadow>
            <boxGeometry args={[1.1, 2.16, 0.08]} />
            <meshStandardMaterial color={accentColor} roughness={0.55} metalness={0.08} />
          </mesh>
          <mesh position={[0.95, -0.07, 0.07]}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial color="#d4af37" roughness={0.25} metalness={0.9} />
          </mesh>
        </group>

        {/* Portico / Canopy Roof */}
        <mesh position={[0, 2.52, 0.55]} castShadow>
          <boxGeometry args={[2.35, 0.16, 1.15]} />
          <meshStandardMaterial color={trimColor} roughness={0.6} />
        </mesh>
        {/* Portico Support Pillars (Mediterranean / Cottage / Modern) */}
        <mesh position={[-0.96, 1.24, 0.96]} castShadow>
          <cylinderGeometry args={[0.08, 0.09, 2.48, 12]} />
          <meshStandardMaterial color={trimColor} roughness={0.68} />
        </mesh>
        <mesh position={[0.96, 1.24, 0.96]} castShadow>
          <cylinderGeometry args={[0.08, 0.09, 2.48, 12]} />
          <meshStandardMaterial color={trimColor} roughness={0.68} />
        </mesh>

        {/* Twin Porch Wall Sconces */}
        {[-0.92, 0.92].map((sx, idx) => (
          <group key={`sconce-${idx}`} position={[sx, 2.02, 0.14]}>
            <mesh position={[0, 0.04, -0.04]}>
              <boxGeometry args={[0.12, 0.18, 0.08]} />
              <meshStandardMaterial color="#1e242b" roughness={0.4} metalness={0.7} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.15, 0.22, 0.14]} />
              <meshStandardMaterial
                color="#ffe5a3"
                emissive="#ffaa3b"
                emissiveIntensity={isEvening ? 2.5 : 0.15}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}

        {/* House Number Plaque beside Entrance */}
        {houseNumTexture && (
          <mesh position={[-0.96, 1.56, 0.07]}>
            <boxGeometry args={[0.38, 0.2, 0.04]} />
            <meshStandardMaterial map={houseNumTexture} roughness={0.35} metalness={0.25} />
          </mesh>
        )}

        {/* Terracotta Flower Pots flanking Front Steps */}
        {[-1.24, 1.24].map((px, idx) => (
          <group key={`pot-${idx}`} position={[px, -plinthH, 0.56]}>
            <mesh position={[0, 0.2, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.14, 0.4, 10]} />
              <meshStandardMaterial color="#b45b38" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.46, 0]} castShadow>
              <dodecahedronGeometry args={[0.22, 0]} />
              <meshStandardMaterial color="#3b7236" roughness={0.88} />
            </mesh>
            <mesh position={[0, 0.58, 0]}>
              <sphereGeometry args={[0.09, 6, 6]} />
              <meshStandardMaterial color={idx === 0 ? '#f43f5e' : '#fbbf24'} roughness={0.75} />
            </mesh>
          </group>
        ))}

        {/* Roadside Residential Mailbox Post near Entry Walkway */}
        <group position={[-1.68, -plinthH, 1.38]}>
          <mesh position={[0, 0.52, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.055, 1.04, 8]} />
            <meshStandardMaterial color="#272c33" roughness={0.45} metalness={0.65} />
          </mesh>
          <mesh position={[0, 1.08, 0.04]} castShadow>
            <boxGeometry args={[0.26, 0.22, 0.42]} />
            <meshStandardMaterial color={trimColor} roughness={0.42} metalness={0.45} />
          </mesh>
        </group>
      </group>

      {/* 8. Ground & Upper Floor Framed Windows + Shutters */}
      {frontWindowOffsetsX.map((wx, idx) => (
        <React.Fragment key={`fw-${idx}`}>
          {/* Ground floor window */}
          <WindowAssembly
            position={[wx, plinthH + 1.45, frontZ + 0.03]}
            width={1.32}
            height={1.45}
            frameColor={trimColor}
            shutterColor={shutterColor}
            hasShutters={
              archetype === 'cottage' ||
              archetype === 'tudor' ||
              archetype === 'mediterranean' ||
              archetype === 'traditional-home' ||
              archetype === 'suburban-two-storey'
            }
            emissive={windowEmissive}
            emissiveIntensity={windowEmissiveIntensity}
          />
          {(archetype === 'cottage' ||
            archetype === 'mediterranean' ||
            archetype === 'traditional-home') && (
            <group position={[wx, plinthH + 0.62, frontZ + 0.15]}>
              <mesh castShadow>
                <boxGeometry args={[1.15, 0.18, 0.22]} />
                <meshStandardMaterial color="#6e472d" roughness={0.85} />
              </mesh>
              <mesh position={[0, 0.12, 0]}>
                <boxGeometry args={[1.05, 0.13, 0.16]} />
                <meshStandardMaterial
                  color={archetype === 'mediterranean' ? '#f472b6' : '#fb7185'}
                  roughness={0.78}
                />
              </mesh>
            </group>
          )}
          {/* Second floor window */}
          <WindowAssembly
            position={[wx, plinthH + bodyH * 0.72, frontZ + 0.03]}
            width={isFlatModern ? 1.82 : 1.28}
            height={isFlatModern ? 1.52 : 1.38}
            frameColor={trimColor}
            shutterColor={shutterColor}
            hasShutters={
              archetype === 'cottage' ||
              archetype === 'mediterranean' ||
              archetype === 'traditional-home'
            }
            emissive={windowEmissive}
            emissiveIntensity={windowEmissiveIntensity}
          />
          {/* Rear garden windows */}
          <WindowAssembly
            position={[wx, plinthH + 1.45, backZ - 0.03]}
            rotationY={Math.PI}
            width={1.35}
            height={1.45}
            frameColor={trimColor}
            shutterColor={shutterColor}
            hasShutters={false}
            emissive={windowEmissive}
            emissiveIntensity={windowEmissiveIntensity}
          />
        </React.Fragment>
      ))}

      {/* Upper center window above entrance (unless covered by balcony door) */}
      <WindowAssembly
        position={[0, plinthH + bodyH * 0.72, frontZ + (hasBalcony ? 0.055 : 0.03)]}
        width={hasBalcony ? 1.55 : 1.15}
        height={hasBalcony ? 1.9 : 1.32}
        frameColor={trimColor}
        shutterColor={shutterColor}
        hasShutters={false}
        emissive={windowEmissive}
        emissiveIntensity={windowEmissiveIntensity}
      />

      {/* Side Windows */}
      {[-1, 1].map((side) => (
        <React.Fragment key={`sw-${side}`}>
          <WindowAssembly
            position={[(side * width) / 2 + side * 0.03, plinthH + 1.45, 0]}
            rotationY={side > 0 ? Math.PI / 2 : -Math.PI / 2}
            width={1.28}
            height={1.38}
            frameColor={trimColor}
            shutterColor={shutterColor}
            hasShutters={false}
            emissive={windowEmissive}
            emissiveIntensity={windowEmissiveIntensity}
          />
          <WindowAssembly
            position={[(side * width) / 2 + side * 0.03, plinthH + bodyH * 0.72, 0]}
            rotationY={side > 0 ? Math.PI / 2 : -Math.PI / 2}
            width={1.24}
            height={1.3}
            frameColor={trimColor}
            shutterColor={shutterColor}
            hasShutters={false}
            emissive={windowEmissive}
            emissiveIntensity={windowEmissiveIntensity}
          />
        </React.Fragment>
      ))}

      {/* 9. Second Floor Balcony */}
      {hasBalcony && (
        <group position={[0, plinthH + bodyH * 0.51, frontZ + 0.65]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[3.2, 0.14, 1.3]} />
            <meshStandardMaterial color="#b4aea4" roughness={0.75} />
          </mesh>
          {/* Balustrade Rail */}
          <mesh position={[0, 0.88, 0.58]} castShadow>
            <boxGeometry args={[3.2, 0.07, 0.07]} />
            <meshStandardMaterial color="#272b30" roughness={0.35} metalness={0.75} />
          </mesh>
          <mesh position={[-1.56, 0.48, 0.0]} castShadow>
            <boxGeometry args={[0.07, 0.85, 1.24]} />
            <meshStandardMaterial color="#272b30" roughness={0.35} metalness={0.75} />
          </mesh>
          <mesh position={[1.56, 0.48, 0.0]} castShadow>
            <boxGeometry args={[0.07, 0.85, 1.24]} />
            <meshStandardMaterial color="#272b30" roughness={0.35} metalness={0.75} />
          </mesh>
          {isFlatModern ? (
            <mesh position={[0, 0.46, 0.58]}>
              <boxGeometry args={[3.04, 0.76, 0.04]} />
              <meshPhysicalMaterial
                color="#8cb4c9"
                transparent
                opacity={0.45}
                roughness={0.08}
                metalness={0.1}
              />
            </mesh>
          ) : (
            [-1.2, -0.72, -0.24, 0.24, 0.72, 1.2].map((bx, i) => (
              <mesh key={i} position={[bx, 0.46, 0.58]} castShadow>
                <cylinderGeometry args={[0.025, 0.025, 0.82, 6]} />
                <meshStandardMaterial color="#272b30" roughness={0.35} metalness={0.75} />
              </mesh>
            ))
          )}
        </group>
      )}

      {/* 10. Complete Enclosed Attached Garage Wing + Animated Sectional Door */}
      {hasGarageCarport && (
        <group position={[width / 2 + 1.45, 0, -0.15]}>
          {/* Garage Stone Plinth */}
          <mesh position={[0, plinthH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[3.04, plinthH, 4.74]} />
            <meshStandardMaterial color="#7d7870" roughness={0.92} metalness={0.02} />
          </mesh>

          {/* Outer Side Wall */}
          <mesh position={[1.38, plinthH + 1.36, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.18, 2.72, 4.6]} />
            <meshStandardMaterial map={wallMap} color={wallColor} roughness={0.84} />
          </mesh>
          {/* Rear Garage Wall */}
          <mesh position={[0, plinthH + 1.36, -2.21]} castShadow receiveShadow>
            <boxGeometry args={[2.9, 2.72, 0.18]} />
            <meshStandardMaterial map={wallMap} color={wallColor} roughness={0.84} />
          </mesh>
          {/* Left Front Pilaster, Right Front Pilaster & Header Lintel framing the 2.34m bay */}
          <mesh position={[-1.31, plinthH + 1.12, 2.21]} castShadow receiveShadow>
            <boxGeometry args={[0.28, 2.24, 0.18]} />
            <meshStandardMaterial map={wallMap} color={wallColor} roughness={0.84} />
          </mesh>
          <mesh position={[1.31, plinthH + 1.12, 2.21]} castShadow receiveShadow>
            <boxGeometry args={[0.28, 2.24, 0.18]} />
            <meshStandardMaterial map={wallMap} color={wallColor} roughness={0.84} />
          </mesh>
          <mesh position={[0, plinthH + 2.48, 2.21]} castShadow receiveShadow>
            <boxGeometry args={[2.9, 0.48, 0.2]} />
            <meshStandardMaterial color={trimColor} roughness={0.62} />
          </mesh>

          {/* Garage Dark Recessed Interior Backing (visible when door lifts) */}
          <mesh position={[0, plinthH + 1.12, 0.1]}>
            <boxGeometry args={[2.46, 2.24, 4.1]} />
            <meshStandardMaterial
              color="#1b1f25"
              emissive="#ffca7a"
              emissiveIntensity={garageOpen ?? doorOpen ? 0.28 : 0.02}
              roughness={0.9}
            />
          </mesh>

          {/* Garage Roof Cornice & Pitched/Flat Cap matching house style */}
          <mesh position={[0, plinthH + 2.78, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[3.16, 0.16, 4.92]} />
            <meshStandardMaterial color={trimColor} roughness={0.58} metalness={0.14} />
          </mesh>
          <mesh position={[0, plinthH + 2.94, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[3.04, 0.18, 4.78]} />
            <meshStandardMaterial map={roofMap} color={roofColor} roughness={0.76} />
          </mesh>

          {/* Small Side Frost Window on Garage */}
          <mesh position={[1.48, plinthH + 1.72, 0]}>
            <boxGeometry args={[0.06, 0.65, 1.1]} />
            <meshStandardMaterial
              color="#9bb6c7"
              emissive={windowEmissive}
              emissiveIntensity={windowEmissiveIntensity * 0.7}
              roughness={0.15}
            />
          </mesh>

          {/* Warm Exterior Coach Light flanking Garage Bay */}
          <mesh position={[-1.31, plinthH + 1.88, 2.34]}>
            <boxGeometry args={[0.14, 0.2, 0.12]} />
            <meshStandardMaterial
              color="#ffe5a3"
              emissive="#ffaa3b"
              emissiveIntensity={isEvening ? 2.3 : 0.15}
              roughness={0.2}
            />
          </mesh>

          {/* Animated Sectional Overhead Garage Door */}
          <group ref={garageDoorRef} position={[0, 1.16, 2.24]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[2.32, 2.12, 0.08]} />
              <meshStandardMaterial color={trimColor} roughness={0.48} metalness={0.16} />
            </mesh>
            {[-0.68, -0.22, 0.24, 0.7].map((ry, idx) => (
              <mesh key={`grib-${idx}`} position={[0, ry, 0.048]}>
                <boxGeometry args={[2.16, 0.04, 0.02]} />
                <meshStandardMaterial color={accentColor} roughness={0.55} />
              </mesh>
            ))}
          </group>
        </group>
      )}

      {/* 11. Private Swimming Pool for Luxury Estates */}
      {spec.hasPool && (
        <group position={[0, 0.04, backZ - 2.3]}>
          {/* Travertine pool coping deck */}
          <mesh receiveShadow>
            <boxGeometry args={[6.4, 0.08, 3.6]} />
            <meshStandardMaterial color="#ddd5c7" roughness={0.78} />
          </mesh>
          {/* Shimmering turquoise pool water */}
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[5.4, 0.04, 2.7]} />
            <meshPhysicalMaterial
              color="#39a2b8"
              emissive={isEvening ? '#1f6e80' : '#000000'}
              emissiveIntensity={isEvening ? 0.55 : 0}
              roughness={0.08}
              metalness={0.1}
              clearcoat={0.95}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};

interface WindowAssemblyProps {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
  frameColor: string;
  shutterColor: string;
  hasShutters: boolean;
  emissive: string;
  emissiveIntensity: number;
}

const WindowAssembly: React.FC<WindowAssemblyProps> = ({
  position,
  rotationY = 0,
  width,
  height,
  frameColor,
  shutterColor,
  hasShutters,
  emissive,
  emissiveIntensity,
}) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Outer Frame */}
      <mesh>
        <boxGeometry args={[width + 0.14, height + 0.14, 0.1]} />
        <meshStandardMaterial color={frameColor} roughness={0.58} />
      </mesh>
      {/* Reflective Clearcoat Glass Pane */}
      <mesh position={[0, 0, 0.035]}>
        <boxGeometry args={[width - 0.08, height - 0.08, 0.05]} />
        <meshPhysicalMaterial
          color="#6d8ea3"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.07}
          metalness={0.38}
          clearcoat={0.92}
          clearcoatRoughness={0.08}
          envMapIntensity={1.45}
        />
      </mesh>
      {/* Mullion Crossbars */}
      <mesh position={[0, 0, 0.065]}>
        <boxGeometry args={[0.05, height - 0.06, 0.03]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.06, 0.065]}>
        <boxGeometry args={[width - 0.06, 0.05, 0.03]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} />
      </mesh>
      {/* Stone Window Sill */}
      <mesh position={[0, -height / 2 - 0.08, 0.09]}>
        <boxGeometry args={[width + 0.28, 0.09, 0.2]} />
        <meshStandardMaterial color="#cbc4b8" roughness={0.85} />
      </mesh>
      {/* Optional Wooden Shutters */}
      {hasShutters && (
        <>
          <mesh position={[-width / 2 - 0.28, 0, 0.05]}>
            <boxGeometry args={[0.36, height, 0.06]} />
            <meshStandardMaterial color={shutterColor} roughness={0.72} />
          </mesh>
          <mesh position={[width / 2 + 0.28, 0, 0.05]}>
            <boxGeometry args={[0.36, height, 0.06]} />
            <meshStandardMaterial color={shutterColor} roughness={0.72} />
          </mesh>
        </>
      )}
    </group>
  );
};
