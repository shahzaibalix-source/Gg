import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ExpansionCityWorld, getExpansionHouseMetrics, queryNearbyExpansionPlots } from './ExpansionMasterPlan';
import { ExpansionDistrictId, ExpansionPlotSpec } from './types';
import { PlotCustomization, TimeOfDay } from '../types';
import { PlayerPoseState } from '../player/WalkingPlayerController';
import { DynamicVehicleObstacle } from '../simulation/WorldCollision';
import { ROAD_SURFACE_Y, SIDEWALK_HEIGHT } from '../world/MasterTownBlueprint';

interface ExpansionLivingWorldProps {
  world: ExpansionCityWorld;
  timeOfDay: TimeOfDay;
  playerPoseRef: React.MutableRefObject<PlayerPoseState>;
  vehicleStatesRef: React.MutableRefObject<DynamicVehicleObstacle[]>;
  plotCustomizations: Record<string, PlotCustomization>;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _pos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _focus = new THREE.Vector3();

interface SampledPath {
  points: THREE.Vector3[];
  cum: number[];
  total: number;
  closed: boolean;
}

function buildSampledPath(pts: Array<{ x: number; z: number }>, y: number, closed: boolean): SampledPath {
  const vecs = pts.map((p) => new THREE.Vector3(p.x, y, p.z));
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < vecs.length; i++) {
    total += vecs[i].distanceTo(vecs[i - 1]);
    cum.push(total);
  }
  if (closed && vecs.length > 2) {
    total += vecs[0].distanceTo(vecs[vecs.length - 1]);
    vecs.push(vecs[0].clone());
    cum.push(total);
  }
  return { points: vecs, cum, total: Math.max(1, total), closed };
}

function samplePathDistance(
  path: SampledPath,
  rawDist: number,
  outPos: THREE.Vector3,
  outDir: THREE.Vector3,
): void {
  const total = path.total;
  let d = rawDist;
  let reverse = false;
  if (path.closed) {
    d = ((rawDist % total) + total) % total;
  } else {
    const cycle = total * 2;
    const mod = ((rawDist % cycle) + cycle) % cycle;
    if (mod > total) {
      d = cycle - mod;
      reverse = true;
    } else {
      d = mod;
    }
  }

  const cum = path.cum;
  let lo = 0;
  let hi = cum.length - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid + 1;
    else hi = mid - 1;
  }
  const idx = Math.max(0, Math.min(cum.length - 2, hi));
  const segLen = cum[idx + 1] - cum[idx];
  const t = segLen > 1e-4 ? (d - cum[idx]) / segLen : 0;

  outPos.lerpVectors(path.points[idx], path.points[idx + 1], t);
  if (reverse) {
    outDir.subVectors(path.points[idx], path.points[idx + 1]);
  } else {
    outDir.subVectors(path.points[idx + 1], path.points[idx]);
  }
  if (outDir.lengthSq() > 1e-6) outDir.normalize();
  else outDir.set(0, 0, 1);
}

interface ArchwaySpec {
  id: string;
  districtId: ExpansionDistrictId;
  title: string;
  subtitle: string;
  x: number;
  z: number;
  rotY: number;
  spanWidth: number;
  stoneColor: string;
  accentColor: string;
}

const DISTRICT_ARCHWAYS: ArchwaySpec[] = [
  {
    id: 'arch-oakwood',
    districtId: 'oakwood-district',
    title: 'OAKWOOD DISTRICT',
    subtitle: 'Woodland Ridges & Timber Terraces',
    x: -360,
    z: -330,
    rotY: Math.PI / 2,
    spanWidth: 13.4,
    stoneColor: '#6f6558',
    accentColor: '#a78bfa',
  },
  {
    id: 'arch-riverside',
    districtId: 'riverside-district',
    title: 'RIVERSIDE DISTRICT',
    subtitle: 'San Marco Canalfront Promenades',
    x: -360,
    z: -130,
    rotY: Math.PI / 2,
    spanWidth: 13.6,
    stoneColor: '#d9d0c1',
    accentColor: '#38bdf8',
  },
  {
    id: 'arch-maplewood',
    districtId: 'maplewood-district',
    title: 'MAPLEWOOD DISTRICT',
    subtitle: 'Autumn Crescents & Courtyard Villas',
    x: -360,
    z: 176,
    rotY: Math.PI / 2,
    spanWidth: 13.4,
    stoneColor: '#8d5342',
    accentColor: '#f97316',
  },
  {
    id: 'arch-highland',
    districtId: 'highland-district',
    title: 'HIGHLAND DISTRICT',
    subtitle: 'Northern Crest & Alpine Views',
    x: 185,
    z: -372,
    rotY: 0,
    spanWidth: 12.2,
    stoneColor: '#58616e',
    accentColor: '#fb7185',
  },
  {
    id: 'arch-lakeside',
    districtId: 'lakeside-district',
    title: 'LAKESIDE DISTRICT',
    subtitle: 'Waterfront Coves & Lagoon Villas',
    x: 625,
    z: -130,
    rotY: Math.PI / 2,
    spanWidth: 13.6,
    stoneColor: '#cfc9bc',
    accentColor: '#2dd4bf',
  },
  {
    id: 'arch-central-gardens',
    districtId: 'central-gardens',
    title: 'CENTRAL GARDENS',
    subtitle: 'Floral Rotunda & Boulevards',
    x: 145,
    z: 215,
    rotY: 0,
    spanWidth: 13.4,
    stoneColor: '#d7cfbe',
    accentColor: '#34d399',
  },
  {
    id: 'arch-greenfield',
    districtId: 'greenfield-district',
    title: 'GREENFIELD DISTRICT',
    subtitle: 'Orchard Meadows & Parkways',
    x: 0,
    z: 530,
    rotY: 0,
    spanWidth: 12.2,
    stoneColor: '#a69a86',
    accentColor: '#84cc16',
  },
];

