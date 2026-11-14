import { TownPlot } from '../types';
import {
  PARKED_CARS,
  ROAD_SURFACE_Y,
  SIDEWALK_HEIGHT,
  STREET_LAMPS,
  TOWN_BENCHES,
} from '../world/MasterTownBlueprint';
import {
  ExpansionCityWorld,
  getExpansionHouseMetrics,
  queryNearbyExpansionPlots,
} from '../expansion/ExpansionMasterPlan';
import { CurvedRoadSplineSpec } from '../expansion/types';

interface CurvedRoadBBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const curvedRoadBBoxCache = new WeakMap<CurvedRoadSplineSpec[], CurvedRoadBBox[]>();

function getCurvedRoadBBoxes(curvedRoads: CurvedRoadSplineSpec[]): CurvedRoadBBox[] {
  let cached = curvedRoadBBoxCache.get(curvedRoads);
  if (cached) return cached;
  cached = curvedRoads.map((cr) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const pt of cr.sampledPoints) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.z < minZ) minZ = pt.z;
      if (pt.z > maxZ) maxZ = pt.z;
    }
    const pad = cr.width * 0.5 + cr.greenStripWidth + cr.sidewalkWidth + 1.0;
    return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
  });
  curvedRoadBBoxCache.set(curvedRoads, cached);
  return cached;
}

function distancePointToSegment2D(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq <= 1e-8) return Math.hypot(px - x1, pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

export interface DynamicVehicleObstacle {
  id: string;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  style: string;
  color: string;
}

interface Box2D {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  rotY: number;
}

interface Circle2D {
  cx: number;
  cz: number;
  r: number;
}

function pushOutOrientedBox(
  px: number,
  pz: number,
  pr: number,
  box: Box2D,
): { x: number; z: number } {
  const cos = Math.cos(-box.rotY);
  const sin = Math.sin(-box.rotY);
  const dx = px - box.cx;
  const dz = pz - box.cz;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;

  const clampedX = Math.max(-box.hx, Math.min(box.hx, lx));
  const clampedZ = Math.max(-box.hz, Math.min(box.hz, lz));

  const rx = lx - clampedX;
  const rz = lz - clampedZ;
  const distSq = rx * rx + rz * rz;

  if (distSq >= pr * pr) return { x: px, z: pz };

  let pushLx = 0;
  let pushLz = 0;

  if (distSq > 1e-6) {
    const dist = Math.sqrt(distSq);
    const pen = pr - dist;
    pushLx = (rx / dist) * pen;
    pushLz = (rz / dist) * pen;
  } else {
    // Center inside box: push out along nearest edge
    const penX = box.hx - Math.abs(lx) + pr;
    const penZ = box.hz - Math.abs(lz) + pr;
    if (penX < penZ) {
      pushLx = lx >= 0 ? penX : -penX;
    } else {
      pushLz = lz >= 0 ? penZ : -penZ;
    }
  }

  const wCos = Math.cos(box.rotY);
  const wSin = Math.sin(box.rotY);
  return {
    x: px + (pushLx * wCos - pushLz * wSin),
    z: pz + (pushLx * wSin + pushLz * wCos),
  };
}

function pushOutCircle(
  px: number,
  pz: number,
  pr: number,
  c: Circle2D,
): { x: number; z: number } {
  const dx = px - c.cx;
  const dz = pz - c.cz;
  const minD = pr + c.r;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minD * minD) return { x: px, z: pz };
  if (distSq < 1e-6) {
    return { x: c.cx, z: c.cz + minD };
  }
  const dist = Math.sqrt(distSq);
  const push = minD - dist;
  return {
    x: px + (dx / dist) * push,
    z: pz + (dz / dist) * push,
  };
}

function isOnBridge(
  x: number,
  z: number,
  expansionWorld: ExpansionCityWorld,
): { onBridge: boolean; elevation: number } {
  for (const b of expansionWorld.bridges) {
    const isNSRot = Math.abs(b.rotY) < 0.4;
    const hx = isNSRot ? b.length / 2 + 0.6 : b.width / 2 + 1.4;
    const hz = isNSRot ? b.width / 2 + 1.4 : b.length / 2 + 0.6;
    if (Math.abs(x - b.x) <= hx && Math.abs(z - b.z) <= hz) {
      return {
        onBridge: true,
        elevation: b.kind === 'pedestrian' ? SIDEWALK_HEIGHT + 0.85 : ROAD_SURFACE_Y + 0.24,
      };
    }
  }
  return { onBridge: false, elevation: 0 };
}



/**
 * Returns exact walking ground elevation (roads, sidewalks, square/park, footbridges,
 * botanical gardens, waterfront boardwalk/piers/island, Venice canal bridges, outer grass).
 */
