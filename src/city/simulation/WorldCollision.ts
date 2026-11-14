import { TownPlot } from '../types';
import {
  PARKED_CARS,
  ROAD_SURFACE_Y,
  SIDEWALK_HEIGHT,
  STREET_LAMPS,
  TOWN_BENCHES,
} from '../world/MasterTownBlueprint';
import { ExpansionCityWorld, queryNearbyExpansionPlots } from '../expansion/ExpansionMasterPlan';

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

function isInsideExpansionGridArea(x: number, z: number): boolean {
  if (x < -1045 || x > 1045 || z < -765 || z > 765) return false;
  // Core Lindenhof is handled by core elevation logic
  if (x >= -138 && x <= 138 && z >= -128 && z <= 128) return false;
  return true;
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

  // Core asphalt road corridors (X = ±26 / ±78, Z = ±26 / ±78)
  const inCore = Math.abs(x) <= 138 && Math.abs(z) <= 128;
  if (inCore) {
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
      if (Math.hypot(x + 26, z) < 3.6 || Math.hypot(x - 26, z) < 3.6) {
        return SIDEWALK_HEIGHT + 0.08;
      }
      return ROAD_SURFACE_Y;
    }

    if (x >= -106 && x <= 106 && z >= -74 && z <= 74) {
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

    // Curved Panoramic Ring Boulevard
    const ellipR = Math.hypot(x / 1085, z / 815);
    if (Math.abs(ellipR - 1) <= 0.011) {
      return ROAD_SURFACE_Y;
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

    // Grand Central Park + Waterfront Pads + OG District + Royal Crescent Garden
    if (
      (x >= 148 && x <= 326 && z >= -130 && z <= 130) ||
      (x >= 326 && x <= 568 && z >= -136 && z <= 136) ||
      (x >= -248 && x <= 248 && z >= -330 && z <= -130)
    ) {
      return SIDEWALK_HEIGHT;
    }

    // 6 Unique District Parks
    for (const pk of expansionWorld.districtParks) {
      if (Math.abs(x - pk.x) <= pk.width / 2 && Math.abs(z - pk.z) <= pk.depth / 2) {
        return SIDEWALK_HEIGHT + 0.02;
      }
    }

    // Master Suburban Grid Roads (x = col*140 - 70, z = row*44 - 22)
    if (isInsideExpansionGridArea(x, z)) {
      const modX = Math.abs((((x + 70) % 140) + 140) % 140 - 70);
      const distGridX = 70 - modX;
      const modZ = Math.abs((((z + 22) % 44) + 44) % 44 - 22);
      const distGridZ = 22 - modZ;
      if (distGridX < 4.7 || distGridZ < 4.5) {
        return ROAD_SURFACE_Y;
      }
      return SIDEWALK_HEIGHT;
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
  const minX = expansionWorld ? -1120 : -124;
  const maxX = expansionWorld ? 1120 : 124;
  const minZ = expansionWorld ? -840 : -124;
  const maxZ = expansionWorld ? 840 : 124;
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

      // Royal Crescent Garden Fountain at (0, -284)
      if (Math.abs(x) < 6 && Math.abs(z + 284) < 6) {
        const res = pushOutCircle(x, z, playerRadius, { cx: 0, cz: -284, r: 3.3 });
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
          x = res.x;
          z = res.z;
        } else if (ep.houseStyle) {
          const sin = Math.sin(ep.facingAngle);
          const cos = Math.cos(ep.facingAngle);
          const localZ = -1.1;
          const hx = ep.x + localZ * sin;
          const hz = ep.z + localZ * cos;
          const res = pushOutOrientedBox(x, z, playerRadius, {
            cx: hx,
            cz: hz,
            hx: ep.houseStyle.width / 2 + 0.18,
            hz: ep.houseStyle.depth / 2 + 0.18,
            rotY: -ep.facingAngle,
          });
          x = res.x;
          z = res.z;
        }
      }
    }
  }

  return { x, z };
}
