import { TownPlot } from '../types';
import {
  INTERSECTIONS,
  PARKED_CARS,
  ROAD_SEGMENTS,
  ROUNDABOUT_CENTERS,
  STREET_LAMPS,
  TOWN_BENCHES,
} from './MasterTownBlueprint';
import {
  ExpansionCityWorld,
  getExpansionHouseMetrics,
  queryNearbyExpansionPlots,
} from '../expansion/ExpansionMasterPlan';
import { CurvedRoadSplineSpec, ExpansionPlotSpec } from '../expansion/types';

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
    const pad = cr.width * 0.5 + cr.greenStripWidth + cr.sidewalkWidth + 3.0;
    return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
  });
  curvedRoadBBoxCache.set(curvedRoads, cached);
  return cached;
}

export function distancePointToSegment2D(
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

export function getPlotInfrastructureMetrics(plot: TownPlot) {
  const halfW = plot.width / 2;
  const halfD = plot.depth / 2;
  const house = plot.house;
  const houseLocalX = house?.hasGarageCarport ? -0.8 : -0.4;
  const houseLocalZ = -1.2;
  const pathX = house ? houseLocalX : 0;
  const drivewayX = house?.hasGarageCarport
    ? Math.min(halfW - 2.15, houseLocalX + house.width / 2 + 1.45)
    : halfW - 2.65;
  const pathStartZ = house ? houseLocalZ + house.depth / 2 + 0.45 : 0.6;
  const spurStartX = pathX + 1.2;
  const spurEndX = drivewayX - 1.6;
  const spurZ = house
    ? Math.min(halfD - 2.35, houseLocalZ + house.depth / 2 + 2.05)
    : 3.2;

  return {
    halfW,
    halfD,
    houseLocalX,
    houseLocalZ,
    pathX,
    drivewayX,
    pathStartZ,
    spurStartX,
    spurEndX,
    spurZ,
  };
}

/**
 * Validates that a world-space tree/shrub inside or around Historic Core Lindenhof
 * is completely clear of roads, intersections, roundabouts, driveways, lamps, benches, and parked cars.
 */
export function isClearOfCoreRoadsAndInfra(
  x: number,
  z: number,
  roadEdgeClearance = 2.25,
  cornerSightlineMargin = 4.2,
): boolean {
  // 1. All core road segments (including outer stub extensions out to ±140 / ±130)
  for (const seg of ROAD_SEGMENTS) {
    const d = distancePointToSegment2D(x, z, seg.start.x, seg.start.z, seg.end.x, seg.end.z);
    if (d <= seg.width * 0.5 + roadEdgeClearance) {
      return false;
    }
  }

  // 2. All core intersections + corner sightline triangles
  for (const inter of INTERSECTIONS) {
    const hx = inter.width * 0.5 + cornerSightlineMargin;
    const hz = inter.depth * 0.5 + cornerSightlineMargin;
    if (Math.abs(x - inter.center.x) <= hx && Math.abs(z - inter.center.z) <= hz) {
      return false;
    }
  }

  // 3. Roundabout islands & driving rings (zero trees inside roundabouts or lanes)
  for (const rb of ROUNDABOUT_CENTERS) {
    if (Math.hypot(x - rb.x, z - rb.z) <= 8.6) {
      return false;
    }
  }

  // 4. Perimeter expansion boulevards framing the core basin
  if (Math.abs(x + 140) <= 8.2 || Math.abs(x - 145) <= 8.2) return false;
  if (Math.abs(z + 130) <= 8.4 || Math.abs(z - 130) <= 8.4) return false;
  if (z < -118 && (Math.abs(x + 36) <= 7.2 || Math.abs(x - 36) <= 7.2)) return false;

  // 5. Street furniture & parking bays
  for (const lamp of STREET_LAMPS) {
    if (Math.hypot(x - lamp.x, z - lamp.z) < 2.8) return false;
  }
  for (const car of PARKED_CARS) {
    if (Math.hypot(x - car.x, z - car.z) < 3.0) return false;
  }
  for (const bench of TOWN_BENCHES) {
    if (Math.hypot(x - bench.x, z - bench.z) < 2.1) return false;
  }

  return true;
}

/**
 * Checks whether a world-space tree overlaps any core TownPlot footprint or its front driveway/walkway apron.
 */
export function isClearOfCorePlotsAndDriveways(
  x: number,
  z: number,
  plots: TownPlot[],
  plotMargin = 1.4,
): boolean {
  for (const plot of plots) {
    const sin = Math.sin(plot.facingAngle);
    const cos = Math.cos(plot.facingAngle);
    const dx = x - plot.center.x;
    const dz = z - plot.center.z;
    // Transform world delta into plot local frame
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    const m = getPlotInfrastructureMetrics(plot);

    if (Math.abs(lx) <= m.halfW + plotMargin && Math.abs(lz) <= m.halfD + plotMargin) {
      return false;
    }

    // Keep driveway & front gate thresholds on the adjacent sidewalk clear of trees
    const isResidential =
      plot.category === 'residential' ||
      plot.category === 'luxury-residential' ||
      plot.category === 'expansion-residential';
    if (isResidential && lz >= m.halfD - 0.5 && lz <= m.halfD + 4.2) {
      if (Math.abs(lx - m.drivewayX) <= 2.6 || Math.abs(lx - m.pathX) <= 2.2) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Validates that a plot's internal garden tree sits cleanly in landscaped grass,
 * never inside a driveway, pedestrian walkway, courtyard spur, house, pool, nameplate, or fence.
 */
export function isPlotGardenTreeSafe(
  plot: TownPlot,
  localX: number,
  localZ: number,
): boolean {
  const m = getPlotInfrastructureMetrics(plot);
  const edgeMargin = 1.35;
  if (
    Math.abs(localX) > m.halfW - edgeMargin ||
    Math.abs(localZ) > m.halfD - edgeMargin
  ) {
    return false;
  }

  const isResidential =
    plot.category === 'residential' ||
    plot.category === 'luxury-residential' ||
    plot.category === 'expansion-residential';

  if (isResidential) {
    // Keep driveway & car approach completely open
    if (Math.abs(localX - m.drivewayX) <= 2.4 && localZ >= -0.9) {
      return false;
    }
    // Keep main front stone walkway & porch completely open
    if (Math.abs(localX - m.pathX) <= 2.05 && localZ >= m.pathStartZ - 0.9) {
      return false;
    }
    // Keep connecting courtyard spur clear
    if (
      m.spurEndX > m.spurStartX &&
      localX >= m.spurStartX - 0.9 &&
      localX <= m.spurEndX + 0.9 &&
      Math.abs(localZ - m.spurZ) <= 1.75
    ) {
      return false;
    }
    // Keep nameplate sign clear
    if (Math.hypot(localX - (m.pathX - 2.35), localZ - (m.halfD - 0.04)) < 1.55) {
      return false;
    }
  }

  if (plot.house) {
    const hw = plot.house.width * 0.5 + 1.4;
    const hd = plot.house.depth * 0.5 + 1.4;
    if (
      Math.abs(localX - m.houseLocalX) <= hw &&
      Math.abs(localZ - m.houseLocalZ) <= hd
    ) {
      return false;
    }
    // Front flowerbed strip
    const bedX = Math.max(-m.halfW + 2.1, m.pathX - 3.1);
    if (Math.abs(localX - bedX) <= 1.8 && Math.abs(localZ - (m.halfD - 1.55)) <= 1.15) {
      return false;
    }
    // Swimming pool clearance
    if (plot.house.hasPool) {
      if (
        Math.abs(localX - (m.houseLocalX + 1.5)) <= 3.7 &&
        Math.abs(localZ - (-m.halfD + 2.4)) <= 2.4
      ) {
        return false;
      }
    }
  } else if (plot.business) {
    if (
      Math.abs(localX) <= plot.business.width * 0.5 + 1.4 &&
      Math.abs(localZ + 0.6) <= plot.business.depth * 0.5 + 1.4
    ) {
      return false;
    }
  } else if (plot.publicBuilding) {
    if (
      Math.abs(localX) <= plot.publicBuilding.width * 0.5 + 1.6 &&
      Math.abs(localZ) <= plot.publicBuilding.depth * 0.5 + 1.6
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Validates any expansion boulevard / green-strip / scenic parkway tree against:
 * - Every straight & curved road segment using exact point-to-segment distance
 * - Suburban grid road crossings & sightline corners
 * - Outer panoramic ring ellipse road
 * - Canals, bridges, bus stops, streetlamps, benches, parks, and residential plots
 */
export function isClearOfExpansionInfra(
  x: number,
  z: number,
  world: ExpansionCityWorld,
  roadEdgeClearance = 2.2,
): boolean {
  // Core historic basin handled separately
  if (Math.abs(x) < 138 && Math.abs(z) < 128) return false;

  // Grand Central Park & Waterfront Lake
  if (x >= 144 && x <= 572 && z >= -138 && z <= 138) return false;

  // Dedicated district parks
  for (const pk of world.districtParks) {
    if (Math.abs(x - pk.x) <= pk.width * 0.5 + 3.0 && Math.abs(z - pk.z) <= pk.depth * 0.5 + 3.0) {
      return false;
    }
  }

  // Canals
  for (const c of world.canals) {
    const d = distancePointToSegment2D(x, z, c.x1, c.z1, c.x2, c.z2);
    if (d <= c.width * 0.5 + 3.8) return false;
  }

  // Road & pedestrian canal bridges
  for (const b of world.bridges) {
    const isNS = Math.abs(b.rotY) < 0.4;
    const hx = (isNS ? b.length : b.width) * 0.5 + 3.2;
    const hz = (isNS ? b.width : b.length) * 0.5 + 3.2;
    if (Math.abs(x - b.x) <= hx && Math.abs(z - b.z) <= hz) return false;
  }

  // Exact point-to-segment distance against ALL expansion roads (straight + curvy)
  for (const r of world.roads) {
    // Broad bounding box reject first for O(1) speed
    const margin = r.width * 0.5 + roadEdgeClearance;
    if (
      x < Math.min(r.x1, r.x2) - margin ||
      x > Math.max(r.x1, r.x2) + margin ||
      z < Math.min(r.z1, r.z2) - margin ||
      z > Math.max(r.z1, r.z2) + margin
    ) {
      continue;
    }
    const d = distancePointToSegment2D(x, z, r.x1, r.z1, r.x2, r.z2);
    if (d <= margin) return false;
  }

  // Roundabouts & central islands
  for (const rb of world.roundabouts) {
    if (Math.hypot(x - rb.x, z - rb.z) <= rb.innerRadius + rb.roadWidth + rb.sidewalkWidth + 1.5) {
      return false;
    }
  }

  // Smooth Curved District Roads, Green Strips, and Raised Sidewalks
  const crBBoxes = getCurvedRoadBBoxes(world.curvedRoads);
  for (let rIdx = 0; rIdx < world.curvedRoads.length; rIdx++) {
    const bb = crBBoxes[rIdx];
    if (x < bb.minX || x > bb.maxX || z < bb.minZ || z > bb.maxZ) continue;
    const cr = world.curvedRoads[rIdx];
    const pts = cr.sampledPoints;
    const clearDist = Math.max(
      cr.width * 0.5 + roadEdgeClearance,
      cr.width * 0.5 + cr.greenStripWidth + cr.sidewalkWidth + 0.6,
    );
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      if (
        x < Math.min(p0.x, p1.x) - clearDist ||
        x > Math.max(p0.x, p1.x) + clearDist ||
        z < Math.min(p0.z, p1.z) - clearDist ||
        z > Math.max(p0.z, p1.z) + clearDist
      ) {
        continue;
      }
      if (distancePointToSegment2D(x, z, p0.x, p0.z, p1.x, p1.z) <= clearDist) {
        return false;
      }
    }
  }

  // Outer Panoramic Elliptical Ring Road safety corridor (rx = 1175, rz = 890, halfW = 5.7)
  const ellipNorm = Math.hypot(x / 1175, z / 890);
  if (Math.abs(ellipNorm - 1.0) <= 0.011) return false;

  // Bus stops, lamps, benches
  for (const bs of world.busStops) {
    if (Math.hypot(x - bs.x, z - bs.z) < 5.8) return false;
  }
  for (const lamp of world.lamps) {
    if (Math.hypot(x - lamp.x, z - lamp.z) < 2.6) return false;
  }
  for (const bench of world.benches) {
    if (Math.hypot(x - bench.x, z - bench.z) < 2.2) return false;
  }

  // Nearby residential/OG plots (including VIP palace) using exact rotated OBB coordinates
  const nearby = queryNearbyExpansionPlots(world.spatialIndex, x, z, 32);
  for (const p of nearby) {
    const sin = Math.sin(p.facingAngle);
    const cos = Math.cos(p.facingAngle);
    const dx = x - p.x;
    const dz = z - p.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) < p.width * 0.5 + 2.0 && Math.abs(lz) < p.depth * 0.5 + 2.0) {
      return false;
    }
  }

  return true;
}

/**
 * Validates that an expansion plot's internal garden tree never overlaps its house,
 * attached garage, driveway, front walkway, mailbox, or rear pool.
 */
export function isExpansionPlotTreeSafe(
  plot: ExpansionPlotSpec,
  localX: number,
  localZ: number,
): boolean {
  const halfW = plot.width * 0.5;
  const halfD = plot.depth * 0.5;
  if (Math.abs(localX) > halfW - 1.15 || Math.abs(localZ) > halfD - 1.15) {
    return false;
  }

  const m = getExpansionHouseMetrics(plot);

  // Front entrance walkway & mailbox zone
  if (Math.abs(localX - m.walkwayX) <= 1.55 && localZ >= m.houseLocalZ) {
    return false;
  }
  if (Math.hypot(localX - (m.walkwayX - 1.4), localZ - (halfD - 0.55)) <= 1.1) {
    return false;
  }

  if (plot.houseStyle) {
    const hw = plot.houseStyle.width * 0.5 + 0.85;
    const hd = plot.houseStyle.depth * 0.5 + 0.85;
    if (Math.abs(localX - m.houseLocalX) <= hw && Math.abs(localZ - m.houseLocalZ) <= hd) {
      return false;
    }

    if (m.hasGarage) {
      // Attached garage wing + driveway apron
      if (
        Math.abs(localX - m.drivewayX) <= 2.1 &&
        localZ >= m.houseLocalZ - 2.9 &&
        localZ <= halfD
      ) {
        return false;
      }
    }

    if (plot.houseStyle.hasPool) {
      if (Math.abs(localX) <= 3.5 && localZ <= -halfD + 4.4) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Spatial-grid O(N) filter enforcing natural minimum distance between neighboring trees.
 */
export function filterWithMinSpacing<T extends { x: number; z: number }>(
  candidates: T[],
  minSpacing: number,
): T[] {
  if (minSpacing <= 0 || candidates.length === 0) return candidates;
  const cell = minSpacing;
  const minSq = minSpacing * minSpacing;
  const grid = new Map<string, Array<{ x: number; z: number }>>();
  const accepted: T[] = [];

  for (const item of candidates) {
    const gx = Math.floor(item.x / cell);
    const gz = Math.floor(item.z / cell);
    let tooClose = false;

    for (let dx = -1; dx <= 1 && !tooClose; dx++) {
      for (let dz = -1; dz <= 1 && !tooClose; dz++) {
        const bucket = grid.get(`${gx + dx},${gz + dz}`);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const other = bucket[i];
          const ddx = item.x - other.x;
          const ddz = item.z - other.z;
          if (ddx * ddx + ddz * ddz < minSq) {
            tooClose = true;
            break;
          }
        }
      }
    }

    if (!tooClose) {
      accepted.push(item);
      const key = `${gx},${gz}`;
      const list = grid.get(key);
      if (list) list.push({ x: item.x, z: item.z });
      else grid.set(key, [{ x: item.x, z: item.z }]);
    }
  }

  return accepted;
}
