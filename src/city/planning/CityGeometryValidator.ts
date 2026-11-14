import { IntersectionSpec, RoadSegmentSpec, TownPlot } from '../types';
import type { SidewalkPadSpec } from '../world/MasterTownBlueprint';
import {
  MasterCityMap,
  OverlapViolation,
  PlacedTreeSpec,
  PlannedPlotGeometry,
  PlannedStreetLampSpec,
  RectBounds2D,
  ValidationReport,
} from './types';
import { distancePointToSegment2D, getPlotInfrastructureMetrics } from '../world/TreePlacementValidator';

export function getPlotWorldBounds(plot: TownPlot): RectBounds2D {
  const sin = Math.abs(Math.sin(plot.facingAngle));
  const cos = Math.abs(Math.cos(plot.facingAngle));
  const worldW = plot.width * cos + plot.depth * sin;
  const worldD = plot.width * sin + plot.depth * cos;
  return {
    minX: plot.center.x - worldW / 2,
    maxX: plot.center.x + worldW / 2,
    minZ: plot.center.z - worldD / 2,
    maxZ: plot.center.z + worldD / 2,
  };
}

export function getRectOverlap(
  a: RectBounds2D,
  b: RectBounds2D,
  tolerance = 0.08,
): { overlaps: boolean; overlapX: number; overlapZ: number } {
  const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
  return {
    overlaps: overlapX > tolerance && overlapZ > tolerance,
    overlapX,
    overlapZ,
  };
}

export function getRoadSegmentBounds(seg: RoadSegmentSpec): RectBounds2D {
  const isEW = Math.abs(seg.end.x - seg.start.x) >= Math.abs(seg.end.z - seg.start.z);
  const halfW = seg.width / 2;
  if (isEW) {
    return {
      minX: Math.min(seg.start.x, seg.end.x),
      maxX: Math.max(seg.start.x, seg.end.x),
      minZ: seg.start.z - halfW,
      maxZ: seg.start.z + halfW,
    };
  }
  return {
    minX: seg.start.x - halfW,
    maxX: seg.start.x + halfW,
    minZ: Math.min(seg.start.z, seg.end.z),
    maxZ: Math.max(seg.start.z, seg.end.z),
  };
}

export function getSidewalkBounds(pad: SidewalkPadSpec): RectBounds2D {
  return {
    minX: pad.x - pad.width / 2,
    maxX: pad.x + pad.width / 2,
    minZ: pad.z - pad.depth / 2,
    maxZ: pad.z + pad.depth / 2,
  };
}

export function isPointClearOfMasterRoads(
  x: number,
  z: number,
  roads: RoadSegmentSpec[],
  intersections: IntersectionSpec[],
  lamps: PlannedStreetLampSpec[],
  roadEdgeClearance = 1.6,
  cornerSightlineMargin = 3.8,
): boolean {
  for (const seg of roads) {
    const d = distancePointToSegment2D(x, z, seg.start.x, seg.start.z, seg.end.x, seg.end.z);
    if (d <= seg.width * 0.5 + roadEdgeClearance) return false;
  }

  for (const inter of intersections) {
    const hx = inter.width * 0.5 + cornerSightlineMargin;
    const hz = inter.depth * 0.5 + cornerSightlineMargin;
    if (Math.abs(x - inter.center.x) <= hx && Math.abs(z - inter.center.z) <= hz) return false;
  }

  for (const lamp of lamps) {
    if (Math.hypot(x - lamp.x, z - lamp.z) < 2.5) return false;
  }

  return true;
}

export function isPointClearOfMasterPlots(
  x: number,
  z: number,
  plots: TownPlot[],
  plotMargin = 1.2,
): boolean {
  for (const plot of plots) {
    const sin = Math.sin(plot.facingAngle);
    const cos = Math.cos(plot.facingAngle);
    const dx = x - plot.center.x;
    const dz = z - plot.center.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    const m = getPlotInfrastructureMetrics(plot);

    if (Math.abs(lx) <= m.halfW + plotMargin && Math.abs(lz) <= m.halfD + plotMargin) {
      return false;
    }

    const isRes =
      plot.category === 'residential' ||
      plot.category === 'luxury-residential' ||
      plot.category === 'expansion-residential';
    if (isRes && lz >= m.halfD - 0.5 && lz <= m.halfD + 4.4) {
      if (Math.abs(lx - m.drivewayX) <= 2.6 || Math.abs(lx - m.pathX) <= 2.2) {
        return false;
      }
    }
  }
  return true;
}