export function getSurfaceElevationAt(
  x: number,
  z: number,
  expansionWorld?: ExpansionCityWorld | null,
): number {
  // Arched wooden footbridge spanning the core park lake
  if (x >= 56.9 && x <= 59.1 && z >= -13.6 && z <= -3.4) {
    return SIDEWALK_HEIGHT + 0.42;
  }

  // Core asphalt road corridors (X = ±26 / ±78 / ±130, Z = ±26 / ±78 / +128)
  const inCore = x >= -276 && x <= 142 && z >= -118 && z <= 140;
  if (inCore) {
    const onMainRoad =
      Math.abs(x - 26) < 5.25 ||
      Math.abs(x + 26) < 5.25 ||
      Math.abs(z - 26) < 5.25 ||
      Math.abs(z + 26) < 5.25;
    const onSideRoad =
      Math.abs(x - 78) < 4.5 ||
      Math.abs(x + 78) < 4.5 ||
      Math.abs(x - 130) < 4.5 ||
      Math.abs(x + 130) < 4.5 ||
      Math.abs(x + 182) < 4.5 ||
      Math.abs(x + 234) < 4.5 ||
      Math.abs(z - 78) < 4.5 ||
      Math.abs(z + 78) < 4.5 ||
      Math.abs(z - 128) < 4.5;

    if (onMainRoad || onSideRoad) {
      if (Math.hypot(x + 26, z) < 3.6 || Math.hypot(x - 26, z) < 3.6) {
        return SIDEWALK_HEIGHT + 0.08;
      }
      return ROAD_SURFACE_Y;
    }

    if (x >= -272 && x <= 125 && z >= -106 && z <= 123.5) {
      return SIDEWALK_HEIGHT;
    }
  }

  if (expansionWorld) {
    // Venice Canal Bridges (35 road & pedestrian spans)
    const bridgeHit = isOnBridge(x, z, expansionWorld);
    if (bridgeHit.onBridge) {
      return bridgeHit.elevation;
    }

    // Grand Lake Central Garden Island + Dual Footbridges (World X = 468, Z = 0)
    if (x >= 446 && x <= 490 && z >= -29 && z <= 29) {
      return SIDEWALK_HEIGHT + 0.42;
    }
    if (x >= 366 && x <= 542 && Math.abs(z) <= 2.8) {
      return SIDEWALK_HEIGHT + 0.48;
    }

    // Waterfront boardwalk & scenic piers extending into Grand Lindenhof Lake
    if (x >= 353 && x <= 367 && z >= -124 && z <= 124) {
      return SIDEWALK_HEIGHT + 0.36;
    }
    if (
      x >= 366 &&
      x <= 394 &&
      ((z >= -46.7 && z <= -41.3) || (z >= 41.3 && z <= 46.7))
    ) {
      return SIDEWALK_HEIGHT + 0.42;
    }

    // Curved Panoramic Ring Boulevard + Scenic Curvy Parkways
    const ellipR = Math.hypot(x / 1175, z / 890);
    if (Math.abs(ellipR - 1) <= 0.011) {
      return ROAD_SURFACE_Y;
    }
    for (const r of expansionWorld.curvyRoadSegments) {
      const dx = r.x2 - r.x1;
      const dz = r.z2 - r.z1;
      const lenSq = dx * dx + dz * dz;
      if (lenSq <= 0) continue;
      const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (z - r.z1) * dz) / lenSq));
      const d = Math.hypot(x - (r.x1 + t * dx), z - (r.z1 + t * dz));
      if (d <= r.width / 2 + 0.45) {
        return ROAD_SURFACE_Y;
      }
    }

    // Named Primary Boulevards & OG Avenues
    const onBoulevard =
      (Math.abs(z + 130) < 5.75 && x >= -835 && x <= 885) ||
      (Math.abs(z - 130) < 5.75 && x >= -835 && x <= 885) ||
      (Math.abs(z + 330) < 5.6 && x >= -835 && x <= 885) ||
      (Math.abs(z - 176) < 5.6 && x >= -835 && x <= 885) ||
      (Math.abs(x + 140) < 5.5 && z >= -635 && z <= 675) ||
      (Math.abs(x - 145) < 5.5 && z >= -335 && z <= 675) ||
      (Math.abs(x - 326) < 5.5 && z >= -635 && z <= 675) ||
      (Math.abs(x - 564) < 5.5 && z >= -635 && z <= 675) ||
      (Math.abs(x + 292) < 5.25 && z >= -635 && z <= 675) ||
      (Math.abs(x + 36) < 4.9 && z >= -332 && z <= -130) ||
      (Math.abs(x - 36) < 4.9 && z >= -332 && z <= -130) ||
      (Math.abs(z + 248) < 4.6 &&
        ((x >= -248 && x <= -36) || (x >= 36 && x <= 248))) ||
      (Math.abs(x + 246) < 4.75 && z >= -332 && z <= -130) ||
      (Math.abs(x - 246) < 4.75 && z >= -332 && z <= -130);

    if (onBoulevard) {
      return ROAD_SURFACE_Y;
    }

    // Royal Helipad Raised Pad at (0, -303)
    if (Math.hypot(x, z + 303) <= 10.8) {
      return SIDEWALK_HEIGHT + 0.22;
    }

    // Grand Central Park + Waterfront Pads + OG District + Royal Crescent Garden
    if (
      (x >= 148 && x <= 326 && z >= -130 && z <= 130) ||
      (x >= 326 && x <= 568 && z >= -136 && z <= 136) ||
      (x >= -248 && x <= 248 && z >= -330 && z <= -130)
    ) {
      return SIDEWALK_HEIGHT;
    }

    // 7 Unique District Parks
    for (const pk of expansionWorld.districtParks) {
      if (Math.abs(x - pk.x) <= pk.width / 2 && Math.abs(z - pk.z) <= pk.depth / 2) {
        return SIDEWALK_HEIGHT + 0.02;
      }
    }

    // Neighborhood Roundabouts (green island, asphalt ring, outer sidewalk)
    for (const rb of expansionWorld.roundabouts) {
      const dist = Math.hypot(x - rb.x, z - rb.z);
      if (dist <= rb.innerRadius + 0.05) {
        return SIDEWALK_HEIGHT + 0.03;
      }
      if (dist <= rb.innerRadius + rb.roadWidth) {
        return ROAD_SURFACE_Y;
      }
      if (dist <= rb.innerRadius + rb.roadWidth + rb.sidewalkWidth) {
        return SIDEWALK_HEIGHT - 0.015;
      }
    }

    // Curved District Streets, Green Strips, and Raised Sidewalks
    const crBBoxes = getCurvedRoadBBoxes(expansionWorld.curvedRoads);
    for (let rIdx = 0; rIdx < expansionWorld.curvedRoads.length; rIdx++) {
      const bb = crBBoxes[rIdx];
      if (x < bb.minX || x > bb.maxX || z < bb.minZ || z > bb.maxZ) continue;
      const cr = expansionWorld.curvedRoads[rIdx];
      const pts = cr.sampledPoints;
      const halfW = cr.width * 0.5;
      const greenOuter = halfW + cr.greenStripWidth;
      const swOuter = greenOuter + cr.sidewalkWidth;
      let minDist = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        if (
          x < Math.min(p0.x, p1.x) - swOuter ||
          x > Math.max(p0.x, p1.x) + swOuter ||
          z < Math.min(p0.z, p1.z) - swOuter ||
          z > Math.max(p0.z, p1.z) + swOuter
        ) {
          continue;
        }
        const d = distancePointToSegment2D(x, z, p0.x, p0.z, p1.x, p1.z);
        if (d < minDist) minDist = d;
      }
      if (minDist <= halfW) {
        return ROAD_SURFACE_Y;
      }
      if (minDist <= greenOuter) {
        return SIDEWALK_HEIGHT - 0.026;
      }
      if (minDist <= swOuter) {
        return SIDEWALK_HEIGHT - 0.015;
      }
    }

    // Straight collector & boulevard road segments
    for (const r of expansionWorld.roads) {
      const halfW = r.width * 0.5;
      if (
        x < Math.min(r.x1, r.x2) - halfW ||
        x > Math.max(r.x1, r.x2) + halfW ||
        z < Math.min(r.z1, r.z2) - halfW ||
        z > Math.max(r.z1, r.z2) + halfW
      ) {
        continue;
      }
      if (distancePointToSegment2D(x, z, r.x1, r.z1, r.x2, r.z2) <= halfW) {
        return ROAD_SURFACE_Y;
      }
    }

    // Nearby residential/OG plot pads
    const nearbyPads = queryNearbyExpansionPlots(expansionWorld.spatialIndex, x, z, 20);
    for (const ep of nearbyPads) {
      const sin = Math.sin(ep.facingAngle);
      const cos = Math.cos(ep.facingAngle);
      const dx = x - ep.x;
      const dz = z - ep.z;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= ep.width * 0.5 && Math.abs(lz) <= ep.depth * 0.5) {
        return SIDEWALK_HEIGHT;
      }
    }
  }

  return 0;
}

