import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export interface CharacterAppearance {
  jacketColor: string;
  trouserColor: string;
  skinColor: string;
  hairColor: string;
  shoeColor: string;
}

interface CharacterMeshProps {
  appearance: CharacterAppearance;
  /** Current horizontal speed in m/s */
  speedRef: React.MutableRefObject<number>;
  /** Whether sprinting */
  isRunningRef?: React.MutableRefObject<boolean>;
  /** Whether sitting on a bench */
  isSittingRef?: React.MutableRefObject<boolean>;
  /** Hide self body in seated first-person view */
  hideBody?: boolean;
}

/**
 * Articulated stylized-realistic humanoid character (~1.74m tall).
 * Origin (y = 0) sits flush on the ground under the feet.
 * Local +Z faces forward. Supports idle, walk, run, and smooth seated poses.
 */
export const CharacterMesh: React.FC<CharacterMeshProps> = ({
  appearance,
  speedRef,
  isRunningRef,
  isSittingRef,
  hideBody = false,
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const hipPivotRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftKneeRef = useRef<THREE.Group>(null);
  const rightKneeRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);
  const sitBlendRef = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const speed = speedRef.current;
    const sitting = isSittingRef?.current ?? false;
    const isMoving = !sitting && speed > 0.18;
    const isRunning = !sitting && (isRunningRef?.current ?? speed > 5.0);

    sitBlendRef.current = THREE.MathUtils.damp(sitBlendRef.current, sitting ? 1 : 0, 11, dt);
    const sit = sitBlendRef.current;

    if (isMoving) {
      const freq = isRunning ? 10.5 : 7.2;
      phaseRef.current += dt * freq * Math.min(1.4, Math.max(0.55, speed / 4.2));
    } else {
      phaseRef.current += dt * 2.4;
    }

    const p = phaseRef.current;
    const strideAmp = isMoving ? (isRunning ? 0.84 : 0.54) : 0.0;
    const armAmp = isMoving ? (isRunning ? 0.9 : 0.5) : 0.03;

    const swingLeg = Math.sin(p) * strideAmp;
    const swingArm = Math.sin(p) * armAmp;
    const bob =
      sit > 0.5
        ? 0
        : isMoving
          ? Math.abs(Math.sin(p)) * (isRunning ? 0.065 : 0.032)
          : Math.sin(state.clock.elapsedTime * 1.8) * 0.008;

    // Knee bend on backswing when walking, or 82° knee bend when seated
    const walkLeftKnee = isMoving ? Math.max(0, -Math.sin(p) * (isRunning ? 0.85 : 0.55)) : 0.04;
    const walkRightKnee = isMoving ? Math.max(0, Math.sin(p) * (isRunning ? 0.85 : 0.55)) : 0.04;

    const targetHipY = THREE.MathUtils.lerp(0.82, 0.53, sit);
    if (hipPivotRef.current) {
      hipPivotRef.current.position.y = targetHipY + bob * 0.4;
    }

    const targetLeftHipX = THREE.MathUtils.lerp(swingLeg, -1.46, sit);
    const targetRightHipX = THREE.MathUtils.lerp(-swingLeg, -1.46, sit);
    const targetLeftKneeX = THREE.MathUtils.lerp(walkLeftKnee, 1.44, sit);
    const targetRightKneeX = THREE.MathUtils.lerp(walkRightKnee, 1.44, sit);
    const targetLeftArmX = THREE.MathUtils.lerp(-swingArm, -0.58, sit);
    const targetRightArmX = THREE.MathUtils.lerp(swingArm, -0.58, sit);

    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = THREE.MathUtils.damp(
        leftLegRef.current.rotation.x,
        targetLeftHipX,
        14,
        dt,
      );
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = THREE.MathUtils.damp(
        rightLegRef.current.rotation.x,
        targetRightHipX,
        14,
        dt,
      );
    }
    if (leftKneeRef.current) {
      leftKneeRef.current.rotation.x = THREE.MathUtils.damp(
        leftKneeRef.current.rotation.x,
        targetLeftKneeX,
        14,
        dt,
      );
    }
    if (rightKneeRef.current) {
      rightKneeRef.current.rotation.x = THREE.MathUtils.damp(
        rightKneeRef.current.rotation.x,
        targetRightKneeX,
        14,
        dt,
      );
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = THREE.MathUtils.damp(
        leftArmRef.current.rotation.x,
        targetLeftArmX,
        12,
        dt,
      );
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = THREE.MathUtils.damp(
        rightArmRef.current.rotation.x,
        targetRightArmX,
        12,
        dt,
      );
    }

    if (torsoRef.current) {
      torsoRef.current.position.y = targetHipY + bob;
      const targetLean = sit > 0.2 ? -0.06 * sit : isMoving ? (isRunning ? 0.16 : 0.06) : 0;
      torsoRef.current.rotation.x = THREE.MathUtils.damp(
        torsoRef.current.rotation.x,
        targetLean,
        10,
        dt,
      );
    }
  });

  return (
    <group ref={rootRef} visible={!hideBody}>
      {/* Hips & Articulated Legs Pivot */}
      <group ref={hipPivotRef} position={[0, 0.82, 0]}>
        <mesh position={[0, -0.02, 0]} castShadow>
          <boxGeometry args={[0.34, 0.14, 0.21]} />
          <meshStandardMaterial color={appearance.trouserColor} roughness={0.85} />
        </mesh>

        {/* Left Thigh + Articulated Knee/Shin/Shoe */}
        <group ref={leftLegRef} position={[-0.1, -0.05, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.24, 4, 8]} />
            <meshStandardMaterial color={appearance.trouserColor} roughness={0.86} />
          </mesh>
          <group ref={leftKneeRef} position={[0, -0.35, 0]}>
            <mesh position={[0, -0.17, 0]} castShadow>
              <capsuleGeometry args={[0.068, 0.24, 4, 8]} />
              <meshStandardMaterial color={appearance.trouserColor} roughness={0.86} />
            </mesh>
            <mesh position={[0, -0.36, 0.04]} castShadow>
              <boxGeometry args={[0.13, 0.1, 0.22]} />
              <meshStandardMaterial color={appearance.shoeColor} roughness={0.65} />
            </mesh>
          </group>
        </group>

        {/* Right Thigh + Articulated Knee/Shin/Shoe */}
        <group ref={rightLegRef} position={[0.1, -0.05, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.24, 4, 8]} />
            <meshStandardMaterial color={appearance.trouserColor} roughness={0.86} />
          </mesh>
          <group ref={rightKneeRef} position={[0, -0.35, 0]}>
            <mesh position={[0, -0.17, 0]} castShadow>
              <capsuleGeometry args={[0.068, 0.24, 4, 8]} />
              <meshStandardMaterial color={appearance.trouserColor} roughness={0.86} />
            </mesh>
            <mesh position={[0, -0.36, 0.04]} castShadow>
              <boxGeometry args={[0.13, 0.1, 0.22]} />
              <meshStandardMaterial color={appearance.shoeColor} roughness={0.65} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Upper Body & Arms */}
      <group ref={torsoRef} position={[0, 0.82, 0]}>
        <mesh position={[0, 0.29, 0]} castShadow>
          <boxGeometry args={[0.42, 0.52, 0.24]} />
          <meshStandardMaterial color={appearance.jacketColor} roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.56, 0.02]}>
          <cylinderGeometry args={[0.1, 0.12, 0.08, 10]} />
          <meshStandardMaterial color="#f0ece3" roughness={0.75} />
        </mesh>

        {/* Head & Hair */}
        <group position={[0, 0.72, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <cylinderGeometry args={[0.058, 0.065, 0.12, 8]} />
            <meshStandardMaterial color={appearance.skinColor} roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.04, 0]} castShadow>
            <sphereGeometry args={[0.145, 14, 14]} />
            <meshStandardMaterial color={appearance.skinColor} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.09, -0.02]} castShadow>
            <sphereGeometry args={[0.152, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <meshStandardMaterial color={appearance.hairColor} roughness={0.85} />
          </mesh>
          <mesh position={[-0.05, 0.045, 0.132]}>
            <sphereGeometry args={[0.016, 6, 6]} />
            <meshStandardMaterial color="#1f2328" roughness={0.3} />
          </mesh>
          <mesh position={[0.05, 0.045, 0.132]}>
            <sphereGeometry args={[0.016, 6, 6]} />
            <meshStandardMaterial color="#1f2328" roughness={0.3} />
          </mesh>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.27, 0.48, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.058, 0.36, 4, 8]} />
            <meshStandardMaterial color={appearance.jacketColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.46, 0]}>
            <sphereGeometry args={[0.052, 8, 8]} />
            <meshStandardMaterial color={appearance.skinColor} roughness={0.7} />
          </mesh>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.27, 0.48, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.058, 0.36, 4, 8]} />
            <meshStandardMaterial color={appearance.jacketColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.46, 0]}>
            <sphereGeometry args={[0.052, 8, 8]} />
            <meshStandardMaterial color={appearance.skinColor} roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
};
