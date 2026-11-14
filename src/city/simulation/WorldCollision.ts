import { TownPlot } from '../types';
import {
  PARKED_CARS,
  ROAD_SURFACE_Y,
  SIDEWALK_HEIGHT,
  STREET_LAMPS,
  TOWN_BENCHES,
} from '../world/MasterTownBlueprint';

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

/**
 * Returns exact walking ground elevation (roads, sidewalks, square/park, footbridge, outer grass).
 */
export function getSurfaceElevationAt(x: number, z: number): number {
  // Arched wooden footbridge spanning the park lake
  if (x >= 56.9 && x <= 59.1 && z >= -13.6 && z <= -3.4) {
    return SIDEWALK_HEIGHT + 0.42;
  }

  // Asphalt road corridors (X = ±26 / ±78, Z = ±26 / ±78)
  const onMainRoad =
    Math.abs(x - 26) < 5.25 ||
    Math.abs(x + 26) < 5.25 ||
    Math.abs(z - 26) < 5.25 ||
    Math.abs(z + 26) < 5.25;
  const onSideRoad =
    Math.abs(x - 78) < 4.5 ||
    Math.abs(x + 78) < 4.5 ||
    Math.abs(z - 78) < 4.5 ||
    Math.abs(z + 78) < 4.5;

  if (onMainRoad || onSideRoad) {
    // Roundabout central landscaped islands at (-26, 0) & (26, 0)
    if (
      Math.hypot(x + 26, z) < 3.6 ||
      Math.hypot(x - 26, z) < 3.6
    ) {
      return SIDEWALK_HEIGHT + 0.08;
    }
    return ROAD_SURFACE_Y;
  }

  // Sidewalks, interior district blocks, and outer residential blocks
  if (x >= -106 && x <= 106 && z >= -74 && z <= 74) {
    return SIDEWALK_HEIGHT;
  }

  return 0;
}

/**
 * Resolves 2D walking collisions against buildings, hedges, fences, benches, fountains,
 * lake edges, streetlamps, parked cars, and live traffic vehicles.
 */
export function resolvePlayerMovement(
  targetX: number,
  targetZ: number,
  plots: TownPlot[],
  dynamicVehicles: DynamicVehicleObstacle[],
  playerRadius = 0.36,
): { x: number; z: number } {
  let x = Math.max(-124, Math.min(124, targetX));
  let z = Math.max(-124, Math.min(124, targetZ));

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

      // Residential & Luxury Side Hedges + Rear Wooden Fence (front remains open for porch access)
      if (
        plot.category === 'residential' ||
        plot.category === 'luxury-residential' ||
        plot.category === 'expansion-residential'
      ) {
        const leftH = toWorld(-halfW + 0.28, 0);
        let res = pushOutOrientedBox(x, z, playerRadius, {
          cx: leftH.cx,
          cz: leftH.cz,
          hx: 0.28,
          hz: halfD - 0.4,
          rotY: -plot.facingAngle,
        });
        x = res.x;
        z = res.z;

        const rightH = toWorld(halfW - 0.28, 0);
        res = pushOutOrientedBox(x, z, playerRadius, {
          cx: rightH.cx,
          cz: rightH.cz,
          hx: 0.28,
          hz: halfD - 0.4,
          rotY: -plot.facingAngle,
        });
        x = res.x;
        z = res.z;

        const rearF = toWorld(0, -halfD + 0.18);
        res = pushOutOrientedBox(x, z, playerRadius, {
          cx: rearF.cx,
          cz: rearF.cz,
          hx: halfW - 0.4,
          hz: 0.16,
          rotY: -plot.facingAngle,
        });
        x = res.x;
        z = res.z;
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
      { cx: 42.2, cz: -1.0, r: 2.6 },
      { cx: -26, cz: 0, r: 3.1 },
      { cx: 26, cz: 0, r: 3.1 },
    ];
    for (const c of circles) {
      if (Math.abs(x - c.cx) > 6 || Math.abs(z - c.cz) > 6) continue;
      const res = pushOutCircle(x, z, playerRadius, c);
      x = res.x;
      z = res.z;
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
  }

  return { x, z };
}