/**
 * Resolves 2D walking collisions against buildings, hedges, fences, benches, fountains,
 * lake edges, streetlamps, parked cars, live traffic vehicles, and expanded city plots/landmarks.
 */
export function resolvePlayerMovement(
  targetX: number,
  targetZ: number,
  plots: TownPlot[],
  dynamicVehicles: DynamicVehicleObstacle[],
  playerRadius = 0.36,
  expansionWorld?: ExpansionCityWorld | null,
): { x: number; z: number } {
  const minX = expansionWorld ? -1240 : -124;
  const maxX = expansionWorld ? 1240 : 124;
  const minZ = expansionWorld ? -920 : -124;
  const maxZ = expansionWorld ? 920 : 124;
  let x = Math.max(minX, Math.min(maxX, targetX));
  let z = Math.max(minZ, Math.min(maxZ, targetZ));

  // Run 2 solver iterations for clean corner sliding
  for (let iter = 0; iter < 2; iter++) {
    // 1. Plots (houses, shops, public buildings, boundary hedges & rear fences)
    for (const plot of plots) {
      const dx = x - plot.center.x;
      const dz = z - plot.center.z;
      const maxSpan = Math.max(plot.width, plot.depth) + 4;
      if (Math.abs(dx) > maxSpan || Math.abs(dz) > maxSpan) continue;

      const sin = Math.sin(plot.facingAngle);
      const cos = Math.cos(plot.facingAngle);
      const toWorld = (lx: number, lz: number) => ({
        cx: plot.center.x + lx * cos + lz * sin,
        cz: plot.center.z - lx * sin + lz * cos,
      });

      const halfW = plot.width / 2;
      const halfD = plot.depth / 2;

      if (plot.house) {
        const hxLocal = plot.house.hasGarageCarport ? -0.8 : -0.4;
        const hzLocal = -1.2;
        const wc = toWorld(hxLocal, hzLocal);
        const res = pushOutOrientedBox(x, z, playerRadius, {
          cx: wc.cx,
          cz: wc.cz,
          hx: plot.house.width / 2 + 0.15,
          hz: plot.house.depth / 2 + 0.15,
          rotY: -plot.facingAngle,
        });
        x = res.x;
        z = res.z;
      } else if (plot.business) {
        const wc = toWorld(0, -0.6);
        const res = pushOutOrientedBox(x, z, playerRadius, {
          cx: wc.cx,
          cz: wc.cz,
          hx: plot.business.width / 2 + 0.15,
          hz: plot.business.depth / 2 + 0.15,
          rotY: -plot.facingAngle,
        });
        x = res.x;
        z = res.z;
      } else if (plot.publicBuilding) {
        const b = plot.publicBuilding;
        if (b.category === 'stadium') {
          // Allow walking around exterior while blocking stands & pitch barriers
          for (const sz of [-10.8, 10.8]) {
            const wc = toWorld(0, sz);
            const res = pushOutOrientedBox(x, z, playerRadius, {
              cx: wc.cx,
              cz: wc.cz,
              hx: 11.8,
              hz: 1.8,
              rotY: -plot.facingAngle,
            });
            x = res.x;
            z = res.z;
          }
        } else {
          const res = pushOutOrientedBox(x, z, playerRadius, {
            cx: plot.center.x,
            cz: plot.center.z,
            hx: b.width / 2 + 0.25,
            hz: b.depth / 2 + 0.25,
            rotY: -plot.facingAngle,
          });
          x = res.x;
          z = res.z;
        }
      }

      // Residential & Luxury Individual Perimeter Fences & Parked Driveway Cars
      if (
        plot.category === 'residential' ||
        plot.category === 'luxury-residential' ||
        plot.category === 'expansion-residential'
      ) {
        const inset = 0.28;
        const fw = halfW - inset;
        const fd = halfD - inset;
        const houseLocalX = plot.house ? (plot.house.hasGarageCarport ? -0.8 : -0.4) : 0;
        const pathX = plot.house ? houseLocalX : 0;
        const drivewayX = plot.house?.hasGarageCarport
          ? Math.min(halfW - 2.15, houseLocalX + plot.house.width / 2 + 1.45)
          : halfW - 2.65;

        if (plot.house) {
          const carZ = Math.min(halfD - 2.45, Math.max(-1.2 + plot.house.depth / 2 + 2.35, halfD - 3.9));
          const carWorld = toWorld(drivewayX, carZ);
          const carRes = pushOutOrientedBox(x, z, playerRadius, {
            cx: carWorld.cx,
            cz: carWorld.cz,
            hx: 0.92,
            hz: 1.98,
            rotY: -plot.facingAngle,
          });
          x = carRes.x;
          z = carRes.z;
        }

        const fenceBox = (cxLocal: number, czLocal: number, hx: number, hz: number) => {
          const w = toWorld(cxLocal, czLocal);
          const pushed = pushOutOrientedBox(x, z, playerRadius, {
            cx: w.cx,
            cz: w.cz,
            hx,
            hz,
            rotY: -plot.facingAngle,
          });
          x = pushed.x;
          z = pushed.z;
        };

        // Left, Right & Rear boundaries
        fenceBox(-fw, 0, 0.14, fd);
        fenceBox(fw, 0, 0.14, fd);
        fenceBox(0, -fd, fw, 0.14);

        // Front boundary segments split cleanly around Pedestrian Gate [pathX ± 1.35] & Driveway [drivewayX ± 1.75]
        const openings = [
          { start: pathX - 1.35, end: pathX + 1.35 },
          { start: drivewayX - 1.75, end: drivewayX + 1.75 },
        ].sort((a, b) => a.start - b.start);

        let cursor = -fw;
        for (const op of openings) {
          const segEnd = Math.min(fw, op.start);
          if (segEnd - cursor > 0.2) {
            fenceBox((cursor + segEnd) / 2, fd, (segEnd - cursor) / 2, 0.14);
          }
          cursor = Math.max(cursor, op.end);
        }
        if (fw - cursor > 0.2) {
          fenceBox((cursor + fw) / 2, fd, (fw - cursor) / 2, 0.14);
        }
      }
    }

    // 2. All 15 Benches
    for (const bench of TOWN_BENCHES) {
      if (Math.abs(x - bench.x) > 3 || Math.abs(z - bench.z) > 3) continue;
      const res = pushOutOrientedBox(x, z, playerRadius, {
        cx: bench.x,
        cz: bench.z,
        hx: 0.88,
        hz: 0.34,
        rotY: -bench.rotationY,
      });
      x = res.x;
      z = res.z;
    }

    // 3. Fountains & Roundabout Islands
    const circles: Circle2D[] = [
      { cx: 0, cz: 8.8, r: 3.3 },
      { cx: 42.2, cz: -1.0, r: 3.15 },
      { cx: -26, cz: 0, r: 3.1 },
      { cx: 26, cz: 0, r: 3.1 },
    ];
    for (const c of circles) {
      if (Math.abs(x - c.cx) > 6 || Math.abs(z - c.cz) > 6) continue;
      const res = pushOutCircle(x, z, playerRadius, c);
      x = res.x;
      z = res.z;
    }

    // 3b. District 3 Central Park Playgrounds A & B + Shaded Picnic Tables
    if (x >= 34 && x <= 71 && z >= 0 && z <= 18) {
      const parkObstacles: Box2D[] = [
        // Playground A (41.5, 10.6, scale 0.94): Play Tower & Swing Frame
        { cx: 42.72, cz: 9.85, hx: 1.0, hz: 1.0, rotY: 0 },
        { cx: 39.24, cz: 10.79, hx: 1.35, hz: 0.72, rotY: 0 },
        // Playground B (60.5, 11.4, scale 0.92): Slide Platform, Swings & Playhouse
        { cx: 58.48, cz: 9.93, hx: 1.3, hz: 1.05, rotY: 0 },
        { cx: 63.08, cz: 9.74, hx: 1.3, hz: 0.72, rotY: 0 },
        { cx: 57.83, cz: 13.33, hx: 0.95, hz: 0.85, rotY: 0 },
        // Shaded Picnic Sets
        { cx: 59.2, cz: 2.6, hx: 0.98, hz: 0.88, rotY: 0 },
        { cx: 63.8, cz: 2.6, hx: 0.98, hz: 0.88, rotY: -Math.PI / 6 },
      ];
      for (const box of parkObstacles) {
        if (Math.abs(x - box.cx) > 4 || Math.abs(z - box.cz) > 4) continue;
        const res = pushOutOrientedBox(x, z, playerRadius, box);
        x = res.x;
        z = res.z;
      }
      // Playground B Climbing Dome
      if (Math.abs(x - 60.59) < 3 && Math.abs(z - 13.24) < 3) {
        const res = pushOutCircle(x, z, playerRadius, { cx: 60.59, cz: 13.24, r: 1.12 });
        x = res.x;
        z = res.z;
      }
    }

    // 4. Park Lake Basin (keep footbridge corridor X in [56.9, 59.1] walkable!)
    if (x >= 49.5 && x <= 66.5 && z >= -14.2 && z <= -2.8) {
      const onBridge = x >= 57.1 && x <= 58.9;
      if (!onBridge) {
        // Left lake half [50.1, 56.9], Right lake half [59.1, 65.9]
        if (x < 58.0) {
          const res = pushOutOrientedBox(x, z, playerRadius, {
            cx: 53.5,
            cz: -8.5,
            hx: 3.4,
            hz: 5.2,
            rotY: 0,
          });
          x = res.x;
          z = res.z;
        } else {
          const res = pushOutOrientedBox(x, z, playerRadius, {
            cx: 62.5,
            cz: -8.5,
            hx: 3.4,
            hz: 5.2,
            rotY: 0,
          });
          x = res.x;
          z = res.z;
        }
      }
    }

    // 5. Commercial Promenade Planters
    for (const pz of [40.5, 52.4, 64.2]) {
      if (Math.abs(x) < 3 && Math.abs(z - pz) < 3) {
        const res = pushOutOrientedBox(x, z, playerRadius, {
          cx: 0,
          cz: pz,
          hx: 0.85,
          hz: 0.85,
          rotY: 0,
        });
        x = res.x;
        z = res.z;
      }
    }

    // 6. Streetlamps
    for (const lamp of STREET_LAMPS) {
      if (Math.abs(x - lamp.x) > 1.5 || Math.abs(z - lamp.z) > 1.5) continue;
      const res = pushOutCircle(x, z, playerRadius, { cx: lamp.x, cz: lamp.z, r: 0.22 });
      x = res.x;
      z = res.z;
    }

    // 7. Parked Cars
    for (const car of PARKED_CARS) {
      if (Math.abs(x - car.x) > 4 || Math.abs(z - car.z) > 4) continue;
      const res = pushOutOrientedBox(x, z, playerRadius, {
        cx: car.x,
        cz: car.z,
        hx: 0.95,
        hz: 2.15,
        rotY: -car.rotY,
      });
      x = res.x;
      z = res.z;
    }

    // 8. Live Traffic Vehicles
    for (const veh of dynamicVehicles) {
      if (Math.abs(x - veh.x) > 4 || Math.abs(z - veh.z) > 4) continue;
      const res = pushOutOrientedBox(x, z, playerRadius, {
        cx: veh.x,
        cz: veh.z,
        hx: 0.95,
        hz: 2.15,
        rotY: -veh.yaw,
      });
      x = res.x;
      z = res.z;
    }

    // 9. Expanded Follower City (O(1) Spatial Hash + Special Landmarks)
    if (expansionWorld) {
      // OG 50 Monument Recognition Wall at (0, -158)
      const mon = expansionWorld.monumentPosition;
      if (Math.abs(x - mon.x) < 17 && Math.abs(z - mon.z) < 6) {
        const res = pushOutOrientedBox(x, z, playerRadius, {
          cx: mon.x,
          cz: mon.z,
          hx: 13.8,
          hz: 1.5,
          rotY: 0,
        });
        x = res.x;
        z = res.z;
      }

      // Botanical Conservatory Glass Dome & Side Wings at (236, 0)
      if (x >= 198 && x <= 274 && Math.abs(z) <= 26) {
        let res = pushOutCircle(x, z, playerRadius, { cx: 236, cz: 0, r: 20.6 });
        res = pushOutOrientedBox(res.x, res.z, playerRadius, {
          cx: 213,
          cz: 0,
          hx: 7.2,
          hz: 5.2,
          rotY: 0,
        });
        res = pushOutOrientedBox(res.x, res.z, playerRadius, {
          cx: 259,
          cz: 0,
          hx: 7.2,
          hz: 5.2,
          rotY: 0,
        });
        x = res.x;
        z = res.z;
      }

      // Grand Central Park Fountain Plaza, Playgrounds A & B, Picnic Groves & Parterres
      if (x >= 152 && x <= 320 && Math.abs(z) <= 122) {
        if (Math.abs(x - 236) < 7 && Math.abs(z - 34) < 7) {
          const res = pushOutCircle(x, z, playerRadius, { cx: 236, cz: 34, r: 4.35 });
          x = res.x;
          z = res.z;
        }
        const grandParkBoxes: Box2D[] = [
          // Playground Alpha at (192, 24, scale 1.32)
          { cx: 193.72, cz: 22.94, hx: 1.4, hz: 1.4, rotY: 0 },
          { cx: 188.83, cz: 24.26, hx: 1.8, hz: 0.95, rotY: 0 },
          // Playground Beta at (280, 24, scale 1.32)
          { cx: 277.1, cz: 21.89, hx: 1.8, hz: 1.5, rotY: 0 },
          { cx: 283.7, cz: 21.62, hx: 1.8, hz: 0.95, rotY: 0 },
          { cx: 276.17, cz: 26.77, hx: 1.25, hz: 1.1, rotY: 0 },
          // Picnic Groves at (192, -24) and (280, -24)
          { cx: 189, cz: -24, hx: 1.0, hz: 0.88, rotY: 0 },
          { cx: 195, cz: -24, hx: 1.0, hz: 0.88, rotY: -Math.PI / 8 },
          { cx: 277, cz: -24, hx: 1.0, hz: 0.88, rotY: 0 },
          { cx: 283, cz: -24, hx: 1.0, hz: 0.88, rotY: -Math.PI / 8 },
        ];
        for (const box of grandParkBoxes) {
          if (Math.abs(x - box.cx) > 5 || Math.abs(z - box.cz) > 5) continue;
          const res = pushOutOrientedBox(x, z, playerRadius, box);
          x = res.x;
          z = res.z;
        }
        if (Math.abs(x - 280.13) < 4 && Math.abs(z - 26.64) < 4) {
          const res = pushOutCircle(x, z, playerRadius, { cx: 280.13, cz: 26.64, r: 1.55 });
          x = res.x;
          z = res.z;
        }
      }

      // Venice Canal Waterways (keep all 35 bridges completely walkable!)
      if (!isOnBridge(x, z, expansionWorld).onBridge) {
        for (const c of expansionWorld.canals) {
          const cx = (c.x1 + c.x2) / 2;
          const cz = (c.z1 + c.z2) / 2;
          const isNS = Math.abs(c.z2 - c.z1) > Math.abs(c.x2 - c.x1);
          const halfLen = Math.hypot(c.x2 - c.x1, c.z2 - c.z1) / 2;
          const res = pushOutOrientedBox(x, z, playerRadius, {
            cx,
            cz,
            hx: isNS ? c.width / 2 - 0.3 : halfLen,
            hz: isNS ? halfLen : c.width / 2 - 0.3,
            rotY: 0,
          });
          x = res.x;
          z = res.z;
        }
      }

      // Royal Crescent Garden Fountain at (0, -264) & VIP Helicopter on Helipad at (0, -303)
      if (Math.abs(x) < 6 && Math.abs(z + 264) < 6) {
        const res = pushOutCircle(x, z, playerRadius, { cx: 0, cz: -264, r: 3.3 });
        x = res.x;
        z = res.z;
      }
      if (Math.abs(x) < 7 && Math.abs(z + 303) < 8) {
        const res = pushOutOrientedBox(x, z, playerRadius, {
          cx: 0,
          cz: -303,
          hx: 1.5,
          hz: 3.2,
          rotY: -0.35,
        });
        x = res.x;
        z = res.z;
      }

      // Grand Waterfront Lake Water Basin (X in [367..541], Z in [-120..120])
      // Keeps Western Harbor Boardwalk, Twin Piers (Z=±44), Central Island (446..490, -29..29)
      // and Island Footbridge (|Z| <= 2.8) completely walkable!
      if (x >= 365 && x <= 543 && z >= -122 && z <= 122) {
        const onPier =
          x >= 366 &&
          x <= 394.4 &&
          ((z >= -46.6 && z <= -41.4) || (z >= 41.4 && z <= 46.6));
        const onIslandBridge = x >= 366 && x <= 542 && Math.abs(z) <= 2.8;
        const onCentralIsland = x >= 445.5 && x <= 490.5 && Math.abs(z) <= 29.5;

        if (onCentralIsland) {
          const res = pushOutCircle(x, z, playerRadius, { cx: 468, cz: 0, r: 3.3 });
          x = res.x;
          z = res.z;
        } else if (!onPier && !onIslandBridge) {
          // North/South outer bands & eastern/western water around island
          if (Math.abs(z) > 30) {
            const signZ = z >= 0 ? 1 : -1;
            const res = pushOutOrientedBox(x, z, playerRadius, {
              cx: 454,
              cz: signZ * 75,
              hx: 87,
              hz: 44.5,
              rotY: 0,
            });
            x = res.x;
            z = res.z;
          } else if (x < 445.5 && x > 367) {
            const signZ = z >= 0 ? 1 : -1;
            const res = pushOutOrientedBox(x, z, playerRadius, {
              cx: 406,
              cz: signZ * 16.4,
              hx: 39,
              hz: 13.4,
              rotY: 0,
            });
            x = res.x;
            z = res.z;
          } else if (x > 490.5) {
            const signZ = z >= 0 ? 1 : -1;
            const res = pushOutOrientedBox(x, z, playerRadius, {
              cx: 516,
              cz: signZ * 16.4,
              hx: 25,
              hz: 13.4,
              rotY: 0,
            });
            x = res.x;
            z = res.z;
          }
        }
      }

      // Roundabout Central Islands & Fountains
      for (const rb of expansionWorld.roundabouts) {
        if (Math.abs(x - rb.x) < rb.innerRadius + 2 && Math.abs(z - rb.z) < rb.innerRadius + 2) {
          const islandR = rb.hasFountain ? 2.6 : 1.4;
          const res = pushOutCircle(x, z, playerRadius, { cx: rb.x, cz: rb.z, r: islandR });
          x = res.x;
          z = res.z;
        }
      }

      // Expansion Plots within 36m
      const nearbyExp = queryNearbyExpansionPlots(expansionWorld.spatialIndex, x, z, 36);
      for (const ep of nearbyExp) {
        if (ep.status === 'vip') {
          // Sweet_thedevil Royal Estate at (0, -214): Chateau + Twin Pavilions + Fountain + Marquee
          let res = pushOutOrientedBox(x, z, playerRadius, {
            cx: ep.x,
            cz: ep.z - 3.5,
            hx: 9.8,
            hz: 6.2,
            rotY: 0,
          });
          res = pushOutOrientedBox(res.x, res.z, playerRadius, {
            cx: ep.x - 14.2,
            cz: ep.z - 3.2,
            hx: 4.4,
            hz: 5.0,
            rotY: 0,
          });
          res = pushOutOrientedBox(res.x, res.z, playerRadius, {
            cx: ep.x + 14.2,
            cz: ep.z - 3.2,
            hx: 4.4,
            hz: 5.0,
            rotY: 0,
          });
          res = pushOutCircle(res.x, res.z, playerRadius, {
            cx: ep.x,
            cz: ep.z + 11.8,
            r: 3.5,
          });
          res = pushOutOrientedBox(res.x, res.z, playerRadius, {
            cx: ep.x,
            cz: ep.z + 17.5,
            hx: 3.6,
            hz: 0.4,
            rotY: 0,
          });
          // Royal Estate Perimeter Fence (9.2m front ceremonial gate remains open)
          for (const [fx, fz, hx, hz] of [
            [-23.72, 0, 0.15, 19.72],
            [23.72, 0, 0.15, 19.72],
            [0, -19.72, 23.72, 0.15],
            [-14.16, 19.72, 9.56, 0.15],
            [14.16, 19.72, 9.56, 0.15],
          ]) {
            res = pushOutOrientedBox(res.x, res.z, playerRadius, {
              cx: ep.x + fx,
              cz: ep.z + fz,
              hx,
              hz,
              rotY: 0,
            });
          }
          x = res.x;
          z = res.z;
        } else if (ep.houseStyle) {
          const sin = Math.sin(ep.facingAngle);
          const cos = Math.cos(ep.facingAngle);
          const toWorld = (lx: number, lz: number) => ({
            cx: ep.x + lx * cos + lz * sin,
            cz: ep.z - lx * sin + lz * cos,
          });
          const m = getExpansionHouseMetrics(ep);

          // Main House Body
          const hPos = toWorld(m.houseLocalX, m.houseLocalZ);
          let res = pushOutOrientedBox(x, z, playerRadius, {
            cx: hPos.cx,
            cz: hPos.cz,
            hx: ep.houseStyle.width / 2 + 0.18,
            hz: ep.houseStyle.depth / 2 + 0.18,
            rotY: -ep.facingAngle,
          });

          // Attached Garage Wing
          if (m.hasGarage) {
            const gPos = toWorld(m.drivewayX, m.houseLocalZ - 0.15);
            res = pushOutOrientedBox(res.x, res.z, playerRadius, {
              cx: gPos.cx,
              cz: gPos.cz,
              hx: 1.4,
              hz: 2.18,
              rotY: -ep.facingAngle,
            });
          }

          // Parked Driveway Vehicle
          if (ep.hasParkedCar) {
            const cPos = toWorld(m.drivewayX, ep.depth / 2 - 2.35);
            res = pushOutOrientedBox(res.x, res.z, playerRadius, {
              cx: cPos.cx,
              cz: cPos.cz,
              hx: 0.85,
              hz: 1.72,
              rotY: -ep.facingAngle,
            });
          }

          // Perimeter Fence Segments (keeping BOTH walkway gate and driveway opening walkable!)
          const inset = m.isOg ? 0.34 : 0.2;
          const fw = ep.width / 2 - inset;
          const fd = ep.depth / 2 - inset;
          const gateHalf = m.isOg ? 1.85 : 1.1;
          const pillarOffset = 0.12;
          const openings: Array<{ start: number; end: number }> = [
            { start: m.walkwayX - gateHalf, end: m.walkwayX + gateHalf },
          ];
          if (m.hasGarage) {
            const dHalf = m.isOg ? 1.7 : 1.4;
            const dStart = m.drivewayX - dHalf;
            const dEnd = m.drivewayX + dHalf;
            if (dStart > openings[0].end + 0.2) {
              openings.push({ start: dStart, end: dEnd });
            } else {
              openings[0].end = Math.max(openings[0].end, dEnd);
            }
          }
          openings.sort((a, b) => a.start - b.start);

          const fenceBoxes: Array<[number, number, number, number]> = [
            [-fw, 0, 0.13, fd],
            [fw, 0, 0.13, fd],
            [0, -fd, fw, 0.13],
          ];
          let cursorX = -fw;
          for (const op of openings) {
            const segEnd = Math.min(fw, op.start - pillarOffset);
            if (segEnd - cursorX > 0.25) {
              fenceBoxes.push([(cursorX + segEnd) / 2, fd, (segEnd - cursorX) / 2, 0.13]);
            }
            cursorX = Math.max(cursorX, op.end + pillarOffset);
          }
          if (fw - cursorX > 0.25) {
            fenceBoxes.push([(cursorX + fw) / 2, fd, (fw - cursorX) / 2, 0.13]);
          }

          for (const [lx, lz, hx, hz] of fenceBoxes) {
            const w = toWorld(lx, lz);
            res = pushOutOrientedBox(res.x, res.z, playerRadius, {
              cx: w.cx,
              cz: w.cz,
              hx,
              hz,
              rotY: -ep.facingAngle,
            });
          }

          x = res.x;
          z = res.z;
        }
      }
    }
  }

  return { x, z };
}
