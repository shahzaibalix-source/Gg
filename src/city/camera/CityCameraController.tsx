import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraMode, CinematicTourId } from '../types';
import { terrainHeightAt } from '../world/VastCountryside';

export interface CameraFocusTarget {
  x: number;
  z: number;
  zoom?: number;
}

interface CityCameraControllerProps {
  cameraMode: CameraMode;
  cinematicTour: CinematicTourId;
  focusTargetRef: React.MutableRefObject<CameraFocusTarget | null>;
}

const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();
const _currentLook = new THREE.Vector3(0, 0, 0);

/**
 * Town Simulator Camera Controller supporting:
 * 1. Free View: Unrestricted 360° full-city & vast-countryside exploration
 *    (1-finger / left-drag orbit, 2-finger / right-drag pan, pinch / wheel zoom, WASD + R/F)
 * 2. Isometric Mode: Angled 3D town exploration
 * 3. Aerial View Mode: High-altitude overhead overview
 * 4. Cinematic Mode: Smooth automated showcase flyover tours
 * (Walking View is handled by WalkingPlayerController)
 */
export const CityCameraController: React.FC<CityCameraControllerProps> = ({
  cameraMode,
  cinematicTour,
  focusTargetRef,
}) => {
  const { camera, gl } = useThree();

  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  const yawRef = useRef(Math.PI * 0.25);
  const isoPitchRef = useRef(0.62);
  const distanceRef = useRef(68);
  const topHeightRef = useRef(132);

  // Dedicated Free View state for wide panoramic full-city + vast-land framing
  const freeYawRef = useRef(0.68);
  const freePitchRef = useRef(0.52);
  const freeDistRef = useRef(195);
  const prevModeRef = useRef<CameraMode>(cameraMode);

  const keysRef = useRef<Set<string>>(new Set());
  const pointerStateRef = useRef<{
    active: Map<number, { x: number; y: number }>;
    mode: 'none' | 'pan' | 'orbit';
    lastPinchDist: number | null;
    lastPinchAngle: number | null;
    lastMidX: number | null;
    lastMidY: number | null;
  }>({
    active: new Map(),
    mode: 'none',
    lastPinchDist: null,
    lastPinchAngle: null,
    lastMidX: null,
    lastMidY: null,
  });

  // Reset sensible framing when switching camera modes
  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = cameraMode;

    if (cameraMode === 'free' && prev !== 'free') {
      freeDistRef.current = THREE.MathUtils.clamp(freeDistRef.current, 14, 1100);
      freePitchRef.current = 0.52;
    } else if (cameraMode === 'aerial') {
      targetRef.current.x = THREE.MathUtils.clamp(targetRef.current.x, -960, 960);
      targetRef.current.z = THREE.MathUtils.clamp(targetRef.current.z, -960, 960);
      topHeightRef.current = THREE.MathUtils.clamp(topHeightRef.current, 45, 920);
    } else if (cameraMode === 'isometric') {
      targetRef.current.x = THREE.MathUtils.clamp(targetRef.current.x, -960, 960);
      targetRef.current.z = THREE.MathUtils.clamp(targetRef.current.z, -960, 960);
      distanceRef.current = THREE.MathUtils.clamp(distanceRef.current, 24, 620);
    }
  }, [cameraMode]);

  // Keyboard navigation (WASD / Arrow pan, Q/E rotate, R/F free zoom)
  useEffect(() => {
    if (cameraMode === 'walking') {
      keysRef.current.clear();
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      keysRef.current.add(e.code);
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

  // Mouse + Touch gestures
  useEffect(() => {
    if (cameraMode === 'walking') return;
    const dom = gl.domElement;

    const getWorldExtent = () => 960;

    const onPointerDown = (e: PointerEvent) => {
      if (cameraMode === 'cinematic') return;
      const ps = pointerStateRef.current;
      ps.active.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (ps.active.size === 1) {
        if (cameraMode === 'free') {
          // In Free View: 1-finger / left-drag smoothly orbits 360°; right/shift/middle-drag pans
          if (e.button === 2 || e.shiftKey || e.button === 1) {
            ps.mode = 'pan';
          } else {
            ps.mode = 'orbit';
          }
        } else {
          if (e.button === 2 || e.shiftKey || e.button === 1) {
            ps.mode = 'orbit';
          } else {
            ps.mode = 'pan';
          }
        }
        ps.lastMidX = null;
        ps.lastMidY = null;
      } else if (ps.active.size >= 2) {
        const pts = Array.from(ps.active.values());
        ps.lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        ps.lastPinchAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
        ps.lastMidX = (pts[0].x + pts[1].x) * 0.5;
        ps.lastMidY = (pts[0].y + pts[1].y) * 0.5;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (cameraMode === 'cinematic') return;
      const ps = pointerStateRef.current;
      const prev = ps.active.get(e.pointerId);
      if (!prev) return;

      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      ps.active.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const extent = getWorldExtent();

      if (ps.active.size === 1) {
        if (ps.mode === 'orbit' && (cameraMode === 'isometric' || cameraMode === 'free')) {
          if (cameraMode === 'free') {
            freeYawRef.current -= dx * 0.0065;
            freePitchRef.current = THREE.MathUtils.clamp(freePitchRef.current + dy * 0.0045, 0.07, 1.42);
          } else {
            yawRef.current -= dx * 0.0065;
            isoPitchRef.current = THREE.MathUtils.clamp(isoPitchRef.current + dy * 0.0045, 0.34, 1.15);
          }
        } else {
          const panScale =
            cameraMode === 'aerial'
              ? topHeightRef.current * 0.0018
              : cameraMode === 'free'
                ? freeDistRef.current * 0.0022
                : distanceRef.current * 0.0022;
          const activeYaw =
            cameraMode === 'aerial'
              ? 0
              : cameraMode === 'free'
                ? freeYawRef.current
                : yawRef.current;
          const forwardX = -Math.sin(activeYaw);
          const forwardZ = -Math.cos(activeYaw);
          const rightX = Math.cos(activeYaw);
          const rightZ = -Math.sin(activeYaw);

          targetRef.current.x = THREE.MathUtils.clamp(
            targetRef.current.x - rightX * dx * panScale + forwardX * dy * panScale,
            -extent,
            extent,
          );
          targetRef.current.z = THREE.MathUtils.clamp(
            targetRef.current.z - rightZ * dx * panScale + forwardZ * dy * panScale,
            -extent,
            extent,
          );
        }
      } else if (ps.active.size >= 2) {
        const pts = Array.from(ps.active.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
        const midX = (pts[0].x + pts[1].x) * 0.5;
        const midY = (pts[0].y + pts[1].y) * 0.5;

        if (ps.lastPinchDist !== null) {
          const delta = ps.lastPinchDist - dist;
          if (cameraMode === 'aerial') {
            topHeightRef.current = THREE.MathUtils.clamp(topHeightRef.current + delta * 0.55, 38, 920);
          } else if (cameraMode === 'free') {
            freeDistRef.current = THREE.MathUtils.clamp(freeDistRef.current + delta * 0.65, 14, 1100);
          } else {
            distanceRef.current = THREE.MathUtils.clamp(distanceRef.current + delta * 0.45, 18, 620);
          }
        }

        if (cameraMode === 'free' && ps.lastMidX !== null && ps.lastMidY !== null) {
          // Two-finger pan across the vast landscape & full city
          const mdx = midX - ps.lastMidX;
          const mdy = midY - ps.lastMidY;
          const panScale = freeDistRef.current * 0.0022;
          const yaw = freeYawRef.current;
          const forwardX = -Math.sin(yaw);
          const forwardZ = -Math.cos(yaw);
          const rightX = Math.cos(yaw);
          const rightZ = -Math.sin(yaw);

          targetRef.current.x = THREE.MathUtils.clamp(
            targetRef.current.x - rightX * mdx * panScale + forwardX * mdy * panScale,
            -extent,
            extent,
          );
          targetRef.current.z = THREE.MathUtils.clamp(
            targetRef.current.z - rightZ * mdx * panScale + forwardZ * mdy * panScale,
            -extent,
            extent,
          );
        }

        if (ps.lastPinchAngle !== null && (cameraMode === 'isometric' || cameraMode === 'free')) {
          let dAngle = angle - ps.lastPinchAngle;
          if (dAngle > Math.PI) dAngle -= Math.PI * 2;
          if (dAngle < -Math.PI) dAngle += Math.PI * 2;
          if (cameraMode === 'free') {
            freeYawRef.current += dAngle * 0.85;
          } else {
            yawRef.current += dAngle * 0.85;
          }
        }

        ps.lastPinchDist = dist;
        ps.lastPinchAngle = angle;
        ps.lastMidX = midX;
        ps.lastMidY = midY;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const ps = pointerStateRef.current;
      ps.active.delete(e.pointerId);
      if (ps.active.size < 2) {
        ps.lastPinchDist = null;
        ps.lastPinchAngle = null;
        ps.lastMidX = null;
        ps.lastMidY = null;
      }
      if (ps.active.size === 0) ps.mode = 'none';
    };

    const onWheel = (e: WheelEvent) => {
      if (cameraMode === 'cinematic') return;
      e.preventDefault();
      if (cameraMode === 'aerial') {
        topHeightRef.current = THREE.MathUtils.clamp(topHeightRef.current + e.deltaY * 0.22, 38, 920);
      } else if (cameraMode === 'free') {
        freeDistRef.current = THREE.MathUtils.clamp(
          freeDistRef.current + e.deltaY * 0.26,
          14,
          1100,
        );
      } else {
        distanceRef.current = THREE.MathUtils.clamp(distanceRef.current + e.deltaY * 0.16, 18, 620);
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContextMenu);
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl, cameraMode]);

  useFrame((state, delta) => {
    if (cameraMode === 'walking') return;
    const dt = Math.min(delta, 0.05);
    const extent = 960;

    // Handle quick district / plot focus requests
    if (focusTargetRef.current) {
      targetRef.current.x = THREE.MathUtils.clamp(focusTargetRef.current.x, -extent, extent);
      targetRef.current.z = THREE.MathUtils.clamp(focusTargetRef.current.z, -extent, extent);
      if (focusTargetRef.current.zoom !== undefined) {
        distanceRef.current = focusTargetRef.current.zoom;
        freeDistRef.current = Math.max(24, focusTargetRef.current.zoom);
        topHeightRef.current = Math.max(55, focusTargetRef.current.zoom * 1.45);
      }
      focusTargetRef.current = null;
    }

    if (cameraMode === 'cinematic') {
      const t = state.clock.elapsedTime;
      if (cinematicTour === 'town-hall-reveal') {
        const a = t * 0.22;
        _desiredLook.set(0, 3.2, -3.0);
        _desiredPos.set(Math.sin(a) * 34, 17 + Math.sin(t * 0.4) * 3, 18 + Math.cos(a) * 24);
      } else if (cinematicTour === 'residential-flyover') {
        const p = t * 0.16;
        _desiredLook.set(-55 + Math.sin(p) * 14, 2.0, 10 + Math.cos(p) * 32);
        _desiredPos.set(-34 + Math.sin(p) * 18, 22, 34 + Math.cos(p) * 34);
      } else if (cinematicTour === 'luxury-flyover') {
        const p = t * 0.2;
        _desiredLook.set(0, 5.5, -214);
        _desiredPos.set(Math.cos(p) * 58, 28 + Math.sin(p * 1.5) * 4, -214 + Math.sin(p) * 58);
      } else if (cinematicTour === 'commercial-park-tour') {
        const p = t * 0.14;
        const mix = (Math.sin(p) + 1) * 0.5;
        _desiredLook.set(THREE.MathUtils.lerp(236, 446, mix), 4.0, THREE.MathUtils.lerp(0, 0, mix));
        _desiredPos.set(
          THREE.MathUtils.lerp(220, 410, mix),
          54,
          THREE.MathUtils.lerp(82, 95, mix),
        );
      } else if (cinematicTour === 'central-gardens-orbit') {
        const a = t * 0.18;
        _desiredLook.set(160, 4.0, 332);
        _desiredPos.set(160 + Math.cos(a) * 92, 39 + Math.sin(t * 0.35) * 6, 332 + Math.sin(a) * 92);
      } else if (cinematicTour === 'lakeside-sunset-cruise') {
        const s = (Math.sin(t * 0.11) + 1) * 0.5;
        const lookX = THREE.MathUtils.lerp(610, 795, s);
        const lookZ = THREE.MathUtils.lerp(-220, 210, s) + Math.sin(s * Math.PI * 2) * 38;
        _desiredLook.set(lookX, 4.5, lookZ);
        _desiredPos.set(
          lookX + 115 * Math.cos(s * Math.PI * 0.6),
          46 + Math.sin(t * 0.28) * 7,
          lookZ + 95,
        );
      } else if (cinematicTour === 'grand-7-district-tour') {
        // Smooth cyclical loop across Oakwood -> Highland -> Lakeside -> Greenfield -> Central Gardens -> Maplewood -> Riverside
        const waypointsX = [-580, 185, 790, 520, 160, -580, -735];
        const waypointsZ = [-450, -560, -140, 580, 340, 500, 0];
        const count = waypointsX.length;
        const progress = ((t * 0.095) % count + count) % count;
        const idx0 = Math.floor(progress);
        const idx1 = (idx0 + 1) % count;
        const idxPrev = (idx0 + count - 1) % count;
        const idx2 = (idx1 + 1) % count;
        const u = progress - idx0;
        const u2 = u * u;
        const u3 = u2 * u;
        const catmull = (p0: number, p1: number, p2: number, p3: number) =>
          0.5 *
          (2 * p1 +
            (-p0 + p2) * u +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
        const lx = catmull(waypointsX[idxPrev], waypointsX[idx0], waypointsX[idx1], waypointsX[idx2]);
        const lz = catmull(waypointsZ[idxPrev], waypointsZ[idx0], waypointsZ[idx1], waypointsZ[idx2]);
        const orbitAngle = t * 0.14;
        _desiredLook.set(lx, 5.0, lz);
        _desiredPos.set(
          lx + Math.sin(orbitAngle) * 145,
          72 + Math.sin(t * 0.25) * 14,
          lz + Math.cos(orbitAngle) * 145,
        );
      } else {
        // full-town-loop
        const a = t * 0.09;
        _desiredLook.set(Math.sin(a * 0.5) * 60, 4.0, Math.cos(a * 0.5) * 60);
        _desiredPos.set(Math.sin(a) * 360, 180 + Math.sin(t * 0.25) * 18, Math.cos(a) * 360);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredPos.x, 3.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredPos.y, 3.5, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredPos.z, 3.5, dt);
      _currentLook.lerp(_desiredLook, Math.min(1, dt * 4));
      camera.lookAt(_currentLook);
      return;
    }

    // Keyboard WASD / Arrow Panning + Q/E Orbit Rotation + R/F Zoom
    const keys = keysRef.current;
    let moveFwd = 0;
    let moveRight = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) moveFwd += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveFwd -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveRight += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveRight -= 1;

    if (cameraMode === 'isometric') {
      if (keys.has('KeyQ')) yawRef.current -= dt * 1.4;
      if (keys.has('KeyE')) yawRef.current += dt * 1.4;
    } else if (cameraMode === 'free') {
      if (keys.has('KeyQ')) freeYawRef.current -= dt * 1.4;
      if (keys.has('KeyE')) freeYawRef.current += dt * 1.4;
      if (keys.has('KeyR')) {
        freeDistRef.current = THREE.MathUtils.clamp(freeDistRef.current + dt * 140, 14, 1100);
      }
      if (keys.has('KeyF')) {
        freeDistRef.current = THREE.MathUtils.clamp(freeDistRef.current - dt * 140, 14, 1100);
      }
    }

    if (moveFwd !== 0 || moveRight !== 0) {
      const refDist =
        cameraMode === 'aerial'
          ? topHeightRef.current
          : cameraMode === 'free'
            ? freeDistRef.current
            : distanceRef.current;
      const speed = refDist * 0.72 * dt;
      const activeYaw =
        cameraMode === 'aerial'
          ? 0
          : cameraMode === 'free'
            ? freeYawRef.current
            : yawRef.current;
      const fx = -Math.sin(activeYaw);
      const fz = -Math.cos(activeYaw);
      const rx = Math.cos(activeYaw);
      const rz = -Math.sin(activeYaw);
      targetRef.current.x = THREE.MathUtils.clamp(
        targetRef.current.x + (fx * moveFwd + rx * moveRight) * speed,
        -extent,
        extent,
      );
      targetRef.current.z = THREE.MathUtils.clamp(
        targetRef.current.z + (fz * moveFwd + rz * moveRight) * speed,
        -extent,
        extent,
      );
    }

    if (cameraMode === 'aerial') {
      _desiredLook.set(targetRef.current.x, 0, targetRef.current.z);
      _desiredPos.set(targetRef.current.x, topHeightRef.current, targetRef.current.z + 0.01);
    } else if (cameraMode === 'free') {
      const d = freeDistRef.current;
      const pitch = freePitchRef.current;
      const horiz = Math.cos(pitch) * d;
      const vert = Math.sin(pitch) * d;
      const lookY = Math.max(0, terrainHeightAt(targetRef.current.x, targetRef.current.z)) + 1.5;
      _desiredLook.set(targetRef.current.x, lookY, targetRef.current.z);
      const camX = targetRef.current.x + Math.sin(freeYawRef.current) * horiz;
      const camZ = targetRef.current.z + Math.cos(freeYawRef.current) * horiz;
      const minCamY = Math.max(2.5, terrainHeightAt(camX, camZ) + 2.5);
      _desiredPos.set(camX, Math.max(minCamY, lookY + vert), camZ);
    } else {
      const d = distanceRef.current;
      const pitch = isoPitchRef.current;
      const horiz = Math.cos(pitch) * d;
      const vert = Math.sin(pitch) * d;
      _desiredLook.set(targetRef.current.x, 1.2, targetRef.current.z);
      _desiredPos.set(
        targetRef.current.x + Math.sin(yawRef.current) * horiz,
        vert,
        targetRef.current.z + Math.cos(yawRef.current) * horiz,
      );
    }

    camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredPos.x, 7.5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredPos.y, 7.5, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredPos.z, 7.5, dt);
    _currentLook.lerp(_desiredLook, Math.min(1, dt * 8.5));
    camera.lookAt(_currentLook);
  });

  return null;
};