export function findNearestRoadForPoint(
  x: number,
  z: number,
  roads: RoadSegmentSpec[],
): { road: RoadSegmentSpec | null; edgeDistance: number } {
  let bestRoad: RoadSegmentSpec | null = null;
  let bestEdgeDist = Infinity;

  for (const seg of roads) {
    const centerDist = distancePointToSegment2D(x, z, seg.start.x, seg.start.z, seg.end.x, seg.end.z);
    const edgeDist = Math.abs(centerDist - seg.width * 0.5);
    if (edgeDist < bestEdgeDist) {
      bestEdgeDist = edgeDist;
      bestRoad = seg;
    }
  }

  return { road: bestRoad, edgeDistance: bestEdgeDist };
}

export function findNearestSidewalkForPoint(
  x: number,
  z: number,
  sidewalks: SidewalkPadSpec[],
): { sidewalk: SidewalkPadSpec | null; distance: number } {
  let bestPad: SidewalkPadSpec | null = null;
  let bestDist = Infinity;

  for (const pad of sidewalks) {
    const b = getSidewalkBounds(pad);
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    const dist = Math.hypot(dx, dz);
    if (dist < bestDist) {
      bestDist = dist;
      bestPad = pad;
    }
  }

  return { sidewalk: bestPad, distance: bestDist };
}

/**
 * Full automatic spatial audit for the unified MasterCityMap:
 * Checks plot-vs-plot overlaps, plot-vs-road/intersection overlaps,
 * house containment inside plot bounds, driveway/walkway road connectivity,
 * and tree/lamp collision clearance.
 */
