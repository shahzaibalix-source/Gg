import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PARKED_CARS, ROAD_SURFACE_Y, TRAFFIC_LOOPS } from '../world/MasterTownBlueprint';
import { TimeOfDay, Vec2 } from '../types';
import { CarBodyStyle, CarMesh } from '../assets/VehicleModels';
import { sharedTrafficSignals } from './trafficSignals';
import { DynamicVehicleObstacle } from './WorldCollision';

interface VehicleSpec {
  id: string;
  loopIndex: number;
  initialProgress: number;
  color: string;
  style: CarBodyStyle;
  cruiseSpeed: number;
}

export const ACTIVE_VEHICLES: VehicleSpec[] = [
  { id: 'car-1', loopIndex: 0, initialProgress: 0.08, color: '#2b4c6f', style: 'sedan', cruiseSpeed: 8.4 },
  { id: 'car-2', loopIndex: 0, initialProgress: 0.56, color: '#a83834', style: 'hatchback', cruiseSpeed: 8.2 },
  { id: 'car-3', loopIndex: 1, initialProgress: 0.24, color: '#d8d5cd', style: 'wagon', cruiseSpeed: 7.9 },
  { id: 'car-4', loopIndex: 1, initialProgress: 0.74, color: '#3b6a64', style: 'sedan', cruiseSpeed: 8.0 },
  { id: 'car-5', loopIndex: 2, initialProgress: 0.35, color: '#395a49', style: 'hatchback', cruiseSpeed: 8.6 },
  { id: 'car-6', loopIndex: 3, initialProgress: 0.65, color: '#474c54', style: 'sedan', cruiseSpeed: 8.8 },
  { id: 'car-7', loopIndex: 4, initialProgress: 0.15, color: '#b87638', style: 'wagon', cruiseSpeed: 9.2 },
  { id: 'car-8', loopIndex: 4, initialProgress: 0.62, color: '#2b3e58', style: 'hatchback', cruiseSpeed: 9.0 },
];

export const TOTAL_TOWN_VEHICLE_COUNT = ACTIVE_VEHICLES.length + PARKED_CARS.length;

const SIGNAL_CORNERS: ReadonlyArray<{ x: number; z: number }> = [
  { x: -26, z: -26 },
  { x: 26, z: -26 },
  { x: -26, z: 26 },
  { x: 26, z: 26 },
];

interface SampledLoop {
  points: THREE.Vector3[];
  totalLength: number;
  cumulativeLengths: number[];
}

function buildLinearClosedLoop(waypoints: Vec2[]): SampledLoop {
  const pts = waypoints.map((w) => new THREE.Vector3(w.x, ROAD_SURFACE_Y, w.z));
  const curvePath = new THREE.CurvePath<THREE.Vector3>();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    curvePath.add(new THREE.LineCurve3(pts[i], pts[(i + 1) % n]));
  }

  const sampled = curvePath.getSpacedPoints(420);
  const cum: number[] = [0];
  let acc = 0;
  for (let i = 1; i < sampled.length; i++) {
    acc += sampled[i].distanceTo(sampled[i - 1]);
    cum.push(acc);
  }
  return { points: sampled, totalLength: acc, cumulativeLengths: cum };
}

function sampleLoopAtDistance(
  loop: SampledLoop,
  dist: number,
  outPos: THREE.Vector3,
  outDir: THREE.Vector3,
): void {
  const d = ((dist % loop.totalLength) + loop.totalLength) % loop.totalLength;
  const cum = loop.cumulativeLengths;
  let lo = 0;
  let hi = cum.length - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid + 1;
    else hi = mid - 1;
  }
  const idx = Math.max(0, Math.min(cum.length - 2, hi));
  const segStart = cum[idx];
  const segEnd = cum[idx + 1];
  const t = segEnd > segStart ? (d - segStart) / (segEnd - segStart) : 0;

  outPos.lerpVectors(loop.points[idx], loop.points[idx + 1], t);
  outDir.subVectors(loop.points[idx + 1], loop.points[idx]);
  if (outDir.lengthSq() > 1e-6) outDir.normalize();
  else outDir.set(0, 0, 1);
}

interface TrafficManagerProps {
  timeOfDay: TimeOfDay;
  vehicleStatesRef?: React.MutableRefObject<DynamicVehicleObstacle[]>;
}

const _posA = new THREE.Vector3();
const _dirA = new THREE.Vector3();
const _toOther = new THREE.Vector3();

export const TrafficManager: React.FC<TrafficManagerProps> = ({ timeOfDay, vehicleStatesRef }) => {
  const sampledLoops = useMemo(
    () => TRAFFIC_LOOPS.map((l) => buildLinearClosedLoop(l.waypoints)),
    [],
  );

  const carPositionsRef = useRef<THREE.Vector3[]>(
    ACTIVE_VEHICLES.map(() => new THREE.Vector3()),
  );
  const carDistancesRef = useRef<number[]>(
    ACTIVE_VEHICLES.map((v) => v.initialProgress * sampledLoops[v.loopIndex].totalLength),
  );
  const carCurrentSpeedsRef = useRef<number[]>(ACTIVE_VEHICLES.map((v) => v.cruiseSpeed));

  return (
    <group>
      {ACTIVE_VEHICLES.map((spec, idx) => (
        <SimulatedVehicle
          key={spec.id}
          spec={spec}
          index={idx}
          loop={sampledLoops[spec.loopIndex]}
          timeOfDay={timeOfDay}
          carPositionsRef={carPositionsRef}
          carDistancesRef={carDistancesRef}
          carCurrentSpeedsRef={carCurrentSpeedsRef}
          vehicleStatesRef={vehicleStatesRef}
        />
      ))}
    </group>
  );
};

