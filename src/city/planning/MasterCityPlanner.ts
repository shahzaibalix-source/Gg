import {
  DistrictChunk,
  HouseArchetype,
  HouseStyleSpec,
  IntersectionSpec,
  RoadSegmentSpec,
  TownPlot,
} from '../types';
import {
  DISTRICTS,
  INITIAL_TOWN_PLOTS,
  SIDEWALK_HEIGHT,
  SidewalkPadSpec,
  TOWN_BENCHES,
} from '../world/MasterTownBlueprint';
import { HOUSE_PRESETS } from '../registry/CityRegistry';
import { getPlotInfrastructureMetrics } from '../world/TreePlacementValidator';
import {
  CardinalDirection,
  CityGenerationStageReport,
  DEFAULT_URBAN_PLAN_CONFIG,
  MasterCityMap,
  PlacedTreeSpec,
  PlannedBenchSpec,
  PlannedGreenBelt,
  PlannedObjectRecord,
  PlannedPlotGeometry,
  PlannedResidentialBlock,
  PlannedStreetLampSpec,
  RectBounds2D,
  UrbanPlanConfig,
} from './types';
import {
  findNearestRoadForPoint,
  findNearestSidewalkForPoint,
  getPlotWorldBounds,
  isPointClearOfMasterPlots,
  isPointClearOfMasterRoads,
  validateMasterCityMap,
} from './CityGeometryValidator';