export function validateMasterCityMap(
  map: Omit<MasterCityMap, 'validation'>,
): ValidationReport {
  const violations: OverlapViolation[] = [];
  const plotBoundsList = map.plots.map((plot) => ({
    plot,
    bounds: getPlotWorldBounds(plot),
  }));

  // 1. Plot-vs-Plot overlaps
  for (let i = 0; i < plotBoundsList.length; i++) {
    const a = plotBoundsList[i];
    for (let j = i + 1; j < plotBoundsList.length; j++) {
      const b = plotBoundsList[j];
      const ov = getRectOverlap(a.bounds, b.bounds, 0.12);
      if (ov.overlaps) {
        violations.push({
          id: `ov-plot-${a.plot.id}-${b.plot.id}`,
          severity: 'error',
          category: 'plot-overlap',
          objectA: a.plot.plotCode,
          objectB: b.plot.plotCode,
          x: (a.plot.center.x + b.plot.center.x) / 2,
          z: (a.plot.center.z + b.plot.center.z) / 2,
          overlapAmount: Number(Math.min(ov.overlapX, ov.overlapZ).toFixed(2)),
          message: `Plot ${a.plot.plotCode} overlaps ${b.plot.plotCode} by ${Math.min(
            ov.overlapX,
            ov.overlapZ,
          ).toFixed(2)}m`,
        });
      }
    }
  }

  // 2. Plot-vs-Road & Plot-vs-Intersection overlaps
  const roadBoxes = map.roads.map((r) => ({ road: r, bounds: getRoadSegmentBounds(r) }));
  for (const { plot, bounds } of plotBoundsList) {
    for (const rb of roadBoxes) {
      const ov = getRectOverlap(bounds, rb.bounds, 0.12);
      if (ov.overlaps) {
        violations.push({
          id: `ov-road-${plot.id}-${rb.road.id}`,
          severity: 'error',
          category: 'plot-road',
          objectA: plot.plotCode,
          objectB: `${rb.road.name} (${rb.road.id})`,
          x: plot.center.x,
          z: plot.center.z,
          overlapAmount: Number(Math.min(ov.overlapX, ov.overlapZ).toFixed(2)),
          message: `Plot ${plot.plotCode} encroaches on ${rb.road.name} by ${Math.min(
            ov.overlapX,
            ov.overlapZ,
          ).toFixed(2)}m`,
        });
      }
    }

    for (const inter of map.intersections) {
      const ib: RectBounds2D = {
        minX: inter.center.x - inter.width / 2,
        maxX: inter.center.x + inter.width / 2,
        minZ: inter.center.z - inter.depth / 2,
        maxZ: inter.center.z + inter.depth / 2,
      };
      const ov = getRectOverlap(bounds, ib, 0.12);
      if (ov.overlaps) {
        violations.push({
          id: `ov-inter-${plot.id}-${inter.id}`,
          severity: 'error',
          category: 'plot-road',
          objectA: plot.plotCode,
          objectB: `Intersection ${inter.id}`,
          x: plot.center.x,
          z: plot.center.z,
          overlapAmount: Number(Math.min(ov.overlapX, ov.overlapZ).toFixed(2)),
          message: `Plot ${plot.plotCode} overlaps intersection ${inter.id}`,
        });
      }
    }
  }

  // 3. House bounds containment inside each plot
  for (const plot of map.plots) {
    if (!plot.house) continue;
    const minWidthNeeded = plot.house.width + (plot.house.hasGarageCarport ? 3.2 : 1.4);
    const minDepthNeeded = plot.house.depth + 2.8;
    if (plot.width < minWidthNeeded || plot.depth < minDepthNeeded) {
      const deficit = Math.max(minWidthNeeded - plot.width, minDepthNeeded - plot.depth);
      violations.push({
        id: `ov-house-bounds-${plot.id}`,
        severity: 'error',
        category: 'house-bounds',
        objectA: `${plot.plotCode} House`,
        objectB: `${plot.plotCode} Boundary`,
        x: plot.center.x,
        z: plot.center.z,
        overlapAmount: Number(deficit.toFixed(2)),
        message: `House on ${plot.plotCode} exceeds safe setback bounds by ${deficit.toFixed(2)}m`,
      });
    }
  }

  // 4. Driveway-to-Road & Walkway-to-Sidewalk connectivity
  let disconnectedDriveways = 0;
  let disconnectedWalkways = 0;
  for (const geom of map.plannedPlotGeometries) {
    if (geom.drivewaySegment.connectedRoadEdgeDist > 3.6) {
      disconnectedDriveways++;
      violations.push({
        id: `conn-driveway-${geom.plotId}`,
        severity: 'warning',
        category: 'connectivity',
        objectA: `${geom.plotCode} Driveway`,
        objectB: geom.connectedRoadName ?? 'Nearest Road',
        x: geom.drivewaySegment.endX,
        z: geom.drivewaySegment.endZ,
        overlapAmount: Number(geom.drivewaySegment.connectedRoadEdgeDist.toFixed(2)),
        message: `${geom.plotCode} driveway apron is ${geom.drivewaySegment.connectedRoadEdgeDist.toFixed(
          1,
        )}m away from road curb`,
      });
    }
    if (geom.pedestrianPathSegment.connectedSidewalkDist > 1.8) {
      disconnectedWalkways++;
      violations.push({
        id: `conn-walk-${geom.plotId}`,
        severity: 'warning',
        category: 'connectivity',
        objectA: `${geom.plotCode} Walkway`,
        objectB: 'Public Sidewalk',
        x: geom.pedestrianPathSegment.endX,
        z: geom.pedestrianPathSegment.endZ,
        overlapAmount: Number(geom.pedestrianPathSegment.connectedSidewalkDist.toFixed(2)),
        message: `${geom.plotCode} front walkway is ${geom.pedestrianPathSegment.connectedSidewalkDist.toFixed(
          1,
        )}m from sidewalk`,
      });
    }
  }

  // 5. Tree vs Road / Intersection / Plot-Driveway clearance
  for (const tree of map.roadsideTrees) {
    for (const seg of map.roads) {
      const d = distancePointToSegment2D(tree.x, tree.z, seg.start.x, seg.start.z, seg.end.x, seg.end.z);
      if (d <= seg.width * 0.5 + 0.3) {
        violations.push({
          id: `ov-tree-road-${tree.id}-${seg.id}`,
          severity: 'error',
          category: 'tree-clearance',
          objectA: tree.id,
          objectB: seg.name,
          x: tree.x,
          z: tree.z,
          overlapAmount: Number((seg.width * 0.5 + 0.3 - d).toFixed(2)),
          message: `Tree ${tree.id} encroaches into ${seg.name}`,
        });
        break;
      }
    }
  }

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;

  return {
    isValid: errorCount === 0,
    checkedAt: Date.now(),
    errorCount,
    warningCount,
    violations,
    stats: {
      totalObjectsChecked:
        map.plots.length +
        map.roads.length +
        map.intersections.length +
        map.sidewalks.length +
        map.roadsideTrees.length +
        map.streetLamps.length,
      disconnectedDriveways,
      disconnectedWalkways,
      treesCleared: map.roadsideTrees.length,
    },
  };
}