interface SimulatedVehicleProps {
  spec: VehicleSpec;
  index: number;
  loop: SampledLoop;
  timeOfDay: TimeOfDay;
  carPositionsRef: React.MutableRefObject<THREE.Vector3[]>;
  carDistancesRef: React.MutableRefObject<number[]>;
  carCurrentSpeedsRef: React.MutableRefObject<number[]>;
  vehicleStatesRef?: React.MutableRefObject<DynamicVehicleObstacle[]>;
}

const SimulatedVehicle: React.FC<SimulatedVehicleProps> = ({
  spec,
  index,
  loop,
  timeOfDay,
  carPositionsRef,
  carDistancesRef,
  carCurrentSpeedsRef,
  vehicleStatesRef,
}) => {
  const visualRef = useRef<THREE.Group>(null);
  const speedRef = useRef(spec.cruiseSpeed);
  const steerRef = useRef(0);
  const yawRef = useRef(0);
  const initializedRef = useRef(false);
  const [braking, setBraking] = useState(false);

  const initialTransform = useMemo(() => {
    const p = new THREE.Vector3();
    const d = new THREE.Vector3();
    sampleLoopAtDistance(loop, spec.initialProgress * loop.totalLength, p, d);
    return {
      pos: [p.x, p.y, p.z] as [number, number, number],
      yaw: Math.atan2(d.x, d.z),
    };
  }, [loop, spec.initialProgress]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const curDist = carDistancesRef.current[index];
    sampleLoopAtDistance(loop, curDist, _posA, _dirA);

    if (!initializedRef.current) {
      yawRef.current = Math.atan2(_dirA.x, _dirA.z);
      carPositionsRef.current[index].copy(_posA);
      initializedRef.current = true;
    }

    let shouldBrake = false;

    // 1. Check red/amber signalized intersections ahead
    const travelingNS = Math.abs(_dirA.z) > Math.abs(_dirA.x);
    const activeAspect = travelingNS
      ? sharedTrafficSignals.nsAspect
      : sharedTrafficSignals.ewAspect;

    if (activeAspect !== 'green') {
      for (const sig of SIGNAL_CORNERS) {
        const dx = sig.x - _posA.x;
        const dz = sig.z - _posA.z;
        const along = dx * _dirA.x + dz * _dirA.z;
        const perp = Math.abs(dx * -_dirA.z + dz * _dirA.x);
        if (along > 7.6 && along < 13.0 && perp < 4.5) {
          shouldBrake = true;
          break;
        }
      }
    }

    // 2. Vehicle-to-vehicle headway spacing
    if (!shouldBrake) {
      for (let j = 0; j < carPositionsRef.current.length; j++) {
        if (j === index) continue;
        const otherPos = carPositionsRef.current[j];
        _toOther.subVectors(otherPos, _posA);
        _toOther.y = 0;
        const dist = _toOther.length();
        if (dist < 8.6 && dist > 0.01) {
          _toOther.divideScalar(dist);
          if (_toOther.dot(_dirA) > 0.68) {
            shouldBrake = true;
            break;
          }
        }
      }
    }

    if (shouldBrake !== braking) {
      setBraking(shouldBrake);
    }

    const targetSpeed = shouldBrake ? 0 : spec.cruiseSpeed;
    const curSpeed = THREE.MathUtils.damp(
      carCurrentSpeedsRef.current[index],
      targetSpeed,
      shouldBrake ? 7.5 : 3.2,
      dt,
    );
    carCurrentSpeedsRef.current[index] = curSpeed;
    speedRef.current = curSpeed;

    const nextDist = curDist + curSpeed * dt;
    carDistancesRef.current[index] = nextDist;
    sampleLoopAtDistance(loop, nextDist, _posA, _dirA);
    carPositionsRef.current[index].copy(_posA);

    const targetYaw = Math.atan2(_dirA.x, _dirA.z);
    let diff = targetYaw - yawRef.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yawRef.current += diff * Math.min(1, dt * 8.0);
    steerRef.current = THREE.MathUtils.clamp(diff * 1.8, -0.45, 0.45);

    if (visualRef.current) {
      visualRef.current.position.copy(_posA);
      visualRef.current.rotation.y = yawRef.current;
    }

    if (vehicleStatesRef) {
      const entry = vehicleStatesRef.current[index];
      if (entry) {
        entry.x = _posA.x;
        entry.z = _posA.z;
        entry.yaw = yawRef.current;
        entry.speed = curSpeed;
      } else {
        vehicleStatesRef.current[index] = {
          id: spec.id,
          x: _posA.x,
          z: _posA.z,
          yaw: yawRef.current,
          speed: curSpeed,
          style: spec.style,
          color: spec.color,
        };
      }
    }
  });

  return (
    <group ref={visualRef} position={initialTransform.pos} rotation={[0, initialTransform.yaw, 0]}>
      <CarMesh
        color={spec.color}
        style={spec.style}
        timeOfDay={timeOfDay}
        speedRef={speedRef}
        steerRef={steerRef}
        isBraking={braking}
      />
    </group>
  );
};