function createArchSignTexture(title: string, subtitle: string, accentColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#18202c';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, 502, 118);

    ctx.fillStyle = accentColor;
    ctx.fillRect(18, 20, 10, 88);
    ctx.fillRect(484, 20, 10, 88);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 256, 48);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(subtitle, 256, 88);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export const ExpansionLivingWorld: React.FC<ExpansionLivingWorldProps> = ({
  world,
  timeOfDay,
  playerPoseRef,
  vehicleStatesRef,
  plotCustomizations,
}) => {
  const { camera } = useThree();
  const isEvening = timeOfDay === 'sunset' || timeOfDay === 'night';

  // ---------------------------------------------------------------------------
  // 1. Curved-Road Zebra Crosswalks (Near 8 Roundabouts + 7 District Parks)
  // ---------------------------------------------------------------------------
  const crosswalkBars = useMemo(() => {
    const bars: Array<{ x: number; z: number; rotY: number }> = [];
    for (const rb of world.roundabouts) {
      const approachR = rb.innerRadius + rb.roadWidth + 1.4;
      for (const ang of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
        const cx = rb.x + Math.cos(ang) * approachR;
        const cz = rb.z + Math.sin(ang) * approachR;
        const rotY = Math.atan2(Math.cos(ang), Math.sin(ang));
        const tx = -Math.sin(ang);
        const tz = Math.cos(ang);
        for (let k = -2; k <= 2; k++) {
          bars.push({
            x: cx + tx * (k * 1.4),
            z: cz + tz * (k * 1.4),
            rotY,
          });
        }
      }
    }
    for (const pk of world.districtParks) {
      const cx = pk.x;
      const cz = pk.z + pk.depth * 0.5 + 3.4;
      for (let k = -2; k <= 2; k++) {
        bars.push({
          x: cx + k * 1.45,
          z: cz,
          rotY: 0,
        });
      }
    }
    return bars;
  }, [world.roundabouts, world.districtParks]);

  const crosswalkMeshRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!crosswalkMeshRef.current || crosswalkBars.length === 0) return;
    crosswalkBars.forEach((b, i) => {
      _dummy.position.set(b.x, ROAD_SURFACE_Y + 0.017, b.z);
      _dummy.rotation.set(0, b.rotY, 0);
      _dummy.scale.set(0.62, 1, 3.1);
      _dummy.updateMatrix();
      crosswalkMeshRef.current!.setMatrixAt(i, _dummy.matrix);
    });
    crosswalkMeshRef.current.instanceMatrix.needsUpdate = true;
    crosswalkMeshRef.current.computeBoundingSphere();
  }, [crosswalkBars]);

  // ---------------------------------------------------------------------------
  // 2. Curved-Road AI Vehicles & Roundabout Cruisers (36 Vehicles)
  // ---------------------------------------------------------------------------
  const carAgents = useMemo(() => {
    const collectorAndScenic = world.curvedRoads.filter(
      (cr) => cr.sampledPoints.length >= 6 && (cr.tier === 'collector' || cr.tier === 'scenic-curve'),
    );
    const residentialCurves = world.curvedRoads.filter(
      (cr, idx) => cr.sampledPoints.length >= 6 && cr.tier === 'residential' && idx % 3 === 0,
    );

    const routes: SampledPath[] = [];
    for (const cr of [...collectorAndScenic, ...residentialCurves]) {
      routes.push(buildSampledPath(cr.sampledPoints, ROAD_SURFACE_Y, Boolean(cr.closed)));
    }
    // Add circular orbits around all 8 roundabouts
    for (const rb of world.roundabouts) {
      const pts: Array<{ x: number; z: number }> = [];
      const rOrbit = rb.innerRadius + rb.roadWidth * 0.52;
      const segs = 24;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push({ x: rb.x + Math.cos(a) * rOrbit, z: rb.z + Math.sin(a) * rOrbit });
      }
      routes.push(buildSampledPath(pts, ROAD_SURFACE_Y, true));
    }

    const palette = ['#2b4c6f', '#c93c34', '#e2ded5', '#395a49', '#475569', '#b57b3b', '#3b6a64'];
    const styles = ['sedan', 'hatchback', 'wagon'];
    const agents: Array<{
      id: string;
      routeIdx: number;
      dist: number;
      speed: number;
      laneOffset: number;
      color: string;
      style: string;
    }> = [];

    const totalCount = Math.min(38, Math.max(16, routes.length));
    for (let i = 0; i < totalCount; i++) {
      const rIdx = i % routes.length;
      const route = routes[rIdx];
      agents.push({
        id: `exp-car-${i}`,
        routeIdx: rIdx,
        dist: ((i * 0.37) % 1) * route.total,
        speed: 7.5 + (i % 5) * 1.15,
        laneOffset: route.closed ? 0 : 1.9,
        color: palette[i % palette.length],
        style: styles[i % styles.length],
      });
    }
    return { routes, agents };
  }, [world.curvedRoads, world.roundabouts]);

  const carBodyRef = useRef<THREE.InstancedMesh>(null);
  const carCabinRef = useRef<THREE.InstancedMesh>(null);
  const carHeadlightRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!carBodyRef.current) return;
    carAgents.agents.forEach((a, i) => {
      _color.set(a.color);
      carBodyRef.current!.setColorAt(i, _color);
    });
    if (carBodyRef.current.instanceColor) carBodyRef.current.instanceColor.needsUpdate = true;
  }, [carAgents]);

  // ---------------------------------------------------------------------------
  // 3. Community Shuttle Buses Looping Between District Bus Stops (3 Buses)
  // ---------------------------------------------------------------------------
  const busLoop = useMemo(() => {
    const stopOrder = ['bs-cg', 'bs-gf', 'bs-lake', 'bs-high', 'bs-oak', 'bs-riv', 'bs-map'];
    const orderedStops = stopOrder
      .map((id) => world.busStops.find((b) => b.id === id))
      .filter((b): b is NonNullable<typeof b> => Boolean(b));

    const controlPts =
      orderedStops.length >= 3
        ? orderedStops.map((s) => new THREE.Vector3(s.x, ROAD_SURFACE_Y, s.z))
        : [
            new THREE.Vector3(155, ROAD_SURFACE_Y, 284),
            new THREE.Vector3(730, ROAD_SURFACE_Y, -36),
            new THREE.Vector3(185, ROAD_SURFACE_Y, -448),
            new THREE.Vector3(-520, ROAD_SURFACE_Y, -445),
            new THREE.Vector3(-520, ROAD_SURFACE_Y, 472),
          ];

    const curve = new THREE.CatmullRomCurve3(controlPts, true, 'catmullrom', 0.45);
    const sampled = curve.getSpacedPoints(360);
    const cum: number[] = [0];
    let total = 0;
    for (let i = 1; i < sampled.length; i++) {
      total += sampled[i].distanceTo(sampled[i - 1]);
      cum.push(total);
    }

    // Track cumulative distance of each stop along the closed loop
    const stopDistances = orderedStops.map((st) => {
      let bestIdx = 0;
      let bestD = Infinity;
      for (let i = 0; i < sampled.length; i++) {
        const d = Math.hypot(sampled[i].x - st.x, sampled[i].z - st.z);
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      return cum[bestIdx];
    });

    const path: SampledPath = { points: sampled, cum, total: Math.max(1, total), closed: true };
    const buses = [
      { id: 'exp-bus-1', dist: 0, pauseTimer: 0, lastStopIdx: -1, color: '#d97706' },
      { id: 'exp-bus-2', dist: total * 0.33, pauseTimer: 0, lastStopIdx: -1, color: '#0284c7' },
      { id: 'exp-bus-3', dist: total * 0.66, pauseTimer: 0, lastStopIdx: -1, color: '#059669' },
    ];
    return { path, stopDistances, buses };
  }, [world.busStops]);

  const busBodyRef = useRef<THREE.InstancedMesh>(null);
  const busWindowRef = useRef<THREE.InstancedMesh>(null);
  const busRoofRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!busBodyRef.current) return;
    busLoop.buses.forEach((b, i) => {
      _color.set(b.color);
      busBodyRef.current!.setColorAt(i, _color);
    });
    if (busBodyRef.current.instanceColor) busBodyRef.current.instanceColor.needsUpdate = true;
  }, [busLoop]);

  // ---------------------------------------------------------------------------
  // 4. District Pedestrians & Park Visitors (64 Pedestrians)
  // ---------------------------------------------------------------------------
  const pedAgents = useMemo(() => {
    const paths: SampledPath[] = [];

    // Paths around all 7 District Parks
    for (const pk of world.districtParks) {
      const rx = pk.width * 0.36;
      const rz = pk.depth * 0.36;
      const pts: Array<{ x: number; z: number }> = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        pts.push({ x: pk.x + Math.cos(a) * rx, z: pk.z + Math.sin(a) * rz });
      }
      paths.push(buildSampledPath(pts, SIDEWALK_HEIGHT, true));
    }

    // Central Gardens Rotunda walkers
    const rotundaPts: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      rotundaPts.push({ x: 160 + Math.cos(a) * 18, z: 332 + Math.sin(a) * 18 });
    }
    paths.push(buildSampledPath(rotundaPts, SIDEWALK_HEIGHT, true));

    // Curved sidewalk strollers across the 7 districts
    world.curvedRoads.forEach((cr, idx) => {
      if (idx % 5 !== 0 || cr.sampledPoints.length < 6) return;
      const swOffset = cr.width * 0.5 + cr.greenStripWidth + cr.sidewalkWidth * 0.5;
      const pts: Array<{ x: number; z: number }> = [];
      for (let i = 0; i < cr.sampledPoints.length; i++) {
        const p = cr.sampledPoints[i];
        const pNext = cr.sampledPoints[Math.min(cr.sampledPoints.length - 1, i + 1)];
        const pPrev = cr.sampledPoints[Math.max(0, i - 1)];
        const tx = pNext.x - pPrev.x;
        const tz = pNext.z - pPrev.z;
        const len = Math.hypot(tx, tz) || 1;
        pts.push({ x: p.x + (-tz / len) * swOffset, z: p.z + (tx / len) * swOffset });
      }
      paths.push(buildSampledPath(pts, SIDEWALK_HEIGHT, Boolean(cr.closed)));
    });

    const jacketColors = [
      '#3b5998', '#a25343', '#4b7a57', '#c4975a', '#6b536b',
      '#486b7a', '#8c4b4b', '#2d4159', '#b87638', '#3a6658',
    ];
    const agents: Array<{
      pathIdx: number;
      dist: number;
      speed: number;
      phase: number;
      jacket: string;
    }> = [];

    const count = Math.min(72, Math.max(24, paths.length * 2));
    for (let i = 0; i < count; i++) {
      const pIdx = i % paths.length;
      agents.push({
        pathIdx: pIdx,
        dist: ((i * 0.41) % 1) * paths[pIdx].total,
        speed: 1.35 + (i % 4) * 0.18,
        phase: i * 0.9,
        jacket: jacketColors[i % jacketColors.length],
      });
    }
    return { paths, agents };
  }, [world.districtParks, world.curvedRoads]);

  const pedTorsoRef = useRef<THREE.InstancedMesh>(null);
  const pedHeadRef = useRef<THREE.InstancedMesh>(null);
  const pedLegLRef = useRef<THREE.InstancedMesh>(null);
  const pedLegRRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!pedTorsoRef.current) return;
    pedAgents.agents.forEach((p, i) => {
      _color.set(p.jacket);
      pedTorsoRef.current!.setColorAt(i, _color);
    });
    if (pedTorsoRef.current.instanceColor) pedTorsoRef.current.instanceColor.needsUpdate = true;
  }, [pedAgents]);

  // ---------------------------------------------------------------------------
  // 5. District Entrance Archways with CanvasTexture Nameplates
  // ---------------------------------------------------------------------------
  const archwayTextures = useMemo(() => {
    return DISTRICT_ARCHWAYS.map((a) => ({
      ...a,
      tex: createArchSignTexture(a.title, a.subtitle, a.accentColor),
    }));
  }, []);

  useEffect(() => {
    return () => {
      archwayTextures.forEach((a) => a.tex.dispose());
    };
  }, [archwayTextures]);

  // ---------------------------------------------------------------------------
  // 6. Evening/Night Chimney Smoke Puffs (Focused near camera/player)
  // ---------------------------------------------------------------------------
  const SMOKE_PUFF_COUNT = 64;
  const smokeMeshRef = useRef<THREE.InstancedMesh>(null);
  const activeChimneysRef = useRef<Array<{ x: number; y: number; z: number }>>([]);
  const lastSmokeQueryRef = useRef({ x: 9999, z: 9999, t: -10 });

  // ---------------------------------------------------------------------------
  // 7. Live Plot Customization Props (Driveway Lights, Planters, Fountain, Garland)
  // ---------------------------------------------------------------------------
  const upgradedPlots = useMemo(() => {
    const entries: Array<{ plot: ExpansionPlotSpec; cust: PlotCustomization }> = [];
    for (const [plotId, cust] of Object.entries(plotCustomizations)) {
      const plot = world.plotById.get(plotId);
      if (!plot || plot.status === 'vip') continue;
      if (
        cust.hasDrivewayLights ||
        cust.hasFlowerPlanters ||
        cust.hasGardenFountain ||
        cust.hasFestiveGarland
      ) {
        entries.push({ plot, cust });
      }
    }
    return entries;
  }, [plotCustomizations, world.plotById]);

  // ---------------------------------------------------------------------------
  // Animation Loop (Zero GC Allocations)
  // ---------------------------------------------------------------------------
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const nearbyObstacles: DynamicVehicleObstacle[] = [];
    const px = playerPoseRef.current.x;
    const pz = playerPoseRef.current.z;

    // A. Animate Curved-Road Cars
    if (carBodyRef.current && carCabinRef.current && carHeadlightRef.current) {
      for (let i = 0; i < carAgents.agents.length; i++) {
        const ag = carAgents.agents[i];
        const route = carAgents.routes[ag.routeIdx];
        ag.dist += ag.speed * dt;
        samplePathDistance(route, ag.dist, _pos, _dir);

        // Offset to right lane
        const rx = -_dir.z * ag.laneOffset;
        const rz = _dir.x * ag.laneOffset;
        const wx = _pos.x + rx;
        const wz = _pos.z + rz;
        const yaw = Math.atan2(_dir.x, _dir.z);

        _dummy.position.set(wx, ROAD_SURFACE_Y + 0.42, wz);
        _dummy.rotation.set(0, yaw, 0);
        _dummy.scale.set(1.56, 0.62, 3.35);
        _dummy.updateMatrix();
        carBodyRef.current.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(wx - _dir.x * 0.14, ROAD_SURFACE_Y + 0.92, wz - _dir.z * 0.14);
        _dummy.scale.set(1.28, 0.48, 1.65);
        _dummy.updateMatrix();
        carCabinRef.current.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(wx + _dir.x * 1.66, ROAD_SURFACE_Y + 0.42, wz + _dir.z * 1.66);
        _dummy.scale.set(1.16, 0.16, 0.12);
        _dummy.updateMatrix();
        carHeadlightRef.current.setMatrixAt(i, _dummy.matrix);

        if (Math.hypot(wx - px, wz - pz) < 48) {
          nearbyObstacles.push({
            id: ag.id,
            x: wx,
            z: wz,
            yaw,
            speed: ag.speed,
            style: ag.style,
            color: ag.color,
          });
        }
      }
      carBodyRef.current.instanceMatrix.needsUpdate = true;
      carCabinRef.current.instanceMatrix.needsUpdate = true;
      carHeadlightRef.current.instanceMatrix.needsUpdate = true;
    }

    // B. Animate District Shuttle Buses (with brief pauses at busStops)
    if (busBodyRef.current && busWindowRef.current && busRoofRef.current) {
      for (let i = 0; i < busLoop.buses.length; i++) {
        const bus = busLoop.buses[i];
        let speed = 11.5;
        if (bus.pauseTimer > 0) {
          bus.pauseTimer -= dt;
          speed = 0;
        } else {
          bus.dist = (bus.dist + speed * dt) % busLoop.path.total;
          for (let sIdx = 0; sIdx < busLoop.stopDistances.length; sIdx++) {
            if (
              sIdx !== bus.lastStopIdx &&
              Math.abs(bus.dist - busLoop.stopDistances[sIdx]) < 2.2
            ) {
              bus.pauseTimer = 2.2;
              bus.lastStopIdx = sIdx;
              speed = 0;
              break;
            }
          }
        }

        samplePathDistance(busLoop.path, bus.dist, _pos, _dir);
        const wx = _pos.x - _dir.z * 2.0;
        const wz = _pos.z + _dir.x * 2.0;
        const yaw = Math.atan2(_dir.x, _dir.z);

        _dummy.position.set(wx, ROAD_SURFACE_Y + 1.15, wz);
        _dummy.rotation.set(0, yaw, 0);
        _dummy.scale.set(2.35, 1.9, 6.8);
        _dummy.updateMatrix();
        busBodyRef.current.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(wx, ROAD_SURFACE_Y + 1.48, wz);
        _dummy.scale.set(2.4, 0.72, 6.2);
        _dummy.updateMatrix();
        busWindowRef.current.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(wx + _dir.x * 3.35, ROAD_SURFACE_Y + 1.98, wz + _dir.z * 3.35);
        _dummy.scale.set(1.6, 0.24, 0.16);
        _dummy.updateMatrix();
        busRoofRef.current.setMatrixAt(i, _dummy.matrix);

        if (Math.hypot(wx - px, wz - pz) < 55) {
          nearbyObstacles.push({
            id: bus.id,
            x: wx,
            z: wz,
            yaw,
            speed,
            style: 'shuttle bus',
            color: bus.color,
          });
        }
      }
      busBodyRef.current.instanceMatrix.needsUpdate = true;
      busWindowRef.current.instanceMatrix.needsUpdate = true;
      busRoofRef.current.instanceMatrix.needsUpdate = true;
    }

    // Merge nearby expansion vehicles cleanly alongside core TrafficManager vehicles
    const coreOnly = vehicleStatesRef.current.filter((v) => !v.id.startsWith('exp-'));
    vehicleStatesRef.current = [...coreOnly, ...nearbyObstacles];

    // C. Animate District Pedestrians & Park Visitors
    if (pedTorsoRef.current && pedHeadRef.current && pedLegLRef.current && pedLegRRef.current) {
      for (let i = 0; i < pedAgents.agents.length; i++) {
        const ped = pedAgents.agents[i];
        const path = pedAgents.paths[ped.pathIdx];
        ped.dist += ped.speed * dt;
        samplePathDistance(path, ped.dist, _pos, _dir);

        const yaw = Math.atan2(_dir.x, _dir.z);
        const stride = Math.sin(t * 6.2 + ped.phase);
        const bob = Math.abs(stride) * 0.04;
        const rx = _dir.z * 0.11;
        const rz = -_dir.x * 0.11;

        _dummy.position.set(_pos.x, SIDEWALK_HEIGHT + 0.96 + bob, _pos.z);
        _dummy.rotation.set(0, yaw, 0);
        _dummy.scale.set(0.42, 0.62, 0.26);
        _dummy.updateMatrix();
        pedTorsoRef.current.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(_pos.x, SIDEWALK_HEIGHT + 1.44 + bob, _pos.z);
        _dummy.scale.set(0.28, 0.28, 0.28);
        _dummy.updateMatrix();
        pedHeadRef.current.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(_pos.x + rx, SIDEWALK_HEIGHT + 0.34, _pos.z + rz);
        _dummy.rotation.set(stride * 0.36, yaw, 0);
        _dummy.scale.set(0.15, 0.64, 0.16);
        _dummy.updateMatrix();
        pedLegLRef.current.setMatrixAt(i, _dummy.matrix);

        _dummy.position.set(_pos.x - rx, SIDEWALK_HEIGHT + 0.34, _pos.z - rz);
        _dummy.rotation.set(-stride * 0.36, yaw, 0);
        _dummy.scale.set(0.15, 0.64, 0.16);
        _dummy.updateMatrix();
        pedLegRRef.current.setMatrixAt(i, _dummy.matrix);

        // Restore rotation reset on next iteration
        _dummy.rotation.set(0, 0, 0);
      }
      pedTorsoRef.current.instanceMatrix.needsUpdate = true;
      pedHeadRef.current.instanceMatrix.needsUpdate = true;
      pedLegLRef.current.instanceMatrix.needsUpdate = true;
      pedLegRRef.current.instanceMatrix.needsUpdate = true;
    }

    // D. Evening / Night Rising Chimney Smoke Particles around focused area
    if (smokeMeshRef.current) {
      if (!isEvening) {
        if (activeChimneysRef.current.length > 0) {
          activeChimneysRef.current = [];
          _dummy.position.set(0, -150, 0);
          _dummy.scale.set(0.001, 0.001, 0.001);
          _dummy.updateMatrix();
          for (let i = 0; i < SMOKE_PUFF_COUNT; i++) {
            smokeMeshRef.current.setMatrixAt(i, _dummy.matrix);
          }
          smokeMeshRef.current.instanceMatrix.needsUpdate = true;
        }
      } else {
        camera.getWorldDirection(_focus);
        const lookScale = Math.abs(_focus.y) > 0.15 ? camera.position.y / -_focus.y : 40;
        const clamped = THREE.MathUtils.clamp(lookScale, 8, 95);
        const fx = camera.position.x + _focus.x * clamped;
        const fz = camera.position.z + _focus.z * clamped;

        if (
          t - lastSmokeQueryRef.current.t > 1.2 &&
          Math.hypot(fx - lastSmokeQueryRef.current.x, fz - lastSmokeQueryRef.current.z) > 14
        ) {
          lastSmokeQueryRef.current = { x: fx, z: fz, t };
          const near = queryNearbyExpansionPlots(world.spatialIndex, fx, fz, 110)
            .filter((p) => p.status !== 'vip' && p.houseStyle?.hasChimney)
            .slice(0, 16);
          activeChimneysRef.current = near.map((p) => {
            const s = p.houseStyle!;
            const m = getExpansionHouseMetrics(p);
            const sin = Math.sin(p.facingAngle);
            const cos = Math.cos(p.facingAngle);
            const lx = m.houseLocalX + s.width * 0.25;
            const lz = m.houseLocalZ - s.depth * 0.2;
            return {
              x: p.x + lx * cos + lz * sin,
              y: SIDEWALK_HEIGHT + s.wallHeight + 2.45,
              z: p.z - lx * sin + lz * cos,
            };
          });
        }

        const chimneys = activeChimneysRef.current;
        for (let i = 0; i < SMOKE_PUFF_COUNT; i++) {
          const ch = chimneys[i % Math.max(1, chimneys.length)];
          if (!ch) {
            _dummy.position.set(0, -150, 0);
            _dummy.scale.set(0.001, 0.001, 0.001);
          } else {
            const puffSlot = Math.floor(i / Math.max(1, chimneys.length));
            const phase = ((t * 0.35 + puffSlot * 0.25 + (i % 7) * 0.09) % 1);
            const rise = phase * 5.2;
            const driftX = Math.sin(t * 0.8 + i) * 0.35 + phase * 1.1;
            const driftZ = Math.cos(t * 0.6 + i) * 0.28 + phase * 0.5;
            const sc = (0.35 + phase * 0.72) * (1 - Math.pow(phase, 2.2) * 0.85);
            _dummy.position.set(ch.x + driftX, ch.y + rise, ch.z + driftZ);
            _dummy.scale.set(sc, sc * 0.85, sc);
          }
          _dummy.updateMatrix();
          smokeMeshRef.current.setMatrixAt(i, _dummy.matrix);
        }
        smokeMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* Curved-Road Zebra Crosswalks near Roundabouts & District Parks */}
      {crosswalkBars.length > 0 && (
        <instancedMesh
          ref={crosswalkMeshRef}
          args={[undefined, undefined, crosswalkBars.length]}
          frustumCulled
        >
          <boxGeometry args={[1, 0.012, 1]} />
          <meshStandardMaterial
            color="#f8fafc"
            roughness={0.68}
            polygonOffset
            polygonOffsetFactor={-3}
          />
        </instancedMesh>
      )}

      {/* 3D District Entrance Archways & Neighborhood Welcome Signs */}
      {archwayTextures.map((arch) => {
        const halfSpan = arch.spanWidth * 0.5;
        return (
          <group
            key={arch.id}
            position={[arch.x, SIDEWALK_HEIGHT, arch.z]}
            rotation={[0, arch.rotY, 0]}
          >
            {/* Twin Stone & Timber Pillars outside curbs */}
            {[-halfSpan, halfSpan].map((px, idx) => (
              <group key={idx} position={[px, 0, 0]}>
                <mesh position={[0, 0.45, 0]} castShadow>
                  <boxGeometry args={[1.05, 0.9, 1.05]} />
                  <meshStandardMaterial color={arch.stoneColor} roughness={0.86} />
                </mesh>
                <mesh position={[0, 3.05, 0]} castShadow>
                  <boxGeometry args={[0.72, 4.3, 0.72]} />
                  <meshStandardMaterial color={arch.stoneColor} roughness={0.82} />
                </mesh>
                <mesh position={[0, 5.35, 0]}>
                  <boxGeometry args={[0.92, 0.34, 0.92]} />
                  <meshStandardMaterial color={arch.accentColor} roughness={0.5} />
                </mesh>
                {/* Warm Pillar Lantern */}
                <mesh position={[0, 5.75, 0]}>
                  <sphereGeometry args={[0.22, 8, 8]} />
                  <meshStandardMaterial
                    color="#fff3d1"
                    emissive="#ffae34"
                    emissiveIntensity={isEvening ? 2.2 : 0.15}
                  />
                </mesh>
              </group>
            ))}

            {/* Overhead Welcome Arch Beam & Dual-Faced Signboard */}
            <mesh position={[0, 5.2, 0]} castShadow>
              <boxGeometry args={[arch.spanWidth + 1.2, 0.55, 0.65]} />
              <meshStandardMaterial color="#273242" roughness={0.6} />
            </mesh>
            <mesh position={[0, 5.35, 0.36]}>
              <planeGeometry args={[7.4, 1.85]} />
              <meshBasicMaterial map={arch.tex} />
            </mesh>
            <mesh position={[0, 5.35, -0.36]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[7.4, 1.85]} />
              <meshBasicMaterial map={arch.tex} />
            </mesh>
          </group>
        );
      })}

      {/* Instanced Curved-Road & Roundabout AI Vehicles */}
      <instancedMesh
        ref={carBodyRef}
        args={[undefined, undefined, carAgents.agents.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.34} metalness={0.42} />
      </instancedMesh>
      <instancedMesh
        ref={carCabinRef}
        args={[undefined, undefined, carAgents.agents.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2c3748" roughness={0.18} metalness={0.35} />
      </instancedMesh>
      <instancedMesh
        ref={carHeadlightRef}
        args={[undefined, undefined, carAgents.agents.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#fff7db"
          emissive="#ffe29a"
          emissiveIntensity={isEvening ? 2.6 : 0.15}
        />
      </instancedMesh>

      {/* Instanced Community Shuttle Buses */}
      <instancedMesh
        ref={busBodyRef}
        args={[undefined, undefined, busLoop.buses.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.38} metalness={0.25} />
      </instancedMesh>
      <instancedMesh
        ref={busWindowRef}
        args={[undefined, undefined, busLoop.buses.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#1f3142" roughness={0.16} metalness={0.4} />
      </instancedMesh>
      <instancedMesh
        ref={busRoofRef}
        args={[undefined, undefined, busLoop.buses.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#fde68a"
          emissive="#f59e0b"
          emissiveIntensity={isEvening ? 2.1 : 0.45}
        />
      </instancedMesh>

      {/* Instanced District Pedestrians & Park Visitors */}
      <instancedMesh
        ref={pedTorsoRef}
        args={[undefined, undefined, pedAgents.agents.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </instancedMesh>
      <instancedMesh
        ref={pedHeadRef}
        args={[undefined, undefined, pedAgents.agents.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshStandardMaterial color="#e5bc9c" roughness={0.78} />
      </instancedMesh>
      <instancedMesh
        ref={pedLegLRef}
        args={[undefined, undefined, pedAgents.agents.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2b313b" roughness={0.85} />
      </instancedMesh>
      <instancedMesh
        ref={pedLegRRef}
        args={[undefined, undefined, pedAgents.agents.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2b313b" roughness={0.85} />
      </instancedMesh>

      {/* Evening / Night Chimney Smoke Puffs */}
      <instancedMesh
        ref={smokeMeshRef}
        args={[undefined, undefined, SMOKE_PUFF_COUNT]}
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial
          color="#cbd5e1"
          transparent
          opacity={0.38}
          roughness={1}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Live Plot Customization Upgrades Purchased with Town Currency */}
      {upgradedPlots.map(({ plot, cust }) => {
        const m = getExpansionHouseMetrics(plot);
        const s = plot.houseStyle;
        const halfD = plot.depth * 0.5;
        return (
          <group
            key={`upgrade-${plot.plotId}`}
            position={[plot.x, SIDEWALK_HEIGHT, plot.z]}
            rotation={[0, plot.facingAngle, 0]}
          >
            {cust.hasDrivewayLights &&
              [-1.15, 1.15].map((lx, idx) => (
                <group key={`lamp-${idx}`} position={[m.walkwayX + lx, 0, halfD - 0.85]}>
                  <mesh position={[0, 0.55, 0]}>
                    <cylinderGeometry args={[0.045, 0.06, 1.1, 6]} />
                    <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 1.15, 0]}>
                    <sphereGeometry args={[0.13, 8, 8]} />
                    <meshStandardMaterial
                      color="#fff3d1"
                      emissive="#ffae34"
                      emissiveIntensity={isEvening ? 2.6 : 0.35}
                    />
                  </mesh>
                </group>
              ))}

            {cust.hasFlowerPlanters &&
              [-1.4, 1.4].map((fx, idx) => (
                <group key={`planter-${idx}`} position={[m.houseLocalX + fx, 0, halfD - 2.3]}>
                  <mesh position={[0, 0.2, 0]}>
                    <boxGeometry args={[0.9, 0.4, 0.45]} />
                    <meshStandardMaterial color="#8c5a3c" roughness={0.85} />
                  </mesh>
                  <mesh position={[0, 0.44, 0]}>
                    <boxGeometry args={[0.82, 0.16, 0.36]} />
                    <meshStandardMaterial color={idx === 0 ? '#f472b6' : '#fbbf24'} roughness={0.75} />
                  </mesh>
                </group>
              ))}

            {cust.hasGardenFountain && (
              <group position={[m.houseLocalX - (s?.width ?? 6) * 0.28, 0, halfD - 2.4]}>
                <mesh position={[0, 0.14, 0]}>
                  <cylinderGeometry args={[0.82, 0.92, 0.28, 12]} />
                  <meshStandardMaterial color="#d6d0c4" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.52, 0]}>
                  <cylinderGeometry args={[0.18, 0.24, 0.6, 10]} />
                  <meshStandardMaterial color="#c4bdb1" roughness={0.78} />
                </mesh>
                <mesh position={[0, 0.82, 0]}>
                  <cylinderGeometry args={[0.45, 0.22, 0.14, 12]} />
                  <meshStandardMaterial color="#dfd9cd" roughness={0.76} />
                </mesh>
                <mesh position={[0, 0.26, 0]}>
                  <cylinderGeometry args={[0.72, 0.72, 0.06, 12]} />
                  <meshStandardMaterial color="#38bdf8" roughness={0.18} metalness={0.25} />
                </mesh>
              </group>
            )}

            {cust.hasFestiveGarland && s && (
              <group position={[m.houseLocalX, s.wallHeight + 0.08, m.houseLocalZ + s.depth * 0.5 + 0.12]}>
                {[-0.4, -0.2, 0, 0.2, 0.4].map((frac, idx) => (
                  <mesh key={`garland-${idx}`} position={[s.width * frac, 0, 0]}>
                    <sphereGeometry args={[0.09, 6, 6]} />
                    <meshStandardMaterial
                      color="#fde68a"
                      emissive="#fbbf24"
                      emissiveIntensity={isEvening ? 2.5 : 0.4}
                    />
                  </mesh>
                ))}
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
};