function seededRand(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const RESIDENTIAL_ARCHETYPES: HouseArchetype[] = [
  'tudor',
  'townhouse',
  'cottage',
  'nordic',
  'mediterranean',
  'modern-villa',
  'luxury-modern',
];

const ROOF_CHOICES = ['#9c4b34', '#3d434c', '#48505c', '#2d333b', '#b05c3d', '#8d412e', '#414954'];
const WALL_CHOICES = [
  '#f3ebd8',
  '#e7dcc8',
  '#d9d4cb',
  '#edd7b4',
  '#f4f4f1',
  '#ebe1cc',
  '#ded6c6',
  '#c6cbd0',
  '#e8dfd1',
];

function buildDeterministicHouse(plotId: string, blockSeed: number, isLuxury = false): HouseStyleSpec {
  const rng = seededRand(hashString(plotId) ^ (blockSeed * 7919 + 31));
  const pool = isLuxury
    ? (['luxury-modern', 'luxury-mansion', 'modern-villa', 'mediterranean'] as HouseArchetype[])
    : RESIDENTIAL_ARCHETYPES;
  const archetype = pool[Math.floor(rng() * pool.length)];
  const base = HOUSE_PRESETS[archetype];
  const wallColor = WALL_CHOICES[Math.floor(rng() * WALL_CHOICES.length)];
  const roofColor = ROOF_CHOICES[Math.floor(rng() * ROOF_CHOICES.length)];
  const hasGarageCarport = rng() > 0.22;

  return {
    ...base,
    wallColor: rng() > 0.45 ? wallColor : base.wallColor,
    roofColor: rng() > 0.45 ? roofColor : base.roofColor,
    hasGarageCarport,
    hasBalcony: isLuxury ? true : rng() > 0.4,
    hasPool: isLuxury && rng() > 0.35,
  };
}

function buildDeterministicGardenTrees(
  plotId: string,
  width: number,
  depth: number,
  blockSeed: number,
): Array<{ x: number; z: number; scale: number; variant: 'broadleaf' | 'cypress' | 'ornamental' }> {
  const rng = seededRand(hashString(plotId) ^ (blockSeed * 104729 + 17));
  const variants: Array<'broadleaf' | 'cypress' | 'ornamental'> = [
    'broadleaf',
    'cypress',
    'ornamental',
  ];
  const hx = Math.max(4.5, width / 2 - 2.1);
  const hz = Math.max(4.2, depth / 2 - 2.1);

  return [
    {
      x: -hx,
      z: -hz + rng() * 1.4,
      scale: 0.86 + rng() * 0.18,
      variant: variants[Math.floor(rng() * variants.length)],
    },
    {
      x: hx,
      z: -hz + rng() * 1.4,
      scale: 0.86 + rng() * 0.18,
      variant: variants[Math.floor(rng() * variants.length)],
    },
  ];
}

function facingAngleToDirection(facingAngle: number): CardinalDirection {
  const norm = ((facingAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (Math.abs(norm - Math.PI) < 0.4) return 'north';
  if (Math.abs(norm - Math.PI / 2) < 0.4) return 'east';
  if (Math.abs(norm - (Math.PI * 3) / 2) < 0.4) return 'west';
  return 'south';
}

interface NewPlotBlueprintSeed {
  id: string;
  plotCode: string;
  blockId: string;
  address: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  facingAngle: number;
  openByDefault?: boolean;
}

/**
 * 28 new aligned residential plots completing the 50-plot, 5-block residential master plan
 * alongside the 22 preserved residential/expansion slots from INITIAL_TOWN_PLOTS.
 */
const PLANNED_EXTENSION_RESIDENTIAL_PLOTS: NewPlotBlueprintSeed[] = [
  // Block 2 (Oakwood South-West) remaining 4 plots -> 10 total in Block 2
  {
    id: 'res-13',
    plotCode: 'RES-13',
    blockId: 'block-2-oakwood-southwest',
    address: '2 West Canal Street',
    x: -95.15,
    z: -61.53,
    width: 18.3,
    depth: 19.7,
    facingAngle: Math.PI / 2,
  },
  {
    id: 'res-14',
    plotCode: 'RES-14',
    blockId: 'block-2-oakwood-southwest',
    address: '20 West Canal Street',
    x: -95.15,
    z: 61.53,
    width: 18.3,
    depth: 19.7,
    facingAngle: Math.PI / 2,
  },
  {
    id: 'res-15',
    plotCode: 'RES-15',
    blockId: 'block-2-oakwood-southwest',
    address: '4 South Expansion Way',
    x: -61.53,
    z: 94.15,
    width: 18.3,
    depth: 17.7,
    facingAngle: Math.PI,
  },
  {
    id: 'res-16',
    plotCode: 'RES-16',
    blockId: 'block-2-oakwood-southwest',
    address: '8 South Expansion Way',
    x: -43.21,
    z: 94.15,
    width: 18.3,
    depth: 17.7,
    facingAngle: Math.PI,
    openByDefault: true,
  },

  // Block 3 (South Meadows) -> 10 plots along Z=+78 and Z=+128
  {
    id: 'res-17',
    plotCode: 'RES-17',
    blockId: 'block-3-south-meadows',
    address: '14 South Expansion Way',
    x: -8.98,
    z: 94.15,
    width: 17.9,
    depth: 17.7,
    facingAngle: Math.PI,
  },
  {
    id: 'res-18',
    plotCode: 'RES-18',
    blockId: 'block-3-south-meadows',
    address: '18 South Expansion Way',
    x: 8.98,
    z: 94.15,
    width: 17.9,
    depth: 17.7,
    facingAngle: Math.PI,
  },
  {
    id: 'res-19',
    plotCode: 'RES-19',
    blockId: 'block-3-south-meadows',
    address: '11 South Meadows Way',
    x: -8.98,
    z: 111.85,
    width: 17.9,
    depth: 17.7,
    facingAngle: 0,
  },
  {
    id: 'res-20',
    plotCode: 'RES-20',
    blockId: 'block-3-south-meadows',
    address: '15 South Meadows Way',
    x: 8.98,
    z: 111.85,
    width: 17.9,
    depth: 17.7,
    facingAngle: 0,
    openByDefault: true,
  },
  {
    id: 'res-21',
    plotCode: 'RES-21',
    blockId: 'block-3-south-meadows',
    address: '26 South Expansion Way',
    x: 43.21,
    z: 94.15,
    width: 18.3,
    depth: 17.7,
    facingAngle: Math.PI,
  },
  {
    id: 'res-22',
    plotCode: 'RES-22',
    blockId: 'block-3-south-meadows',
    address: '30 South Expansion Way',
    x: 61.53,
    z: 94.15,
    width: 18.3,
    depth: 17.7,
    facingAngle: Math.PI,
  },
  {
    id: 'res-23',
    plotCode: 'RES-23',
    blockId: 'block-3-south-meadows',
    address: '25 South Meadows Way',
    x: 43.21,
    z: 111.85,
    width: 18.3,
    depth: 17.7,
    facingAngle: 0,
  },
  {
    id: 'res-24',
    plotCode: 'RES-24',
    blockId: 'block-3-south-meadows',
    address: '29 South Meadows Way',
    x: 61.53,
    z: 111.85,
    width: 18.3,
    depth: 17.7,
    facingAngle: 0,
  },
  {
    id: 'res-25',
    plotCode: 'RES-25',
    blockId: 'block-3-south-meadows',
    address: '3 South Meadows Way',
    x: -61.53,
    z: 111.85,
    width: 18.3,
    depth: 17.7,
    facingAngle: 0,
  },
  {
    id: 'res-26',
    plotCode: 'RES-26',
    blockId: 'block-3-south-meadows',
    address: '7 South Meadows Way',
    x: -43.21,
    z: 111.85,
    width: 18.3,
    depth: 17.7,
    facingAngle: 0,
    openByDefault: true,
  },

  // Block 4 (East Parkside & Horizon) 7 new plots + EXP-01, EXP-02, EXP-06 -> 10 total in Block 4
  {
    id: 'res-27',
    plotCode: 'RES-27',
    blockId: 'block-4-east-parkside',
    address: '2 East Horizon Street',
    x: 95.15,
    z: -61.53,
    width: 18.3,
    depth: 19.7,
    facingAngle: -Math.PI / 2,
  },
  {
    id: 'res-28',
    plotCode: 'RES-28',
    blockId: 'block-4-east-parkside',
    address: '6 East Horizon Street',
    x: 95.15,
    z: -43.21,
    width: 18.3,
    depth: 19.7,
    facingAngle: -Math.PI / 2,
  },
  {
    id: 'res-29',
    plotCode: 'RES-29',
    blockId: 'block-4-east-parkside',
    address: '10 East Horizon Street',
    x: 95.15,
    z: -8.98,
    width: 17.9,
    depth: 19.7,
    facingAngle: -Math.PI / 2,
  },
  {
    id: 'res-30',
    plotCode: 'RES-30',
    blockId: 'block-4-east-parkside',
    address: '14 East Horizon Street',
    x: 95.15,
    z: 8.98,
    width: 17.9,
    depth: 19.7,
    facingAngle: -Math.PI / 2,
    openByDefault: true,
  },
  {
    id: 'res-31',
    plotCode: 'RES-31',
    blockId: 'block-4-east-parkside',
    address: '20 East Horizon Street',
    x: 95.15,
    z: 94.15,
    width: 17.7,
    depth: 19.7,
    facingAngle: -Math.PI / 2,
  },
  {
    id: 'res-32',
    plotCode: 'RES-32',
    blockId: 'block-4-east-parkside',
    address: '24 East Horizon Street',
    x: 95.15,
    z: 111.85,
    width: 17.7,
    depth: 19.7,
    facingAngle: -Math.PI / 2,
  },
  {
    id: 'res-33',
    plotCode: 'RES-33',
    blockId: 'block-4-east-parkside',
    address: '5 East Parkside Lane',
    x: 113.85,
    z: -8.98,
    width: 17.9,
    depth: 17.7,
    facingAngle: Math.PI / 2,
  },

  // Block 5 (West Horizon & Northcrest) -> 10 plots
  {
    id: 'res-34',
    plotCode: 'RES-34',
    blockId: 'block-5-west-horizon',
    address: '3 West Horizon Lane',
    x: -113.85,
    z: -61.53,
    width: 18.3,
    depth: 17.7,
    facingAngle: -Math.PI / 2,
  },
  {
    id: 'res-35',
    plotCode: 'RES-35',
    blockId: 'block-5-west-horizon',
    address: '7 West Horizon Lane',
    x: -113.85,
    z: -43.21,
    width: 18.3,
    depth: 17.7,
    facingAngle: -Math.PI / 2,
  },
  {
    id: 'res-36',
    plotCode: 'RES-36',
    blockId: 'block-5-west-horizon',
    address: '11 West Horizon Lane',
    x: -113.85,
    z: -8.98,
    width: 17.9,
    depth: 17.7,
    facingAngle: -Math.PI / 2,
  },
  {
    id: 'res-37',
    plotCode: 'RES-37',
    blockId: 'block-5-west-horizon',
    address: '15 West Horizon Lane',
    x: -113.85,
    z: 8.98,
    width: 17.9,
    depth: 17.7,
    facingAngle: -Math.PI / 2,
  },
  {
    id: 'res-38',
    plotCode: 'RES-38',
    blockId: 'block-5-west-horizon',
    address: '19 West Horizon Lane',
    x: -113.85,
    z: 43.21,
    width: 18.3,
    depth: 17.7,
    facingAngle: -Math.PI / 2,
  },
  {
    id: 'res-39',
    plotCode: 'RES-39',
    blockId: 'block-5-west-horizon',
    address: '23 West Horizon Lane',
    x: -113.85,
    z: 61.53,
    width: 18.3,
    depth: 17.7,
    facingAngle: -Math.PI / 2,
    openByDefault: true,
  },
  {
    id: 'res-40',
    plotCode: 'RES-40',
    blockId: 'block-5-west-horizon',
    address: '3 Northcrest Avenue',
    x: -61.53,
    z: -94.45,
    width: 18.3,
    depth: 18.3,
    facingAngle: 0,
  },
  {
    id: 'res-41',
    plotCode: 'RES-41',
    blockId: 'block-5-west-horizon',
    address: '7 Northcrest Avenue',
    x: -43.21,
    z: -94.45,
    width: 18.3,
    depth: 18.3,
    facingAngle: 0,
  },
  {
    id: 'res-42',
    plotCode: 'RES-42',
    blockId: 'block-5-west-horizon',
    address: '23 Northcrest Avenue',
    x: 43.21,
    z: -94.45,
    width: 18.3,
    depth: 18.3,
    facingAngle: 0,
  },
  {
    id: 'res-43',
    plotCode: 'RES-43',
    blockId: 'block-5-west-horizon',
    address: '27 Northcrest Avenue',
    x: 61.53,
    z: -94.45,
    width: 18.3,
    depth: 18.3,
    facingAngle: 0,
    openByDefault: true,
  },
];

const BASE_BLOCK_DEFINITIONS = [
  {
    id: 'block-1-belvedere-west',
    index: 1,
    name: 'Block 1 · Belvedere & Linden West',
    subtitle: 'Central West Luxury Estates & Linden Boulevard Cottages',
    plotIds: [
      'lux-01',
      'lux-02',
      'lux-03',
      'lux-04',
      'res-01',
      'res-02',
      'res-03',
      'res-04',
      'res-10',
      'res-11',
    ],
  },
  {
    id: 'block-2-oakwood-southwest',
    index: 2,
    name: 'Block 2 · Oakwood South-West',
    subtitle: 'Oakwood Way & West Canal Residential Enclave',
    plotIds: [
      'res-05',
      'res-06',
      'res-07',
      'res-08',
      'res-09',
      'res-12',
      'res-13',
      'res-14',
      'res-15',
      'res-16',
    ],
  },
  {
    id: 'block-3-south-meadows',
    index: 3,
    name: 'Block 3 · South Meadows',
    subtitle: 'Dual-Frontage Residential Gardens on South Meadows Way',
    plotIds: [
      'res-17',
      'res-18',
      'res-19',
      'res-20',
      'res-21',
      'res-22',
      'res-23',
      'res-24',
      'res-25',
      'res-26',
    ],
  },
  {
    id: 'block-4-east-parkside',
    index: 4,
    name: 'Block 4 · East Parkside & Horizon',
    subtitle: 'Parkside Terraces along East Horizon Street',
    plotIds: [
      'exp-01',
      'exp-02',
      'exp-06',
      'res-27',
      'res-28',
      'res-29',
      'res-30',
      'res-31',
      'res-32',
      'res-33',
    ],
  },
  {
    id: 'block-5-west-horizon',
    index: 5,
    name: 'Block 5 · West Horizon & Northcrest',
    subtitle: 'West Horizon Lane & Northcrest Avenue Residences',
    plotIds: [
      'res-34',
      'res-35',
      'res-36',
      'res-37',
      'res-38',
      'res-39',
      'res-40',
      'res-41',
      'res-42',
      'res-43',
    ],
  },
];

const CORE_BLOCK_LOOKUP = new Map<string, string>();
for (const blk of BASE_BLOCK_DEFINITIONS) {
  for (const pid of blk.plotIds) {
    CORE_BLOCK_LOOKUP.set(pid, blk.id);
  }
}

/**
 * Generates the unified MasterCityMap across the deterministic 12-stage Urban Planning pipeline.
 */
export function generateMasterCityMap(partialConfig?: Partial<UrbanPlanConfig>): MasterCityMap {
  const config: UrbanPlanConfig = {
    ...DEFAULT_URBAN_PLAN_CONFIG,
    ...partialConfig,
    blockSeeds: {
      ...DEFAULT_URBAN_PLAN_CONFIG.blockSeeds,
      ...(partialConfig?.blockSeeds ?? {}),
    },
  };

  const primaryHalf = config.primaryRoadWidth / 2;
  const secondaryHalf = config.secondaryRoadWidth / 2;
  const sw = config.sidewalkWidth;
  const expansionCols = Math.max(0, Math.min(3, config.expansionBlockCount));
  const westBound = expansionCols > 0 ? -136 - expansionCols * 52 : -136;

  const stages: CityGenerationStageReport[] = [];

  // =========================================================================
  // STAGE 1: CITY BOUNDARY
  // =========================================================================
  const cityBoundary: RectBounds2D = {
    minX: westBound,
    maxX: 140,
    minZ: -116,
    maxZ: 138,
  };
  stages.push({
    stage: 1,
    key: 'city-boundary',
    title: 'City Boundary',
    description: 'Master residential perimeter bounding grid, green buffers & expansion corridor.',
    generatedCount: 1,
    summary: `${(cityBoundary.maxX - cityBoundary.minX).toFixed(0)}m × ${(
      cityBoundary.maxZ - cityBoundary.minZ
    ).toFixed(0)}m`,
    status: 'complete',
  });

  // =========================================================================
  // STAGE 2: MASTER ROAD NETWORK
  // =========================================================================
  const xAxes: Array<{ x: number; half: number; name: string; isPrimary: boolean }> = [];
  for (let exp = expansionCols; exp >= 1; exp--) {
    const xCoord = -130 - exp * 52;
    xAxes.push({
      x: xCoord,
      half: secondaryHalf,
      name: `West Expansion Street ${exp}`,
      isPrimary: false,
    });
  }
  xAxes.push(
    { x: -130, half: secondaryHalf, name: 'West Horizon Lane', isPrimary: false },
    { x: -78, half: secondaryHalf, name: 'West Canal Street', isPrimary: false },
    { x: -26, half: primaryHalf, name: 'West Grand Avenue', isPrimary: true },
    { x: 26, half: primaryHalf, name: 'East Grand Avenue', isPrimary: true },
    { x: 78, half: secondaryHalf, name: 'East Horizon Street', isPrimary: false },
    { x: 130, half: secondaryHalf, name: 'East Parkside Lane', isPrimary: false },
  );

  const zAxes: Array<{ z: number; half: number; name: string; isPrimary: boolean }> = [
    { z: -78, half: secondaryHalf, name: 'North Civic Boulevard', isPrimary: false },
    { z: -26, half: primaryHalf, name: 'Linden Boulevard', isPrimary: true },
    { z: 26, half: primaryHalf, name: 'Oakwood Way', isPrimary: true },
    { z: 78, half: secondaryHalf, name: 'South Expansion Way', isPrimary: false },
    { z: 128, half: secondaryHalf, name: 'South Meadows Way', isPrimary: false },
  ];

  const roads: RoadSegmentSpec[] = [];
  for (const zAxis of zAxes) {
    const width = zAxis.half * 2;
    roads.push({
      id: `ew-${zAxis.z}-wstub`,
      name: zAxis.name,
      start: { x: cityBoundary.minX, z: zAxis.z },
      end: { x: xAxes[0].x - xAxes[0].half, z: zAxis.z },
      width,
      hasDoubleCenterLine: zAxis.isPrimary,
      isStubExtension: true,
    });
    for (let i = 0; i < xAxes.length - 1; i++) {
      const a = xAxes[i];
      const b = xAxes[i + 1];
      roads.push({
        id: `ew-${zAxis.z}-${i}`,
        name: zAxis.name,
        start: { x: a.x + a.half, z: zAxis.z },
        end: { x: b.x - b.half, z: zAxis.z },
        width,
        hasDoubleCenterLine: zAxis.isPrimary,
      });
    }
    roads.push({
      id: `ew-${zAxis.z}-estub`,
      name: zAxis.name,
      start: { x: xAxes[xAxes.length - 1].x + xAxes[xAxes.length - 1].half, z: zAxis.z },
      end: { x: 140, z: zAxis.z },
      width,
      hasDoubleCenterLine: zAxis.isPrimary,
      isStubExtension: true,
    });
  }

  for (const xAxis of xAxes) {
    const width = xAxis.half * 2;
    roads.push({
      id: `ns-${xAxis.x}-nstub`,
      name: xAxis.name,
      start: { x: xAxis.x, z: -130 },
      end: { x: xAxis.x, z: zAxes[0].z - zAxes[0].half },
      width,
      hasDoubleCenterLine: xAxis.isPrimary,
      isStubExtension: true,
    });
    for (let i = 0; i < zAxes.length - 1; i++) {
      const a = zAxes[i];
      const b = zAxes[i + 1];
      roads.push({
        id: `ns-${xAxis.x}-${i}`,
        name: xAxis.name,
        start: { x: xAxis.x, z: a.z + a.half },
        end: { x: xAxis.x, z: b.z - b.half },
        width,
        hasDoubleCenterLine: xAxis.isPrimary,
      });
    }
    roads.push({
      id: `ns-${xAxis.x}-sstub`,
      name: xAxis.name,
      start: { x: xAxis.x, z: zAxes[zAxes.length - 1].z + zAxes[zAxes.length - 1].half },
      end: { x: xAxis.x, z: 138 },
      width,
      hasDoubleCenterLine: xAxis.isPrimary,
      isStubExtension: true,
    });
  }

  const intersections: IntersectionSpec[] = [];
  for (const xAxis of xAxes) {
    for (const zAxis of zAxes) {
      const isCentralCorner = Math.abs(xAxis.x) === 26 && Math.abs(zAxis.z) === 26;
      intersections.push({
        id: `int-${xAxis.x}-${zAxis.z}`,
        center: { x: xAxis.x, z: zAxis.z },
        width: xAxis.half * 2,
        depth: zAxis.half * 2,
        hasTrafficSignal: isCentralCorner,
        crosswalks: ['north', 'south', 'east', 'west'],
      });
    }
  }

  stages.push({
    stage: 2,
    key: 'road-network',
    title: 'Master Road Network',
    description: 'Primary double-lane boulevards & secondary residential street intersections.',
    generatedCount: roads.length + intersections.length,
    summary: `${roads.length} road segments · ${intersections.length} intersections`,
    status: 'complete',
  });

  // =========================================================================
  // STAGE 3 & 4: RESIDENTIAL BLOCK BOUNDARIES + INDIVIDUAL PLOT BOUNDARIES
  // =========================================================================
  const widthScale = config.plannedPlotWidth / DEFAULT_URBAN_PLAN_CONFIG.plannedPlotWidth;
  const depthScale = config.plannedPlotDepth / DEFAULT_URBAN_PLAN_CONFIG.plannedPlotDepth;

  const plots: TownPlot[] = INITIAL_TOWN_PLOTS.map((basePlot) => {
    const blockId = CORE_BLOCK_LOOKUP.get(basePlot.id);
    if (!blockId) return { ...basePlot };

    const seed = config.blockSeeds[blockId] ?? 0;
    const isLuxury = basePlot.category === 'luxury-residential';
    const nextWidth = Number((basePlot.width * widthScale).toFixed(2));
    const nextDepth = Number((basePlot.depth * depthScale).toFixed(2));

    let house = basePlot.house;
    let gardenTrees = basePlot.gardenTrees;
    if (seed > 0) {
      house = basePlot.house || basePlot.ownershipStatus === 'occupied'
        ? buildDeterministicHouse(basePlot.id, seed, isLuxury)
        : null;
      gardenTrees = buildDeterministicGardenTrees(basePlot.id, nextWidth, nextDepth, seed);
    }

    return {
      ...basePlot,
      width: nextWidth,
      depth: nextDepth,
      house,
      gardenTrees,
    };
  });

  // Add the 28 new planned residential plots across Blocks 2–5
  for (const p of PLANNED_EXTENSION_RESIDENTIAL_PLOTS) {
    const seed = config.blockSeeds[p.blockId] ?? 0;
    const scaledW = Number((p.width * widthScale).toFixed(2));
    const scaledD = Number((p.depth * depthScale).toFixed(2));
    const shouldHaveHouse = !p.openByDefault || seed > 0;
    plots.push({
      id: p.id,
      plotCode: p.plotCode,
      districtId: 'district-1-residential',
      address: p.address,
      category: 'residential',
      center: { x: p.x, z: p.z },
      width: scaledW,
      depth: scaledD,
      facingAngle: p.facingAngle,
      ownershipStatus: shouldHaveHouse ? 'occupied' : 'available',
      ownerUsername: null,
      verificationState: shouldHaveHouse ? 'verified-community' : 'none',
      claimedAt: shouldHaveHouse ? '2026-08-01' : null,
      upgradeLevel: 1,
      house: shouldHaveHouse ? buildDeterministicHouse(p.id, seed, false) : null,
      gardenTrees: buildDeterministicGardenTrees(p.id, scaledW, scaledD, seed),
      business: null,
      publicBuilding: null,
    });
  }

  // Add Expansion Residential Blocks (Stage 3/4 dynamic city growth in West corridor [-270..-138])
  const expansionBlockDefs: Array<{
    id: string;
    index: number;
    name: string;
    subtitle: string;
    plotIds: string[];
  }> = [];

  for (let exp = 1; exp <= expansionCols; exp++) {
    const blockId = `block-exp-${exp}`;
    const seed = config.blockSeeds[blockId] ?? exp;
    const roadX = -130 - exp * 52; // -182, -234, -286...
    const prevRoadX = -130 - (exp - 1) * 52;
    const eastRowX = prevRoadX - secondaryHalf - sw - 8.85;
    const westRowX = roadX + secondaryHalf + sw + 8.85;
    const zSlots = [-61.53, -43.21, -8.98, 8.98, 43.21, 61.53];
    const plotIds: string[] = [];

    zSlots.forEach((zPos, zi) => {
      const scaledW = Number((17.9 * widthScale).toFixed(2));
      const scaledD = Number((17.7 * depthScale).toFixed(2));

      const pidE = `exp-blk${exp}-e${zi + 1}`;
      plotIds.push(pidE);
      plots.push({
        id: pidE,
        plotCode: `EXB-${exp}E${zi + 1}`,
        districtId: 'district-1-residential',
        address: `${10 + zi * 4} West Horizon Annex ${exp}`,
        category: 'residential',
        center: { x: eastRowX, z: zPos },
        width: scaledW,
        depth: scaledD,
        facingAngle: Math.PI / 2,
        ownershipStatus: zi % 4 === 3 ? 'available' : 'occupied',
        ownerUsername: null,
        verificationState: zi % 4 === 3 ? 'none' : 'verified-community',
        claimedAt: zi % 4 === 3 ? null : '2026-09-01',
        upgradeLevel: 1,
        house: zi % 4 === 3 && seed === exp ? null : buildDeterministicHouse(pidE, seed, false),
        gardenTrees: buildDeterministicGardenTrees(pidE, scaledW, scaledD, seed),
        business: null,
        publicBuilding: null,
      });

      const pidW = `exp-blk${exp}-w${zi + 1}`;
      plotIds.push(pidW);
      plots.push({
        id: pidW,
        plotCode: `EXB-${exp}W${zi + 1}`,
        districtId: 'district-1-residential',
        address: `${12 + zi * 4} West Expansion Street ${exp}`,
        category: 'residential',
        center: { x: westRowX, z: zPos },
        width: scaledW,
        depth: scaledD,
        facingAngle: -Math.PI / 2,
        ownershipStatus: zi % 5 === 4 ? 'available' : 'occupied',
        ownerUsername: null,
        verificationState: zi % 5 === 4 ? 'none' : 'verified-community',
        claimedAt: zi % 5 === 4 ? null : '2026-09-01',
        upgradeLevel: 1,
        house: zi % 5 === 4 && seed === exp ? null : buildDeterministicHouse(pidW, seed, false),
        gardenTrees: buildDeterministicGardenTrees(pidW, scaledW, scaledD, seed),
        business: null,
        publicBuilding: null,
      });
    });

    expansionBlockDefs.push({
      id: blockId,
      index: 5 + exp,
      name: `Block ${5 + exp} · West Expansion Terrace ${exp}`,
      subtitle: `Connected Residential Expansion Grid (${plotIds.length} Plots)`,
      plotIds,
    });
  }

  const plotMap = new Map(plots.map((p) => [p.id, p]));
  const residentialBlocks: PlannedResidentialBlock[] = [
    ...BASE_BLOCK_DEFINITIONS.map((b) => ({ ...b, isExpansionBlock: false })),
    ...expansionBlockDefs.map((b) => ({ ...b, isExpansionBlock: true })),
  ].map((def) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const pid of def.plotIds) {
      const p = plotMap.get(pid);
      if (!p) continue;
      const b = getPlotWorldBounds(p);
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minZ = Math.min(minZ, b.minZ);
      maxZ = Math.max(maxZ, b.maxZ);
    }
    if (!Number.isFinite(minX)) {
      minX = -10;
      maxX = 10;
      minZ = -10;
      maxZ = 10;
    }
    return {
      id: def.id,
      index: def.index,
      name: def.name,
      subtitle: def.subtitle,
      isExpansionBlock: def.isExpansionBlock,
      seed: config.blockSeeds[def.id] ?? 0,
      bounds: { minX, maxX, minZ, maxZ },
      center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
      boundingRoadIds: [],
      plotIds: def.plotIds,
    };
  });

  const plannedResidentialCount = residentialBlocks.reduce((acc, b) => acc + b.plotIds.length, 0);

  stages.push({
    stage: 3,
    key: 'residential-blocks',
    title: 'Residential Block Boundaries',
    description: 'Organized multi-plot residential neighborhoods framed by street corridors.',
    generatedCount: residentialBlocks.length,
    summary: `${residentialBlocks.length} residential blocks (${5} core + ${expansionCols} expansion)`,
    status: 'complete',
  });

  stages.push({
    stage: 4,
    key: 'plot-boundaries',
    title: 'Individual Plot Boundaries',
    description: 'Non-overlapping parcel footprints with unique plot IDs & cardinal orientations.',
    generatedCount: plannedResidentialCount,
    summary: `${plannedResidentialCount} residential plots · ${plots.length} total town parcels`,
    status: 'complete',
  });

  // =========================================================================
  // STAGE 5: SIDEWALKS AND PEDESTRIAN CONNECTIONS
  // =========================================================================
  const sidewalks: SidewalkPadSpec[] = [];
  for (let xi = 0; xi < xAxes.length - 1; xi++) {
    const left = xAxes[xi];
    const right = xAxes[xi + 1];
    const minX = left.x + left.half;
    const maxX = right.x - right.half;
    const w = maxX - minX;
    const cx = (minX + maxX) / 2;
    if (w <= sw * 2) continue;

    for (let zi = 0; zi < zAxes.length - 1; zi++) {
      const top = zAxes[zi];
      const bot = zAxes[zi + 1];
      const minZ = top.z + top.half;
      const maxZ = bot.z - bot.half;
      const d = maxZ - minZ;
      const cz = (minZ + maxZ) / 2;
      if (d <= sw * 2) continue;

      sidewalks.push({ id: `sw-${xi}-${zi}-n`, x: cx, z: minZ + sw / 2, width: w, depth: sw });
      sidewalks.push({ id: `sw-${xi}-${zi}-s`, x: cx, z: maxZ - sw / 2, width: w, depth: sw });
      sidewalks.push({
        id: `sw-${xi}-${zi}-w`,
        x: minX + sw / 2,
        z: cz,
        width: sw,
        depth: d - sw * 2,
      });
      sidewalks.push({
        id: `sw-${xi}-${zi}-e`,
        x: maxX - sw / 2,
        z: cz,
        width: sw,
        depth: d - sw * 2,
      });
    }
  }

  // Northcrest outer sidewalks along Z = -78 north edge (-103..103)
  const northRoadEdge = -78 - secondaryHalf;
  sidewalks.push({
    id: 'sw-north-w',
    x: -52.375,
    z: northRoadEdge - sw / 2,
    width: 42.25,
    depth: sw,
  });
  sidewalks.push({
    id: 'sw-north-e',
    x: 52.375,
    z: northRoadEdge - sw / 2,
    width: 42.25,
    depth: sw,
  });
  // West/East outer strip sidewalks beyond X = ±130
  sidewalks.push({
    id: 'sw-outer-far-w',
    x: xAxes[0].x - xAxes[0].half - sw / 2,
    z: 0,
    width: sw,
    depth: 147,
  });
  sidewalks.push({
    id: 'sw-outer-far-e',
    x: xAxes[xAxes.length - 1].x + xAxes[xAxes.length - 1].half + sw / 2,
    z: 0,
    width: sw,
    depth: 147,
  });

  stages.push({
    stage: 5,
    key: 'sidewalks',
    title: 'Sidewalks & Pedestrian Connections',
    description: 'Continuous block perimeter sidewalks and crosswalk junction connectors.',
    generatedCount: sidewalks.length,
    summary: `${sidewalks.length} sidewalk segments (${sw.toFixed(1)}m wide)`,
    status: 'complete',
  });

  // =========================================================================
  // STAGE 6: CENTRAL PARK & GREEN BELTS
  // =========================================================================
  const centralPark = {
    bounds: { minX: 34.05, maxX: 70.7, minZ: -17.95, maxZ: 17.95 },
    fountain: { x: 42.2, z: -1.0 },
    lakeBounds: { minX: 50.1, maxX: 65.9, minZ: -13.8, maxZ: -3.2 },
    playgrounds: [
      { id: 'playground-alpha', name: 'Playground Alpha (Tower & Swings)', x: 41.5, z: 10.6 },
      { id: 'playground-beta', name: 'Playground Beta (Slides & Dome)', x: 60.5, z: 11.4 },
    ],
    pedestrianConnections: [
      { id: 'park-conn-n', x: 48.6, z: -17.95, connectsTo: 'Linden Boulevard Sidewalk' },
      { id: 'park-conn-s', x: 48.6, z: 17.95, connectsTo: 'Oakwood Way Sidewalk' },
      { id: 'park-conn-w', x: 34.05, z: -1.0, connectsTo: 'East Grand Avenue Sidewalk' },
      { id: 'park-conn-e', x: 70.7, z: -1.0, connectsTo: 'East Horizon Street Sidewalk' },
    ],
  };

  const greenBelts: PlannedGreenBelt[] = [
    { id: 'gb-north-west', name: 'Northcrest Green Buffer', bounds: { minX: -120, maxX: -86, minZ: -112, maxZ: -86 } },
    { id: 'gb-north-east', name: 'East Parkland Buffer', bounds: { minX: 86, maxX: 120, minZ: -112, maxZ: -86 } },
    { id: 'gb-south-buffer', name: 'South Meadows Green Belt', bounds: { minX: -120, maxX: 120, minZ: 133, maxZ: 140 } },
  ];

  stages.push({
    stage: 6,
    key: 'central-park',
    title: 'Central Park',
    description: 'Central fountain, dual playgrounds, lakeside pathways & green belt connectors.',
    generatedCount: 1 + greenBelts.length + centralPark.pedestrianConnections.length,
    summary: 'Fountain, 2 playgrounds, 4 sidewalk entries, 3 green belts',
    status: 'complete',
  });

  // =========================================================================
  // STAGE 7, 8, 9: HOUSES & GARAGES, DRIVEWAYS & PATHWAYS, FENCES & GATES
  // =========================================================================
  const plannedPlotGeometries: PlannedPlotGeometry[] = [];
  const plotGeometryById: Record<string, PlannedPlotGeometry> = {};
  const plotToBlockMap = new Map<string, PlannedResidentialBlock>();
  for (const blk of residentialBlocks) {
    for (const pid of blk.plotIds) plotToBlockMap.set(pid, blk);
  }

  let houseCount = 0;
  let garageCount = 0;

  for (const plot of plots) {
    const blk = plotToBlockMap.get(plot.id);
    if (!blk) continue;

    if (plot.house) houseCount++;
    if (plot.house?.hasGarageCarport) garageCount++;

    const m = getPlotInfrastructureMetrics(plot);
    const sin = Math.sin(plot.facingAngle);
    const cos = Math.cos(plot.facingAngle);
    const toWorld = (lx: number, lz: number) => ({
      x: Number((plot.center.x + lx * cos + lz * sin).toFixed(2)),
      z: Number((plot.center.z - lx * sin + lz * cos).toFixed(2)),
    });

    const houseCoords = toWorld(m.houseLocalX, m.houseLocalZ);
    const garageCoords = plot.house?.hasGarageCarport
      ? toWorld(m.houseLocalX + plot.house.width / 2 + 1.35, m.houseLocalZ + 0.4)
      : null;

    const drivewayStart = toWorld(m.drivewayX, 1.0);
    const drivewayEnd = toWorld(m.drivewayX, m.halfD + 2.75);
    const pathStart = toWorld(m.pathX, m.pathStartZ);
    const pathEnd = toWorld(m.pathX, m.halfD + 0.9);
    const pedGate = toWorld(m.pathX, m.halfD - 0.28);
    const driveGate = toWorld(m.drivewayX, m.halfD - 0.28);

    const nearestRoad = findNearestRoadForPoint(drivewayEnd.x, drivewayEnd.z, roads);
    const nearestSidewalk = findNearestSidewalkForPoint(pathEnd.x, pathEnd.z, sidewalks);

    if (nearestRoad.road && !blk.boundingRoadIds.includes(nearestRoad.road.id)) {
      blk.boundingRoadIds.push(nearestRoad.road.id);
    }

    const houseDepth = plot.house?.depth ?? 7.8;
    const frontYardDepth = Number(Math.max(1.5, m.halfD - (m.houseLocalZ + houseDepth / 2)).toFixed(2));
    const backYardDepth = Number(Math.max(1.5, m.halfD + (m.houseLocalZ - houseDepth / 2)).toFixed(2));
    const bounds = getPlotWorldBounds(plot);

    const geom: PlannedPlotGeometry = {
      plotId: plot.id,
      plotCode: plot.plotCode,
      blockId: blk.id,
      bounds,
      center: { ...plot.center },
      width: plot.width,
      depth: plot.depth,
      houseCoords,
      houseRotation: plot.facingAngle,
      frontDirection: facingAngleToDirection(plot.facingAngle),
      frontYardDepth,
      backYardDepth,
      garageCoords,
      drivewaySegment: {
        startX: drivewayStart.x,
        startZ: drivewayStart.z,
        endX: drivewayEnd.x,
        endZ: drivewayEnd.z,
        width: config.drivewayWidth,
        connectedRoadId: nearestRoad.road?.id ?? null,
        connectedRoadEdgeDist: Number(nearestRoad.edgeDistance.toFixed(2)),
      },
      pedestrianPathSegment: {
        startX: pathStart.x,
        startZ: pathStart.z,
        endX: pathEnd.x,
        endZ: pathEnd.z,
        width: config.pathwayWidth,
        connectedSidewalkId: nearestSidewalk.sidewalk?.id ?? null,
        connectedSidewalkDist: Number(nearestSidewalk.distance.toFixed(2)),
      },
      fenceBounds: {
        minX: bounds.minX + 0.28,
        maxX: bounds.maxX - 0.28,
        minZ: bounds.minZ + 0.28,
        maxZ: bounds.maxZ - 0.28,
      },
      gateOpenings: {
        pedestrianX: pedGate.x,
        pedestrianZ: pedGate.z,
        drivewayX: driveGate.x,
        drivewayZ: driveGate.z,
      },
      connectedRoadId: nearestRoad.road?.id ?? null,
      connectedRoadName: nearestRoad.road?.name ?? null,
    };

    plannedPlotGeometries.push(geom);
    plotGeometryById[plot.id] = geom;
  }

  stages.push({
    stage: 7,
    key: 'houses-garages',
    title: 'Houses & Garages',
    description: 'Placed residential architecture with front-facing alignment & garage bays.',
    generatedCount: houseCount,
    summary: `${houseCount} houses · ${garageCount} garages`,
    status: 'complete',
  });

  stages.push({
    stage: 8,
    key: 'driveways-pathways',
    title: 'Driveways & Pathways',
    description: 'Curb-connected driveways and front entrance walkways linked to sidewalks.',
    generatedCount: plannedPlotGeometries.length * 2,
    summary: `${plannedPlotGeometries.length} driveways · ${plannedPlotGeometries.length} walkways`,
    status: 'complete',
  });

  stages.push({
    stage: 9,
    key: 'fences-gates',
    title: 'Fences & Gates',
    description: 'Property boundary enclosures with non-blocking pedestrian & driveway openings.',
    generatedCount: plannedPlotGeometries.length,
    summary: `${plannedPlotGeometries.length} enclosed lots with dual gate openings`,
    status: 'complete',
  });

  // =========================================================================
  // STAGE 11 FIRST FOR CLEARANCE: STREETLIGHTS & STREET FURNITURE
  // =========================================================================
  const streetLamps: PlannedStreetLampSpec[] = [];
  const lampKeySet = new Set<string>();
  const addLamp = (x: number, z: number, rotationY: number, roadId: string) => {
    const key = `${Math.round(x * 2)}:${Math.round(z * 2)}`;
    if (lampKeySet.has(key)) return;
    // Keep lamps outside intersections & plots
    for (const inter of intersections) {
      if (
        Math.abs(x - inter.center.x) <= inter.width / 2 + 1.8 &&
        Math.abs(z - inter.center.z) <= inter.depth / 2 + 1.8
      ) {
        return;
      }
    }
    for (const plot of plots) {
      const b = getPlotWorldBounds(plot);
      if (x >= b.minX + 0.1 && x <= b.maxX - 0.1 && z >= b.minZ + 0.1 && z <= b.maxZ - 0.1) {
        return;
      }
    }
    lampKeySet.add(key);
    streetLamps.push({ id: `lamp-${streetLamps.length}`, x, z, rotationY, roadId });
  };

  for (const seg of roads) {
    if (seg.isStubExtension) continue;
    const dx = seg.end.x - seg.start.x;
    const dz = seg.end.z - seg.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 14) continue;
    const isEW = Math.abs(dx) >= Math.abs(dz);
    const offset = seg.width / 2 + 0.85;
    const count = Math.max(2, Math.floor(len / 18));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const px = seg.start.x + dx * t;
      const pz = seg.start.z + dz * t;
      const side = i % 2 === 0 ? 1 : -1;
      if (isEW) {
        addLamp(px, pz + side * offset, side > 0 ? Math.PI : 0, seg.id);
      } else {
        addLamp(px + side * offset, pz, side > 0 ? -Math.PI / 2 : Math.PI / 2, seg.id);
      }
    }
  }

  const benches: PlannedBenchSpec[] = TOWN_BENCHES.map((b) => ({
    id: b.id,
    x: b.x,
    y: b.y,
    z: b.z,
    rotationY: b.rotationY,
    zone: b.id.includes('park') ? 'Central Park' : 'Central Square',
  }));

  // =========================================================================
  // STAGE 10: TREES AND LANDSCAPING (STRICTLY ROAD/PLOT/DRIVEWAY VALIDATED)
  // =========================================================================
  const roadsideTrees: PlacedTreeSpec[] = [];
  const roadsideBushes: Array<{ x: number; z: number; sx: number; sy: number; sz: number; tint: string }> = [];
  const spacing = Math.max(7.5, config.treeSpacing);

  const tryPlaceRoadsideTree = (
    x: number,
    z: number,
    hasPit: boolean,
    zone: PlacedTreeSpec['zone'],
    parentId: string,
  ) => {
    if (!isPointClearOfMasterRoads(x, z, roads, intersections, streetLamps, 1.8, 3.8)) return;
    if (!isPointClearOfMasterPlots(x, z, plots, 1.35)) return;
    for (const t of roadsideTrees) {
      if (Math.hypot(x - t.x, z - t.z) < 4.6) return;
    }
    const idx = roadsideTrees.length;
    const variant = idx % 5 === 0 ? 'cypress' : idx % 3 === 0 ? 'ornamental' : 'broadleaf';
    roadsideTrees.push({
      id: `rtree-${idx}`,
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
      scale: Number((0.92 + (idx % 4) * 0.08).toFixed(2)),
      variant,
      rotationY: (idx * 1.1) % (Math.PI * 2),
      hasPit,
      zone,
      parentId,
    });
  };

  // Perimeter green-belt rows outside the residential rings
  for (const zLine of [-110, 136]) {
    for (let x = cityBoundary.minX + 10; x <= 126; x += spacing) {
      if (zLine < -85 && Math.abs(x) < 34) continue;
      tryPlaceRoadsideTree(x, zLine, false, 'green-belt', `gb-${zLine}`);
    }
  }

  for (const xLine of [xAxes[0].x - secondaryHalf - sw - 5.2, 138]) {
    for (let z = -70; z <= 70; z += spacing) {
      tryPlaceRoadsideTree(xLine, z, false, 'green-belt', `gb-x-${xLine}`);
    }
  }

  // Street-side landscaped tree pits inside block borders clear of driveways & plots
  const candidatePitSpots: Array<[number, number]> = [
    [-72.0, -52],
    [-72.0, 52],
    [-52, -72.0],
    [52, -72.0],
    [-52, 72.0],
    [52, 72.0],
    [72.0, 52],
    [32.2, -52],
    [32.2, 52],
    [-32.2, -52],
    [-32.2, 52],
  ];
  for (const [sx, sz] of candidatePitSpots) {
    tryPlaceRoadsideTree(sx, sz, true, 'roadside', 'core-sidewalk');
  }

  stages.push({
    stage: 10,
    key: 'trees-landscaping',
    title: 'Trees & Landscaping',
    description: 'Road-aware green-belt & sidewalk tree alignment with exclusion zones.',
    generatedCount: roadsideTrees.length + roadsideBushes.length,
    summary: `${roadsideTrees.length} validated roadside/greenbelt trees`,
    status: 'complete',
  });

  stages.push({
    stage: 11,
    key: 'streetlights-furniture',
    title: 'Streetlights & Street Furniture',
    description: 'Road-aligned streetlamps, park benches & civic promenade seating.',
    generatedCount: streetLamps.length + benches.length,
    summary: `${streetLamps.length} streetlamps · ${benches.length} benches`,
    status: 'complete',
  });

  // =========================================================================
  // STAGE 12: ENVIRONMENTAL DETAILS, OBJECT REGISTRY & VALIDATION
  // =========================================================================
  const objects: PlannedObjectRecord[] = [];
  for (const geom of plannedPlotGeometries) {
    const plot = plotMap.get(geom.plotId);
    if (plot?.house) {
      objects.push({
        id: `obj-house-${plot.id}`,
        kind: 'house',
        label: `${plot.plotCode} House`,
        x: geom.houseCoords.x,
        z: geom.houseCoords.z,
        width: plot.house.width,
        depth: plot.house.depth,
        rotation: geom.houseRotation,
        plotId: plot.id,
        blockId: geom.blockId,
      });
    }
    if (geom.garageCoords) {
      objects.push({
        id: `obj-garage-${geom.plotId}`,
        kind: 'garage',
        label: `${geom.plotCode} Garage`,
        x: geom.garageCoords.x,
        z: geom.garageCoords.z,
        width: 3.1,
        depth: 4.8,
        rotation: geom.houseRotation,
        plotId: geom.plotId,
        blockId: geom.blockId,
      });
    }
    objects.push({
      id: `obj-driveway-${geom.plotId}`,
      kind: 'driveway',
      label: `${geom.plotCode} Driveway`,
      x: (geom.drivewaySegment.startX + geom.drivewaySegment.endX) / 2,
      z: (geom.drivewaySegment.startZ + geom.drivewaySegment.endZ) / 2,
      width: geom.drivewaySegment.width,
      depth: Math.hypot(
        geom.drivewaySegment.endX - geom.drivewaySegment.startX,
        geom.drivewaySegment.endZ - geom.drivewaySegment.startZ,
      ),
      rotation: geom.houseRotation,
      plotId: geom.plotId,
      blockId: geom.blockId,
    });
  }
  for (const t of roadsideTrees) {
    objects.push({
      id: t.id,
      kind: 'tree',
      label: `${t.variant} tree`,
      x: t.x,
      z: t.z,
      width: 2.8 * t.scale,
      depth: 2.8 * t.scale,
      rotation: t.rotationY,
    });
  }
  for (const l of streetLamps) {
    objects.push({
      id: l.id,
      kind: 'lamp',
      label: 'Streetlamp',
      x: l.x,
      z: l.z,
      width: 0.6,
      depth: 0.6,
      rotation: l.rotationY,
    });
  }
  for (const b of benches) {
    objects.push({
      id: b.id,
      kind: 'bench',
      label: `Bench (${b.zone})`,
      x: b.x,
      z: b.z,
      width: 1.9,
      depth: 0.75,
      rotation: b.rotationY,
    });
  }
  objects.push({
    id: 'obj-park-fountain',
    kind: 'fountain',
    label: 'Central Park Fountain',
    x: centralPark.fountain.x,
    z: centralPark.fountain.z,
    width: 8.5,
    depth: 8.5,
    rotation: 0,
  });
  for (const pg of centralPark.playgrounds) {
    objects.push({
      id: pg.id,
      kind: 'playground',
      label: pg.name,
      x: pg.x,
      z: pg.z,
      width: 9.0,
      depth: 7.5,
      rotation: 0,
    });
  }

  const draftMap: Omit<MasterCityMap, 'validation'> = {
    config,
    cityBoundary,
    districts: DISTRICTS,
    roads,
    intersections,
    sidewalks,
    centralPark,
    greenBelts,
    residentialBlocks,
    plots,
    plannedPlotGeometries,
    plotGeometryById,
    streetLamps,
    benches,
    roadsideTrees,
    roadsideBushes,
    objects,
    stages,
  };

  const validation = validateMasterCityMap(draftMap);

  stages.push({
    stage: 12,
    key: 'environmental-validation',
    title: 'Environmental Details & Validation',
    description: 'Animated fountains, traffic loops, bird sound zones & overlap verification.',
    generatedCount: objects.length,
    summary: validation.isValid
      ? `0 overlaps · ${objects.length} objects verified`
      : `${validation.errorCount} overlap error(s) · ${validation.warningCount} warning(s)`,
    status: validation.isValid ? 'complete' : 'warning',
  });

  return {
    ...draftMap,
    validation,
  };
}
