import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CameraMode,
  MobileInputState,
  NearbyInteractable,
  PlayerProfile,
  TownPlot,
} from '../types';
import { CharacterAppearance, CharacterMesh } from '../assets/CharacterMesh';
import { TOWN_BENCHES } from '../world/MasterTownBlueprint';
import {
  DynamicVehicleObstacle,
  getSurfaceElevationAt,
  resolvePlayerMovement,
} from '../simulation/WorldCollision';
import { resolveActiveWorldInteraction } from '../interaction/WorldInteractions';
import { CameraFocusTarget } from '../camera/CityCameraController';

export interface PlayerPoseState {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

interface WalkingPlayerControllerProps {
  cameraMode: CameraMode;
  plots: TownPlot[];
  playerProfile: PlayerProfile;
  sittingBenchId: string | null;
  openDoors: Record<string, boolean>;
  playerPoseRef: React.MutableRefObject<PlayerPoseState>;
  mobileInputRef: React.MutableRefObject<MobileInputState>;
  vehicleStatesRef: React.MutableRefObject<DynamicVehicleObstacle[]>;
  focusTargetRef: React.MutableRefObject<CameraFocusTarget | null>;
  onActiveInteractionChange: (item: NearbyInteractable | null) => void;
  onTriggerPrimaryAction: () => void;
}

const _camDesiredPos = new THREE.Vector3();
const _camDesiredLook = new THREE.Vector3();
const _camCurrentLook = new THREE.Vector3(0, 1.4, 15.5);

function lerpAngle(current: number, target: number, factor: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

function interactionSignature(item: NearbyInteractable | null): string {
  if (!item) return 'none';
  return `${item.uid}|${item.actions.map((a) => `${a.id}:${a.label}:${Boolean(a.disabled)}`).join(',')}`;
}

/**
 * Playable ground-level humanoid character controller (~1.74m tall) +
 * smooth third-person follow camera + seated first-person bench camera.
 * Keeps character state preserved across Aerial, Isometric, Walking & Cinematic views.
 */
export const WalkingPlayerController: React.FC<WalkingPlayerControllerProps> = ({
  cameraMode,
  plots,
  playerProfile,
  sittingBenchId,
  openDoors,
  playerPoseRef,
  mobileInputRef,
  vehicleStatesRef,
  focusTargetRef,
  onActiveInteractionChange,
  onTriggerPrimaryAction,
}) => {
  const { camera, gl } = useThree();

  const characterGroupRef = useRef<THREE.Group>(null);
  const speedRef = useRef(0);
  const isRunningRef = useRef(false);
  const isSittingRef = useRef(false);
  const [hideBody, setHideBody] = useState(false);

  // Follow camera & seated look camera state
  const camYawRef = useRef(playerPoseRef.current.yaw);
  const camPitchRef = useRef(0.32); // ~18 deg downward follow tilt
  const camDistRef = useRef(5.4);
  const seatLookYawRef = useRef(0);
  const seatLookPitchRef = useRef(0.03);
  const prevSittingBenchRef = useRef<string | null>(null);
  const prevCameraModeRef = useRef<CameraMode>(cameraMode);

  const keysRef = useRef<Set<string>>(new Set());
  const pointerOrbitRef = useRef<{
    pointerId: number | null;
    lastX: number;
    lastY: number;
  }>({ pointerId: null, lastX: 0, lastY: 0 });

  const lastQueryClockRef = useRef(-1);
  const lastSigRef = useRef<string>('none');
  const primaryActionRef = useRef(onTriggerPrimaryAction);
  primaryActionRef.current = onTriggerPrimaryAction;

  const appearance: CharacterAppearance = useMemo(
    () => ({
      jacketColor: playerProfile.jacketColor,
      trouserColor: playerProfile.trouserColor,
      skinColor: '#e6b89c',
      hairColor: '#3a2b22',
      shoeColor: '#252930',
    }),
    [playerProfile.jacketColor, playerProfile.trouserColor],
  );

  // Keyboard listeners for WASD / Arrows / Shift Sprint / E Interact
  useEffect(() => {
    if (cameraMode !== 'walking') {
      keysRef.current.clear();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      keysRef.current.add(e.code);
      if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) {
        primaryActionRef.current();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [cameraMode]);

  // Pointer drag camera orbit / seated look + wheel zoom in walking mode
  useEffect(() => {
    if (cameraMode !== 'walking') return;
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (pointerOrbitRef.current.pointerId !== null) return;
      pointerOrbitRef.current.pointerId = e.pointerId;
      pointerOrbitRef.current.lastX = e.clientX;
      pointerOrbitRef.current.lastY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerOrbitRef.current.pointerId !== e.pointerId) return;
      const dx = e.clientX - pointerOrbitRef.current.lastX;
      const dy = e.clientY - pointerOrbitRef.current.lastY;
      pointerOrbitRef.current.lastX = e.clientX;
      pointerOrbitRef.current.lastY = e.clientY;

      if (sittingBenchId) {
        seatLookYawRef.current = THREE.MathUtils.clamp(
          seatLookYawRef.current - dx * 0.005,
          -1.25,
          1.25,
        );
        seatLookPitchRef.current = THREE.MathUtils.clamp(
          seatLookPitchRef.current - dy * 0.004,
          -0.42,
          0.52,
        );
      } else {
        camYawRef.current -= dx * 0.0055;
        camPitchRef.current = THREE.MathUtils.clamp(
          camPitchRef.current + dy * 0.004,
          0.08,
          0.78,
        );
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pointerOrbitRef.current.pointerId === e.pointerId) {
        pointerOrbitRef.current.pointerId = null;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (sittingBenchId) return;
      e.preventDefault();
      camDistRef.current = THREE.MathUtils.clamp(camDistRef.current + e.deltaY * 0.004, 3.2, 9.6);
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [gl, cameraMode, sittingBenchId]);

  // Handle transitions between standing and sitting on a bench
  useEffect(() => {
    const prevBenchId = prevSittingBenchRef.current;
    prevSittingBenchRef.current = sittingBenchId;

    if (sittingBenchId && sittingBenchId !== prevBenchId) {
      isSittingRef.current = true;
      seatLookYawRef.current = 0;
      seatLookPitchRef.current = 0.03;
    } else if (!sittingBenchId && prevBenchId) {
      isSittingRef.current = false;
      setHideBody(false);

      const bench = TOWN_BENCHES.find((b) => b.id === prevBenchId);
      if (bench) {
        const stepX = bench.x + Math.sin(bench.rotationY) * 0.96;
        const stepZ = bench.z + Math.cos(bench.rotationY) * 0.96;
        const resolved = resolvePlayerMovement(
          stepX,
          stepZ,
          plots,
          vehicleStatesRef.current,
        );
        playerPoseRef.current.x = resolved.x;
        playerPoseRef.current.z = resolved.z;
        playerPoseRef.current.y = getSurfaceElevationAt(resolved.x, resolved.z);
        playerPoseRef.current.yaw = bench.rotationY;
        camYawRef.current = bench.rotationY;
      }
    }
  }, [sittingBenchId, plots, playerPoseRef, vehicleStatesRef]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const pose = playerPoseRef.current;

    // Reset current look anchor cleanly when entering walking mode
    if (cameraMode === 'walking' && prevCameraModeRef.current !== 'walking') {
      camYawRef.current = pose.yaw;
      _camCurrentLook.set(pose.x, pose.y + 1.38, pose.z);
    }
    prevCameraModeRef.current = cameraMode;

    // Allow "Go Here" / Explore teleportation while in Walking Mode
    if (cameraMode === 'walking' && focusTargetRef.current && !sittingBenchId) {
      const target = focusTargetRef.current;
      focusTargetRef.current = null;
      const safe = resolvePlayerMovement(
        target.x,
        target.z,
        plots,
        vehicleStatesRef.current,
      );
      pose.x = safe.x;
      pose.z = safe.z;
      pose.y = getSurfaceElevationAt(safe.x, safe.z);
      _camCurrentLook.set(pose.x, pose.y + 1.38, pose.z);
    }

    // Idle stand-in when inspecting town from Aerial / Isometric / Cinematic view
    if (cameraMode !== 'walking') {
      speedRef.current = 0;
      isRunningRef.current = false;
      if (hideBody) setHideBody(false);
      if (characterGroupRef.current) {
        characterGroupRef.current.position.set(pose.x, pose.y, pose.z);
        characterGroupRef.current.rotation.y = pose.yaw;
      }
      return;
    }

    // -------------------------------------------------------------------------
    // SEATED BENCH STATE + SMOOTH FIRST-PERSON PERSPECTIVE
    // -------------------------------------------------------------------------
    if (sittingBenchId) {
      const bench = TOWN_BENCHES.find((b) => b.id === sittingBenchId);
      if (bench) {
        const seatX = bench.x + Math.sin(bench.rotationY) * 0.06;
        const seatZ = bench.z + Math.cos(bench.rotationY) * 0.06;

        pose.x = THREE.MathUtils.damp(pose.x, seatX, 11, dt);
        pose.z = THREE.MathUtils.damp(pose.z, seatZ, 11, dt);
        pose.y = THREE.MathUtils.damp(pose.y, bench.y + 0.02, 11, dt);
        pose.yaw = lerpAngle(pose.yaw, bench.rotationY, Math.min(1, dt * 11));
        speedRef.current = 0;
        isRunningRef.current = false;

        // Realistic seated eye height above sidewalk/bench pad (y + 1.30m)
        const eyeY = bench.y + 1.3;
        _camDesiredPos.set(seatX, eyeY, seatZ);

        const lookYaw = bench.rotationY + seatLookYawRef.current;
        const lookPitch = seatLookPitchRef.current;
        _camDesiredLook.set(
          seatX + Math.sin(lookYaw) * Math.cos(lookPitch) * 6.0,
          eyeY + Math.sin(lookPitch) * 6.0,
          seatZ + Math.cos(lookYaw) * Math.cos(lookPitch) * 6.0,
        );

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesiredPos.x, 7.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesiredPos.y, 7.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesiredPos.z, 7.5, dt);
        _camCurrentLook.lerp(_camDesiredLook, Math.min(1, dt * 9.0));
        camera.lookAt(_camCurrentLook);

        const distToHead = camera.position.distanceTo(_camDesiredPos);
        if (distToHead < 0.65 && !hideBody) {
          setHideBody(true);
        }
      }
    } else {
      // -----------------------------------------------------------------------
      // WALKING / RUNNING + COLLISION + SMOOTH THIRD-PERSON FOLLOW CAMERA
      // -----------------------------------------------------------------------
      const keys = keysRef.current;
      let moveFwd = 0;
      let moveRight = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveFwd += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveFwd -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveRight += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveRight -= 1;

      const m = mobileInputRef.current;
      moveRight += m.moveX;
      moveFwd += m.moveY;

      const mag = Math.hypot(moveRight, moveFwd);
      const running =
        m.sprint || keys.has('ShiftLeft') || keys.has('ShiftRight');
      isRunningRef.current = running && mag > 0.12;

      if (mag > 0.08) {
        const clampedMag = Math.min(1, mag);
        const normR = moveRight / mag;
        const normF = moveFwd / mag;

        // Align movement with follow-camera forward direction
        const fwdX = Math.sin(camYawRef.current);
        const fwdZ = Math.cos(camYawRef.current);
        const rightX = -Math.cos(camYawRef.current);
        const rightZ = Math.sin(camYawRef.current);

        const wishX = fwdX * normF + rightX * normR;
        const wishZ = fwdZ * normF + rightZ * normR;

        const maxSpeed = running ? 6.6 : 3.55;
        const targetSpeed = maxSpeed * clampedMag;
        speedRef.current = THREE.MathUtils.damp(speedRef.current, targetSpeed, 12, dt);

        const step = speedRef.current * dt;
        const resolved = resolvePlayerMovement(
          pose.x + wishX * step,
          pose.z + wishZ * step,
          plots,
          vehicleStatesRef.current,
        );
        pose.x = resolved.x;
        pose.z = resolved.z;

        const targetCharYaw = Math.atan2(wishX, wishZ);
        pose.yaw = lerpAngle(pose.yaw, targetCharYaw, Math.min(1, dt * 13));
      } else {
        speedRef.current = THREE.MathUtils.damp(speedRef.current, 0, 14, dt);
        // Push gently out if a moving car nudges a standing player
        const resolved = resolvePlayerMovement(
          pose.x,
          pose.z,
          plots,
          vehicleStatesRef.current,
        );
        pose.x = resolved.x;
        pose.z = resolved.z;
      }

      const groundY = getSurfaceElevationAt(pose.x, pose.z);
      pose.y = THREE.MathUtils.damp(pose.y, groundY, 15, dt);

      // Third-person smooth follow camera behind character
      const dist = camDistRef.current;
      const pitch = camPitchRef.current;
      const horiz = Math.cos(pitch) * dist;
      const vert = 1.42 + Math.sin(pitch) * dist;

      const camFwdX = Math.sin(camYawRef.current);
      const camFwdZ = Math.cos(camYawRef.current);
      const desiredCamX = pose.x - camFwdX * horiz;
      const desiredCamZ = pose.z - camFwdZ * horiz;
      const groundUnderCam = getSurfaceElevationAt(desiredCamX, desiredCamZ);
      const desiredCamY = Math.max(groundUnderCam + 0.6, pose.y + vert);

      _camDesiredPos.set(desiredCamX, desiredCamY, desiredCamZ);
      _camDesiredLook.set(pose.x, pose.y + 1.38, pose.z);

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesiredPos.x, 8.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesiredPos.y, 8.5, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesiredPos.z, 8.5, dt);
      _camCurrentLook.lerp(_camDesiredLook, Math.min(1, dt * 10));
      camera.lookAt(_camCurrentLook);
    }

    if (characterGroupRef.current) {
      characterGroupRef.current.position.set(pose.x, pose.y, pose.z);
      characterGroupRef.current.rotation.y = pose.yaw;
    }

    // Throttled (~120ms) proximity evaluation for the universal World Interaction System
    const elapsed = state.clock.elapsedTime;
    if (elapsed - lastQueryClockRef.current >= 0.12) {
      lastQueryClockRef.current = elapsed;
      const active = resolveActiveWorldInteraction({
        playerX: pose.x,
        playerZ: pose.z,
        sittingBenchId,
        plots,
        openDoors,
        dynamicVehicles: vehicleStatesRef.current,
      });
      const sig = interactionSignature(active);
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        onActiveInteractionChange(active);
      }
    }
  });

  return (
    <group
      ref={characterGroupRef}
      position={[playerPoseRef.current.x, playerPoseRef.current.y, playerPoseRef.current.z]}
      rotation={[0, playerPoseRef.current.yaw, 0]}
    >
      <CharacterMesh
        appearance={appearance}
        speedRef={speedRef}
        isRunningRef={isRunningRef}
        isSittingRef={isSittingRef}
        hideBody={hideBody}
      />
    </group>
  );
};
