import * as THREE from 'three';
import { DistrictId, HouseArchetype, HouseStyleSpec } from '../types';
import {
  BusStopSpec,
  CrosswalkSpec,
  CurvedRoadSplineSpec,
  DistrictParkSpec,
  ExpansionBridgeSpec,
  ExpansionCanalSpec,
  ExpansionDistrictId,
  ExpansionDistrictZone,
  ExpansionLandmarkSpec,
  ExpansionPlotSpec,
  ExpansionRoadSpec,
  FollowerRecord,
  OgPocketGardenSpec,
  RoundaboutSpec,
} from './types';

export interface ExpansionSpatialIndex {
  cellSize: number;
  buckets: Map<string, ExpansionPlotSpec[]>;
}

export interface ExpansionCityWorld {
  plots: ExpansionPlotSpec[];
  plotById: Map<string, ExpansionPlotSpec>;
  plotByUsernameKey: Map<string, ExpansionPlotSpec>;
  ogPlots: ExpansionPlotSpec[];
  vipPlot: ExpansionPlotSpec | null;
  monumentPosition: { x: number; z: number };
  roads: ExpansionRoadSpec[];
  curvyRoadSegments: ExpansionRoadSpec[];
  curvedRoads: CurvedRoadSplineSpec[];
  roundabouts: RoundaboutSpec[];
  ogPocketGardens: OgPocketGardenSpec[];
  canals: ExpansionCanalSpec[];
  bridges: ExpansionBridgeSpec[];
  districtParks: DistrictParkSpec[];
  busStops: BusStopSpec[];
  crosswalks: CrosswalkSpec[];
  sidewalks: Array<{ id: string; x: number; z: number; width: number; depth: number }>;
  lamps: Array<{ id: string; x: number; z: number; rotY: number }>;
  benches: Array<{ id: string; x: number; z: number; rotY: number }>;
  districts: ExpansionDistrictZone[];
  landmarks: ExpansionLandmarkSpec[];
  spatialIndex: ExpansionSpatialIndex;
  counts: {
    totalExpansionPlots: number;
    ogCount: number;
    residentHouseCount: number;
    openExpansionCount: number;
  };
}

export const EXPANSION_LANDMARKS: ExpansionLandmarkSpec[] = [
  {
    id: 'lm-vip-palace',
    title: 'Sweet_thedevil Royal Estate (VIP #1)',
    subtitle: 'Most prestigious central mansion honoring #1 Community VIP @sweet_thedevil',
    category: 'vip-palace',
    x: 0,
    z: -214,
    radius: 28,
  },
  {
    id: 'lm-og-monument',
    title: 'OG 50 Founders Recognition Monument',
    subtitle: 'Marble & gold memorial wall honoring Sweet_thedevil and all 50 OG Members',
    category: 'monument',
    x: 0,
    z: -158,
    radius: 16,
  },
  {
    id: 'lm-botanical',
    title: 'Grand Central Park & Botanical Conservatory',
    subtitle: 'Heart of Lindenhof: glass conservatory, floral parterres, lawns & cycling paths',
    category: 'botanical',
    x: 236,
    z: 0,
    radius: 36,
  },
  {
    id: 'lm-waterfront',
    title: 'Grand Lindenhof Lake & Venetian Lagoon',
    subtitle: '3D animated waterfront lake, scenic island, arched bridges & moored gondolas',
    category: 'waterfront',
    x: 420,
    z: 0,
    radius: 38,
  },
  {
    id: 'lm-expansion',
    title: 'Central Gardens Rotunda & Plaza',
    subtitle: 'Heart of the southern residential districts with floral rotunda and promenade paths',
    category: 'expansion',
    x: 160,
    z: 332,
    radius: 32,
  },
];

export const EXPANSION_DISTRICTS: ExpansionDistrictZone[] = [
  {
    id: 'og-premium-district',
    name: 'OG Villas Royal Quarter',
    subtitle: 'Sweet_thedevil Royal Estate, 49 OG Luxury Villas & Crescent Gardens',
    color: '#f59e0b',
    center: { x: 0, z: -232 },
    bounds: { minX: -252, maxX: 252, minZ: -336, maxZ: -136 },
  },
  {
    id: 'botanical-gardens',
    name: 'Grand Central Park (West)',
    subtitle: 'Victorian Conservatory, Playgrounds, Floral Parterres & 3D Grass Lawns',
    color: '#10b981',
    center: { x: 236, z: 0 },
    bounds: { minX: 148, maxX: 326, minZ: -132, maxZ: 132 },
  },
  {
    id: 'waterfront-lake-district',
    name: 'Grand Central Lake & Venice Lagoon',
    subtitle: '3D Animated Lake, Arched Bridges, Garden Island & Gondola Mooring',
    color: '#38bdf8',
    center: { x: 446, z: 0 },
    bounds: { minX: 326, maxX: 568, minZ: -136, maxZ: 136 },
  },
  {
    id: 'oakwood-district',
    name: 'Oakwood District',
    subtitle: 'Timber-accented family avenues, curving pine terraces & Oakwood Pavilion Park',
    architecturalTheme: 'Warm European timber gables, stone foundations & woodland hedges',
    color: '#a78bfa',
    center: { x: -610, z: -410 },
    bounds: { minX: -1040, maxX: -286, minZ: -780, maxZ: -138 },
    targetCapacity: 500,
  },
  {
    id: 'riverside-district',
    name: 'Riverside District',
    subtitle: 'San Marco canalfront villas, winding promenades & Riverside Rose Park',
    architecturalTheme: 'Airy stucco facades, veranda porches & canalfront flower gardens',
    color: '#38bdf8',
    center: { x: -640, z: 45 },
    bounds: { minX: -1085, maxX: -286, minZ: -130, maxZ: 265 },
    targetCapacity: 500,
  },
  {
    id: 'maplewood-district',
    name: 'Maplewood District',
    subtitle: 'Autumn-hued residential crescents, courtyard villas & Maplewood Reflection Park',
    architecturalTheme: 'Warm brick, terracotta & sage suburban two-storey residences',
    color: '#f97316',
    center: { x: -610, z: 500 },
    bounds: { minX: -1020, maxX: -286, minZ: 265, maxZ: 790 },
    targetCapacity: 500,
  },
  {
    id: 'highland-district',
    name: 'Highland District',
    subtitle: 'Elevated northern curves, hillside family homes & Highland Lily Pond Park',
    architecturalTheme: 'Slate roofs, steep alpine dormers & limestone garden walls',
    color: '#fb7185',
    center: { x: 160, z: -565 },
    bounds: { minX: -252, maxX: 568, minZ: -790, maxZ: -368 },
    targetCapacity: 500,
  },
  {
    id: 'lakeside-district',
    name: 'Lakeside District',
    subtitle: 'Eastern waterfront curves overlooking the lagoon & Lakeside Meadow Park',
    architecturalTheme: 'Contemporary glass-balcony villas, minimalist terraces & cedar trim',
    color: '#2dd4bf',
    center: { x: 820, z: -120 },
    bounds: { minX: 602, maxX: 1090, minZ: -700, maxZ: 275 },
    targetCapacity: 500,
  },
  {
    id: 'central-gardens',
    name: 'Central Gardens',
    subtitle: 'Symmetric garden crescents, central floral rotunda & family boulevards',
    architecturalTheme: 'Balanced classic & modern residences framed by manicured lawns',
    color: '#34d399',
    center: { x: 160, z: 342 },
    bounds: { minX: -252, maxX: 568, minZ: 180, maxZ: 505 },
    targetCapacity: 500,
  },
  {
    id: 'greenfield-district',
    name: 'Greenfield District',
    subtitle: 'Sweeping southern parkways, family orchards & Greenfield Meadow Park',
    architecturalTheme: 'Sunlit modern family cottages, wide driveways & orchard greens',
    color: '#84cc16',
    center: { x: 350, z: 590 },
    bounds: { minX: -252, maxX: 1060, minZ: 275, maxZ: 790 },
    targetCapacity: 500,
  },
];

// Curated European & Residential architectural palettes
const WALL_PALETTES = [
  '#f3ebd8', '#e7dcc8', '#d9d4cb', '#edd7b4', '#f4f4f1', '#ebe1cc',
  '#ded6c6', '#e6cfb3', '#d8c3a5', '#eae7dc', '#cfdbd5', '#f2e8cf',
  '#e9d8a6', '#d6ccc2', '#f5ebe0', '#e3d5ca', '#dde5b6', '#cad2c5',
  '#f0efeb', '#e0afa0', '#d8e2dc', '#f6ecd9', '#faedcd', '#b5634b',
  '#c9ada7', '#cbd5e1',
];

const VILLA_WALL_PALETTES = [
  '#f8f1e4', '#f3e7d3', '#efe6d8', '#faf6ee', '#eadbc6', '#e6d7be',
  '#f4e2ce', '#e4e8e1', '#efe2d0', '#f6eee0',
];

const VILLA_ROOF_PALETTES = [
  '#a95136', '#98472f', '#b45c3c', '#3c4552', '#8c422c', '#455161',
];

const ROOF_PALETTES = [
  '#9c4b34', '#3d434c', '#48505c', '#2d333b', '#b05c3d', '#2e333b',
  '#8d412e', '#5c3c31', '#414954', '#7f4f24', '#3a4f41', '#4a5568',
  '#6b3e2e', '#2b3a4a', '#9b4d38', '#4f5d75',
];

const TRIM_PALETTES = [
  '#f1ede4', '#4a3525', '#32373e', '#f6efe4', '#d7cab2', '#2c3138',
  '#e5e0d5', '#3f2c1f', '#dfd8cc', '#4b5563',
];

const ACCENT_PALETTES = [
  '#6d4c35', '#2d3748', '#7b8b72', '#a9774d', '#7c5338', '#a67b52',
  '#5c7288', '#8c3b32', '#3d6347', '#4a6fa5', '#9c6644', '#6b705c',
];

const SHUTTER_PALETTES = [
  '#3f5d47', '#253948', '#69816e', '#32373e', '#4c6d63', '#6d352c',
  '#546b82', '#3b4f5c', '#744c3b', '#354b44',
];

const GARDEN_TINTS = ['#e06c75', '#e5c07b', '#c678dd', '#61afef', '#f472b6', '#fb923c'];

const RESIDENTIAL_ARCHETYPES: HouseArchetype[] = [
  'modern-family',
  'suburban-two-storey',
  'contemporary-villa',
  'traditional-home',
  'modern-minimalist',
  'premium-residence',
];

// All 49 OG Members upgraded cleanly into luxury Villas (preserved untouched!)
const OG_VILLA_ARCHETYPES: HouseArchetype[] = [
  'mediterranean',
  'modern-villa',
  'luxury-modern',
];

function seededHash(n: number): number {
  let x = (n + 1) * 2654435761;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = (x >>> 16) ^ x;
  return (x >>> 0) / 4294967296;
}

function jitterHexColor(hex: string, seedA: number, seedB: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.h = (hsl.h + (seedA - 0.5) * 0.045 + 1) % 1;
  hsl.s = THREE.MathUtils.clamp(hsl.s + (seedB - 0.5) * 0.09, 0.04, 0.78);
  hsl.l = THREE.MathUtils.clamp(hsl.l + (seedA - 0.5) * 0.07, 0.16, 0.92);
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return `#${c.getHexString()}`;
}

export function buildUniqueHouseStyle(
  resident: FollowerRecord,
  districtId?: ExpansionDistrictId,
): HouseStyleSpec {
  const idx = Math.max(0, resident.oldestRank - 1) + resident.originalOrder * 7;
  const h1 = seededHash(idx * 3 + 11);
  const h2 = seededHash(idx * 5 + 23);
  const h3 = seededHash(idx * 7 + 37);
  const h4 = seededHash(idx * 11 + 53);

  if (resident.tier === 'vip-1') {
    return {
      archetype: 'luxury-mansion',
      wallColor: '#fbf6ea',
      trimColor: '#d4af37',
      roofColor: '#253245',
      accentColor: '#b8862d',
      shutterColor: '#1f364d',
      hasBalcony: true,
      hasChimney: true,
      hasDormers: true,
      hasGarageCarport: true,
      hasPool: true,
      floors: 3,
      width: 14.2,
      depth: 10.6,
      wallHeight: 8.6,
    };
  }

  // Upgrade all 49 OG Member residences to Luxury European & Mediterranean Villas (preserved)
  if (resident.tier === 'og-50') {
    const arch = OG_VILLA_ARCHETYPES[Math.floor(h1 * OG_VILLA_ARCHETYPES.length)];
    const wall = jitterHexColor(
      VILLA_WALL_PALETTES[Math.floor(h2 * VILLA_WALL_PALETTES.length)],
      h3,
      h4,
    );
    const roof = jitterHexColor(
      VILLA_ROOF_PALETTES[Math.floor(h3 * VILLA_ROOF_PALETTES.length)],
      h1,
      h2,
    );
    const trim = '#f6efe4';
    const accent = ACCENT_PALETTES[Math.floor(seededHash(idx + 97) * ACCENT_PALETTES.length)];
    const shutter = SHUTTER_PALETTES[Math.floor(seededHash(idx + 131) * SHUTTER_PALETTES.length)];
    return {
      archetype: arch,
      wallColor: wall,
      trimColor: trim,
      roofColor: roof,
      accentColor: accent,
      shutterColor: shutter,
      hasBalcony: true,
      hasChimney: arch === 'mediterranean',
      hasDormers: false,
      hasGarageCarport: true,
      hasPool: true,
      floors: h1 > 0.5 ? 2 : 3,
      width: 11.2 + h2 * 1.6,
      depth: 8.4 + h3 * 1.2,
      wallHeight: 6.4 + h4 * 1.0,
    };
  }

  return buildDistrictResidentialStyle(idx, h1, h2, h3, h4, districtId);
}

function buildDistrictResidentialStyle(
  idx: number,
  h1: number,
  h2: number,
  h3: number,
  h4: number,
  districtId?: ExpansionDistrictId,
): HouseStyleSpec {
  // Subtle district-themed weighting across all 6 new residential archetypes
  let pool: HouseArchetype[] = RESIDENTIAL_ARCHETYPES;
  if (districtId === 'oakwood-district') {
    pool = ['traditional-home', 'suburban-two-storey', 'modern-family', 'premium-residence', 'traditional-home', 'contemporary-villa'];
  } else if (districtId === 'riverside-district') {
    pool = ['contemporary-villa', 'modern-family', 'modern-minimalist', 'suburban-two-storey', 'premium-residence', 'traditional-home'];
  } else if (districtId === 'maplewood-district') {
    pool = ['suburban-two-storey', 'traditional-home', 'premium-residence', 'modern-family', 'contemporary-villa', 'modern-minimalist'];
  } else if (districtId === 'highland-district') {
    pool = ['premium-residence', 'suburban-two-storey', 'traditional-home', 'contemporary-villa', 'modern-minimalist', 'modern-family'];
  } else if (districtId === 'lakeside-district') {
    pool = ['contemporary-villa', 'modern-minimalist', 'modern-family', 'premium-residence', 'contemporary-villa', 'suburban-two-storey'];
  } else if (districtId === 'central-gardens') {
    pool = ['premium-residence', 'contemporary-villa', 'suburban-two-storey', 'traditional-home', 'modern-minimalist', 'modern-family'];
  } else if (districtId === 'greenfield-district') {
    pool = ['modern-family', 'suburban-two-storey', 'traditional-home', 'modern-minimalist', 'contemporary-villa', 'premium-residence'];
  }

  const arch = pool[Math.floor(h1 * pool.length) % pool.length];
  const wall = jitterHexColor(WALL_PALETTES[Math.floor(h2 * WALL_PALETTES.length)], h3, h4);
  const roof = jitterHexColor(ROOF_PALETTES[Math.floor(h3 * ROOF_PALETTES.length)], h1, h2);
  const trim = TRIM_PALETTES[Math.floor(h4 * TRIM_PALETTES.length)];
  const accent = ACCENT_PALETTES[Math.floor(seededHash(idx + 173) * ACCENT_PALETTES.length)];
  const shutter = SHUTTER_PALETTES[Math.floor(seededHash(idx + 199) * SHUTTER_PALETTES.length)];

  const isModernFlat = arch === 'contemporary-villa' || arch === 'modern-minimalist';
  const floors: 1 | 2 | 3 =
    arch === 'modern-family'
      ? h4 > 0.65
        ? 2
        : 1
      : arch === 'premium-residence' && h4 > 0.62
        ? 3
        : 2;

  const baseH =
    floors === 3
      ? 6.4
      : floors === 1
        ? 4.15
        : arch === 'contemporary-villa' || arch === 'suburban-two-storey'
          ? 5.65
          : 5.25;

  const width =
    arch === 'premium-residence' || arch === 'contemporary-villa'
      ? 7.8 + h2 * 1.1
      : arch === 'modern-family'
        ? 7.0 + h2 * 0.9
        : 7.3 + h2 * 1.0;

  const depth =
    arch === 'premium-residence'
      ? 6.5 + h3 * 0.8
      : 5.9 + h3 * 0.9;

  return {
    archetype: arch,
    wallColor: wall,
    trimColor: trim,
    roofColor: roof,
    accentColor: accent,
    shutterColor: shutter,
    hasBalcony: arch === 'contemporary-villa' || arch === 'premium-residence' || (arch !== 'modern-family' && h2 > 0.45),
    hasChimney: !isModernFlat && (arch === 'traditional-home' || arch === 'suburban-two-storey' || h3 > 0.38),
    hasDormers: (arch === 'suburban-two-storey' || arch === 'traditional-home' || arch === 'premium-residence') && h4 > 0.42,
    hasGarageCarport: h1 > 0.16,
    hasPool: false,
    floors,
    width,
    depth,
    wallHeight: baseH + (h1 - 0.5) * 0.36,
  };
}

interface BoxRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function rectsOverlap(a: BoxRect, b: BoxRect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function distPointToSeg2D(
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

export const DISTRICT_PARKS: DistrictParkSpec[] = [
  {
    id: 'dp-oakwood',
    name: 'Oakwood Pine & Pavilion Park',
    districtId: 'oakwood-district',
    x: -580,
    z: -492,
    width: 104,
    depth: 66,
    variant: 'pine-pavilion',
  },
  {
    id: 'dp-riverside',
    name: 'Riverside Rose & Fountain Park',
    districtId: 'riverside-district',
    x: -580,
    z: -4,
    width: 104,
    depth: 66,
    variant: 'rose-fountain',
  },
  {
    id: 'dp-maplewood',
    name: 'Maplewood Reflection Courtyard Park',
    districtId: 'maplewood-district',
    x: -580,
    z: 492,
    width: 104,
    depth: 66,
    variant: 'courtyard-pool',
  },
  {
    id: 'dp-highland',
    name: 'Highland Lookout & Lily Pond Park',
    districtId: 'highland-district',
    x: 185,
    z: -496,
    width: 104,
    depth: 66,
    variant: 'lily-pond',
  },
  {
    id: 'dp-lakeside',
    name: 'Lakeside Meadow & Pergola Park',
    districtId: 'lakeside-district',
    x: 790,
    z: -36,
    width: 100,
    depth: 66,
    variant: 'valley-meadow',
  },
  {
    id: 'dp-central-gardens',
    name: 'Central Gardens Rotunda Park',
    districtId: 'central-gardens',
    x: 155,
    z: 332,
    width: 108,
    depth: 68,
    variant: 'garden-rotunda',
  },
  {
    id: 'dp-greenfield',
    name: 'Greenfield Orchard & Playground Park',
    districtId: 'greenfield-district',
    x: 245,
    z: 620,
    width: 104,
    depth: 66,
    variant: 'orchard-playground',
  },
];

export const VENICE_CANALS: ExpansionCanalSpec[] = [
  {
    id: 'canal-san-marco-w',
    name: 'San Marco Grand West Canal',
    x1: -270,
    z1: -735,
    x2: -270,
    z2: 735,
    width: 24,
  },
  {
    id: 'canal-linden-north',
    name: 'Linden North Canal',
    x1: -985,
    z1: -352,
    x2: 985,
    z2: -352,
    width: 24,
  },
  {
    id: 'canal-venetian-south',
    name: 'Venetian Lagoon South Canal',
    x1: -985,
    z1: 154,
    x2: 584,
    z2: 154,
    width: 24,
  },
  {
    id: 'canal-rialto-east',
    name: 'Rialto East Canal',
    x1: 584,
    z1: -735,
    x2: 584,
    z2: 735,
    width: 24,
  },
];

const RESERVED_ZONES: BoxRect[] = [
  // Preserved original Lindenhof core city ("Avila")
  { minX: -148, maxX: 148, minZ: -138, maxZ: 138 },
  // OG Villas Royal Quarter (North Central Crown Terrace)
  { minX: -252, maxX: 252, minZ: -336, maxZ: -134 },
  // Grand Central Park + Waterfront Lagoon (West + East combined heart)
  { minX: 148, maxX: 568, minZ: -136, maxZ: 136 },
  // Venice Canals (protect clear waterways + embankments from any residential plots)
  { minX: -288, maxX: -252, minZ: -775, maxZ: 775 },
  { minX: 566, maxX: 602, minZ: -775, maxZ: 775 },
  { minX: -1060, maxX: 1060, minZ: -372, maxZ: -322 },
  { minX: -1060, maxX: 602, minZ: 136, maxZ: 185 },
  // Primary Named Boulevards & Sidewalk Corridors
  { minX: -940, maxX: 980, minZ: -138, maxZ: -122 },
  { minX: -940, maxX: 980, minZ: 122, maxZ: 138 },
  { minX: -940, maxX: 980, minZ: 168, maxZ: 184 },
  { minX: -148, maxX: -132, minZ: -760, maxZ: 760 },
  { minX: 137, maxX: 153, minZ: -340, maxZ: 760 },
  { minX: 318, maxX: 334, minZ: -760, maxZ: 760 },
  { minX: 556, maxX: 572, minZ: -760, maxZ: 760 },
  { minX: -300, maxX: -284, minZ: -760, maxZ: 760 },
  // Dedicated Neighborhood District Parks (zero houses placed inside)
  ...DISTRICT_PARKS.map((pk) => ({
    minX: pk.x - pk.width / 2 - 4.5,
    maxX: pk.x + pk.width / 2 + 4.5,
    minZ: pk.z - pk.depth / 2 - 4.5,
    maxZ: pk.z + pk.depth / 2 + 4.5,
  })),
];

function classifyResidentialDistrict(
  x: number,
  z: number,
): {
  districtId: ExpansionDistrictId;
  coreDistrictId: DistrictId;
  districtName: string;
  streetPrefix: string;
} {
  // West of San Marco Canal (x < -270)
  if (x < -270) {
    if (z < -130) {
      return {
        districtId: 'oakwood-district',
        coreDistrictId: 'district-1-residential',
        districtName: 'Oakwood District',
        streetPrefix: 'Oakwood Curve',
      };
    }
    if (z <= 265) {
      return {
        districtId: 'riverside-district',
        coreDistrictId: 'district-1-residential',
        districtName: 'Riverside District',
        streetPrefix: 'Riverside Terrace',
      };
    }
    return {
      districtId: 'maplewood-district',
      coreDistrictId: 'district-1-residential',
      districtName: 'Maplewood District',
      streetPrefix: 'Maplewood Crescent',
    };
  }

  // East of Rialto Canal (x > 584)
  if (x > 584) {
    if (z <= 275) {
      return {
        districtId: 'lakeside-district',
        coreDistrictId: 'district-1-residential',
        districtName: 'Lakeside District',
        streetPrefix: 'Lakeside Promenade',
      };
    }
    return {
      districtId: 'greenfield-district',
      coreDistrictId: 'district-6-expansion',
      districtName: 'Greenfield District',
      streetPrefix: 'Greenfield Parkway',
    };
  }

  // North of North Canal in Highland District (z < -352)
  if (z < -352) {
    return {
      districtId: 'highland-district',
      coreDistrictId: 'district-1-residential',
      districtName: 'Highland District',
      streetPrefix: 'Highland Ridge Way',
    };
  }

  // Central Corridor South of South Canal
  if (z <= 505) {
    return {
      districtId: 'central-gardens',
      coreDistrictId: 'district-1-residential',
      districtName: 'Central Gardens',
      streetPrefix: 'Garden Rotunda Drive',
    };
  }

  return {
    districtId: 'greenfield-district',
    coreDistrictId: 'district-6-expansion',
    districtName: 'Greenfield District',
    streetPrefix: 'Greenfield Meadow Lane',
  };
}

// 2D SAT Oriented Bounding Box check for zero-overlap plot placement on any curved road angle
interface ObbSpec {
  cx: number;
  cz: number;
  ux: number; // local +X unit vector in world
  uz: number;
  vx: number; // local +Z unit vector in world
  vz: number;
  hx: number;
  hz: number;
}

function makeObb(cx: number, cz: number, width: number, depth: number, facingAngle: number): ObbSpec {
  const cos = Math.cos(facingAngle);
  const sin = Math.sin(facingAngle);
  return {
    cx,
    cz,
    ux: cos,
    uz: -sin,
    vx: sin,
    vz: cos,
    hx: width * 0.5,
    hz: depth * 0.5,
  };
}

function obbOverlaps(a: ObbSpec, b: ObbSpec): boolean {
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  // Fast circle reject
  const rSum = Math.hypot(a.hx, a.hz) + Math.hypot(b.hx, b.hz);
  if (dx * dx + dz * dz > rSum * rSum) return false;

  const axes: Array<[number, number]> = [
    [a.ux, a.uz],
    [a.vx, a.vz],
    [b.ux, b.uz],
    [b.vx, b.vz],
  ];
  for (let i = 0; i < 4; i++) {
    const ax = axes[i][0];
    const az = axes[i][1];
    const dist = Math.abs(dx * ax + dz * az);
    const projA = a.hx * Math.abs(a.ux * ax + a.uz * az) + a.hz * Math.abs(a.vx * ax + a.vz * az);
    const projB = b.hx * Math.abs(b.ux * ax + b.uz * az) + b.hz * Math.abs(b.vx * ax + b.vz * az);
    if (dist >= projA + projB) return false;
  }
  return true;
}

/**
 * Generates the Complete 7-District Curved-Road Residential City Master Plan:
 * - OG Villas Royal Quarter (VIP #1 + 49 OG Villas) & Historic Core ("Avila") remain 100% untouched.
 * - Remaining residential areas organized into 7 distinct curved-road districts (~500 plots each, 3,500+ total).
 * - Smooth Catmull-Rom S-curves, sweeping crescents, circular district roundabouts & T-junctions.
 * - Curvature-compensated plot placement with OBB SAT + road-clearance spatial hash guarantees 0 overlaps.
 */
export function buildExpansionCityWorld(residents: FollowerRecord[]): ExpansionCityWorld {
  const plots: ExpansionPlotSpec[] = [];
  const roads: ExpansionRoadSpec[] = [];
  const curvyRoadSegments: ExpansionRoadSpec[] = [];
  const curvedRoads: CurvedRoadSplineSpec[] = [];
  const roundabouts: RoundaboutSpec[] = [];
  const bridges: ExpansionBridgeSpec[] = [];
  const busStops: BusStopSpec[] = [];
  const crosswalks: CrosswalkSpec[] = [];
  const sidewalks: Array<{ id: string; x: number; z: number; width: number; depth: number }> = [];
  const lamps: Array<{ id: string; x: number; z: number; rotY: number }> = [];
  const benches: Array<{ id: string; x: number; z: number; rotY: number }> = [];

  const vip = residents.find((r) => r.tier === 'vip-1') ?? residents[0] ?? null;
  const ogOthers = residents.filter((r) => r !== vip && r.tier === 'og-50').slice(0, 49);
  const ogRoster: FollowerRecord[] = vip ? [vip, ...ogOthers] : ogOthers;
  const ogKeySet = new Set(ogRoster.map((r) => r.usernameKey));
  const remainingFollowers = residents.filter((r) => !ogKeySet.has(r.usernameKey));

  // ---------------------------------------------------------------------------
  // 1. PRESERVED PRIMARY BOULEVARDS, OG AVENUES & OUTER PANORAMA RING
  // ---------------------------------------------------------------------------
  roads.push(
    {
      id: 'exp-ring-n',
      name: 'Royal Crown Ring Boulevard',
      x1: -960,
      z1: -130,
      x2: 1000,
      z2: -130,
      width: 11.5,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-ring-s',
      name: 'Venetian Quay Boulevard',
      x1: -960,
      z1: 130,
      x2: 1000,
      z2: 130,
      width: 11.5,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-canal-north-blvd',
      name: 'Linden North Canal Boulevard',
      x1: -940,
      z1: -330,
      x2: 960,
      z2: -330,
      width: 11.2,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-canal-south-blvd',
      name: 'Lagoon South Parkway',
      x1: -940,
      z1: 176,
      x2: 960,
      z2: 176,
      width: 11.2,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-ring-w',
      name: 'West Heritage Boulevard',
      x1: -140,
      z1: -740,
      x2: -140,
      z2: 740,
      width: 11.0,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-ring-e-core',
      name: 'Central Park West Parkway',
      x1: 145,
      z1: -332,
      x2: 145,
      z2: 740,
      width: 11.0,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-lakeside-w',
      name: 'Conservatory & Lagoon Drive',
      x1: 326,
      z1: -740,
      x2: 326,
      z2: 740,
      width: 10.8,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-lakeside-e',
      name: 'Rialto Waterfront Boulevard',
      x1: 564,
      z1: -740,
      x2: 564,
      z2: 740,
      width: 11.0,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-sanmarco-quayside',
      name: 'San Marco Canal Promenade',
      x1: -292,
      z1: -740,
      x2: -292,
      z2: 740,
      width: 10.5,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    // OG Royal Quarter Flanking Boulevards (preserved verbatim)
    {
      id: 'exp-og-axis-w',
      name: 'Royal Villa Terrace West',
      x1: -36,
      z1: -330,
      x2: -36,
      z2: -130,
      width: 9.8,
      hasDoubleCenterLine: true,
      roadTier: 'collector',
      isMainAvenue: true,
    },
    {
      id: 'exp-og-axis-e',
      name: 'Royal Villa Terrace East',
      x1: 36,
      z1: -330,
      x2: 36,
      z2: -130,
      width: 9.8,
      hasDoubleCenterLine: true,
      roadTier: 'collector',
      isMainAvenue: true,
    },
    {
      id: 'exp-og-mid',
      name: 'OG Villas Avenue West',
      x1: -248,
      z1: -248,
      x2: -36,
      z2: -248,
      width: 9.2,
      hasDoubleCenterLine: false,
      hasDashedCenterLine: true,
      roadTier: 'collector',
    },
    {
      id: 'exp-og-mid-e',
      name: 'OG Villas Avenue East',
      x1: 36,
      z1: -248,
      x2: 248,
      z2: -248,
      width: 9.2,
      hasDoubleCenterLine: false,
      hasDashedCenterLine: true,
      roadTier: 'collector',
    },
    {
      id: 'exp-og-west-edge',
      name: 'West Crown Canalway',
      x1: -246,
      z1: -330,
      x2: -246,
      z2: -130,
      width: 9.5,
      hasDoubleCenterLine: false,
      hasDashedCenterLine: true,
      roadTier: 'collector',
    },
    {
      id: 'exp-og-east-edge',
      name: 'East Crown Way',
      x1: 246,
      z1: -330,
      x2: 246,
      z2: -130,
      width: 9.5,
      hasDoubleCenterLine: false,
      hasDashedCenterLine: true,
      roadTier: 'collector',
    },
  );

  // Curved Outer Scenic Panorama Ring Boulevard (36 smooth arc segments)
  const ringSegs = 36;
  const rx = 1175;
  const rz = 890;
  for (let i = 0; i < ringSegs; i++) {
    const a1 = (i / ringSegs) * Math.PI * 2;
    const a2 = ((i + 1) / ringSegs) * Math.PI * 2;
    const seg: ExpansionRoadSpec = {
      id: `exp-scenic-ring-${i}`,
      name: 'Grand Panoramic Ring Boulevard',
      x1: Math.cos(a1) * rx,
      z1: Math.sin(a1) * rz,
      x2: Math.cos(a2) * rx,
      z2: Math.sin(a2) * rz,
      width: 11.4,
      hasDoubleCenterLine: true,
      roadTier: 'scenic-curve',
      isMainAvenue: true,
    };
    roads.push(seg);
    curvyRoadSegments.push(seg);
  }

  const addScenicParkway = (
    prefix: string,
    name: string,
    points: Array<{ x: number; z: number }>,
    width = 9.6,
  ) => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((pt) => new THREE.Vector3(pt.x, 0, pt.z)),
      false,
      'catmullrom',
      0.5,
    );
    const sampled = curve.getPoints(18);
    for (let i = 0; i < sampled.length - 1; i++) {
      const p1 = sampled[i];
      const p2 = sampled[i + 1];
      const seg: ExpansionRoadSpec = {
        id: `${prefix}-${i}`,
        name,
        x1: p1.x,
        z1: p1.z,
        x2: p2.x,
        z2: p2.z,
        width,
        hasDoubleCenterLine: true,
        roadTier: 'scenic-curve',
        isMainAvenue: true,
      };
      roads.push(seg);
      curvyRoadSegments.push(seg);
    }
  };

  addScenicParkway('exp-curve-north', 'Alpine Panorama Curve', [
    { x: -540, z: -832 },
    { x: -280, z: -862 },
    { x: 0, z: -836 },
    { x: 280, z: -864 },
    { x: 540, z: -830 },
  ]);

  addScenicParkway('exp-curve-south', 'Linden Valley Winding Drive', [
    { x: -540, z: 832 },
    { x: -260, z: 864 },
    { x: 20, z: 836 },
    { x: 290, z: 862 },
    { x: 550, z: 830 },
  ]);

  addScenicParkway('exp-curve-east', 'Horizon Creek Scenic Curve', [
    { x: 1072, z: -290 },
    { x: 1116, z: -145 },
    { x: 1078, z: 0 },
    { x: 1116, z: 145 },
    { x: 1072, z: 290 },
  ]);

  // ---------------------------------------------------------------------------
  // 2. VENICE CANAL BRIDGES (35 BRIDGES — UNTOUCHED)
  // ---------------------------------------------------------------------------
  for (const bz of [-506, -330, -130, -26, 26, 130, 176, 374, 550]) {
    bridges.push({
      id: `br-sm-${bz}`,
      name: 'San Marco Canal Bridge',
      x: -270,
      z: bz,
      length: 30,
      width: Math.abs(bz) === 130 || Math.abs(bz) === 26 ? 12 : 10,
      rotY: 0,
      kind: 'road',
    });
  }
  for (const bz of [-506, -330, -130, 0, 130, 176, 374, 550]) {
    bridges.push({
      id: `br-rialto-${bz}`,
      name: 'Rialto East Bridge',
      x: 584,
      z: bz,
      length: 30,
      width: bz === 0 || Math.abs(bz) === 130 ? 12 : 10,
      rotY: 0,
      kind: bz === 0 ? 'pedestrian' : 'road',
    });
  }
  for (const bx of [-560, -292, -140, -36, 36, 145, 326, 564, 700]) {
    bridges.push({
      id: `br-north-${bx}`,
      name: 'North Canal Crossing',
      x: bx,
      z: -352,
      length: 30,
      width: Math.abs(bx) === 36 ? 10.5 : 11.5,
      rotY: Math.PI / 2,
      kind: 'road',
    });
  }
  for (const bx of [-560, -292, -140, -26, 26, 145, 326, 446, 564]) {
    bridges.push({
      id: `br-south-${bx}`,
      name: 'Lagoon Bridge',
      x: bx,
      z: 154,
      length: 30,
      width: bx === 446 ? 6.5 : 11.5,
      rotY: Math.PI / 2,
      kind: bx === 446 ? 'pedestrian' : 'road',
    });
  }

  const cwCoords: Array<[number, number, number]> = [
    [-140, -130, 0],
    [145, -130, 0],
    [326, -130, 0],
    [564, -130, 0],
    [-140, 130, 0],
    [145, 130, 0],
    [326, 130, 0],
    [564, 130, 0],
    [-292, -130, Math.PI / 2],
    [-292, 130, Math.PI / 2],
    [0, -130, Math.PI / 2],
  ];
  cwCoords.forEach(([cx, cz, rotY], i) => {
    crosswalks.push({ id: `cw-${i}`, x: cx, z: cz, rotY, width: 10.5 });
  });

  // ---------------------------------------------------------------------------
  // 3. OG VILLAS ROYAL QUARTER (VIP #1 + 49 OG LUXURY VILLAS = 50 — UNTOUCHED)
  // ---------------------------------------------------------------------------
  if (vip) {
    plots.push({
      plotId: vip.plotId,
      plotCode: vip.plotCode,
      districtId: 'og-premium-district',
      coreDistrictId: 'district-4-luxury',
      districtName: 'OG Villas Royal Quarter',
      address: '1 Royal Crown Plaza (VIP Central)',
      x: 0,
      z: -214,
      width: 48,
      depth: 40,
      facingAngle: 0,
      status: 'vip',
      resident: vip,
      houseStyle: buildUniqueHouseStyle(vip, 'og-premium-district'),
      gardenTreeCount: 3,
      gardenFlowerTint: '#f59e0b',
    });
  }

  const ogSlots: Array<{ x: number; z: number; facing: number; addr: string }> = [];
  const westOuterXs = [-223, -193, -163];
  const westInnerXs = [-117, -87, -57];
  const eastInnerXs = [58, 88, 118];
  const eastOuterXs = [167, 196, 225];
  const allBandXs = [...westOuterXs, ...westInnerXs, ...eastInnerXs, ...eastOuterXs];

  const rowSpecs: Array<{ z: number; facing: number; street: string; baseNum: number }> = [
    { z: -152, facing: 0, street: 'Royal Crown Ring', baseNum: 10 },
    { z: -224, facing: Math.PI, street: 'OG Villas Avenue', baseNum: 11 },
    { z: -270, facing: 0, street: 'OG Villas Avenue', baseNum: 40 },
    { z: -304, facing: Math.PI, street: 'Linden North Canal Blvd', baseNum: 1 },
  ];

  for (const row of rowSpecs) {
    allBandXs.forEach((ox, colIdx) => {
      ogSlots.push({
        x: ox,
        z: row.z,
        facing: row.facing,
        addr: `${row.baseNum + colIdx * 2} ${row.street}`,
      });
    });
  }
  ogSlots.push({
    x: -56,
    z: -188,
    facing: Math.PI / 2,
    addr: '22 Royal Villa Terrace West',
  });

  ogOthers.forEach((member, i) => {
    const slot = ogSlots[i];
    if (!slot) return;
    plots.push({
      plotId: member.plotId,
      plotCode: member.plotCode,
      districtId: 'og-premium-district',
      coreDistrictId: 'district-4-luxury',
      districtName: 'OG Villas Royal Quarter',
      address: slot.addr,
      x: slot.x,
      z: slot.z,
      width: 25,
      depth: 22,
      facingAngle: slot.facing,
      status: 'og',
      resident: member,
      houseStyle: buildUniqueHouseStyle(member, 'og-premium-district'),
      gardenTreeCount: (i % 2 === 0 ? 3 : 2) as 2 | 3,
      gardenFlowerTint: GARDEN_TINTS[i % GARDEN_TINTS.length],
    });
  });

  const ogPocketGardens: OgPocketGardenSpec[] = [];
  const gapGroups: Array<{ xs: number[]; width: number }> = [
    { xs: [-208, -178], width: 4.6 },
    { xs: [-102, -72], width: 4.6 },
    { xs: [73, 103], width: 4.6 },
    { xs: [181.5, 210.5], width: 3.6 },
  ];
  let gpIdx = 0;
  for (const row of rowSpecs) {
    for (const grp of gapGroups) {
      for (const gx of grp.xs) {
        ogPocketGardens.push({
          id: `og-gap-${gpIdx}`,
          x: gx,
          z: row.z,
          width: grp.width,
          depth: 20.6,
          flowerTint: GARDEN_TINTS[gpIdx % GARDEN_TINTS.length],
          hasBench: gpIdx % 2 === 0,
        });
        gpIdx++;
      }
    }
  }
  for (const extra of [
    { x: -102, z: -188, w: 16, d: 18 },
    { x: 88, z: -188, w: 22, d: 18 },
  ]) {
    ogPocketGardens.push({
      id: `og-gap-extra-${gpIdx}`,
      x: extra.x,
      z: extra.z,
      width: extra.w,
      depth: extra.d,
      flowerTint: GARDEN_TINTS[gpIdx % GARDEN_TINTS.length],
      hasBench: true,
    });
    gpIdx++;
  }

  // ---------------------------------------------------------------------------
  // 4. 7-DISTRICT CURVED ROAD NETWORK + ROUNDABOUTS
  // ---------------------------------------------------------------------------
  roundabouts.push(
    {
      id: 'rb-oakwood-n',
      name: 'Oakwood Pine Circle',
      districtId: 'oakwood-district',
      x: -580,
      z: -582,
      innerRadius: 9.5,
      roadWidth: 8.4,
      sidewalkWidth: 2.2,
      hasFountain: true,
    },
    {
      id: 'rb-oakwood-s',
      name: 'Oakwood Terrace Roundabout',
      districtId: 'oakwood-district',
      x: -580,
      z: -228,
      innerRadius: 9.5,
      roadWidth: 8.4,
      sidewalkWidth: 2.2,
      hasFountain: false,
    },
    {
      id: 'rb-riverside',
      name: 'Riverside Fountain Circle',
      districtId: 'riverside-district',
      x: -735,
      z: -4,
      innerRadius: 10.0,
      roadWidth: 8.6,
      sidewalkWidth: 2.2,
      hasFountain: true,
    },
    {
      id: 'rb-maplewood',
      name: 'Maplewood Crescent Circle',
      districtId: 'maplewood-district',
      x: -580,
      z: 536,
      innerRadius: 10.0,
      roadWidth: 8.6,
      sidewalkWidth: 2.2,
      hasFountain: true,
    },
    {
      id: 'rb-highland',
      name: 'Highland Crest Circle',
      districtId: 'highland-district',
      x: 185,
      z: -600,
      innerRadius: 10.0,
      roadWidth: 8.6,
      sidewalkWidth: 2.2,
      hasFountain: true,
    },
    {
      id: 'rb-lakeside',
      name: 'Lakeside Cove Roundabout',
      districtId: 'lakeside-district',
      x: 790,
      z: -182,
      innerRadius: 9.5,
      roadWidth: 8.4,
      sidewalkWidth: 2.2,
      hasFountain: true,
    },
    {
      id: 'rb-central',
      name: 'Central Gardens Plaza Circle',
      districtId: 'central-gardens',
      x: 410,
      z: 332,
      innerRadius: 9.5,
      roadWidth: 8.6,
      sidewalkWidth: 2.2,
      hasFountain: true,
    },
    {
      id: 'rb-greenfield',
      name: 'Greenfield Meadow Circle',
      districtId: 'greenfield-district',
      x: 790,
      z: 420,
      innerRadius: 10.0,
      roadWidth: 8.6,
      sidewalkWidth: 2.2,
      hasFountain: true,
    },
  );

  interface InternalCurvedRoad {
    spec: CurvedRoadSplineSpec;
    curve: THREE.CatmullRomCurve3;
    lengths: number[];
    totalLen: number;
    placePlots: boolean;
  }

  const allCurvedDefs: InternalCurvedRoad[] = [];

  // Road segment spatial index for O(1) collision checking
  interface RoadSegEntry {
    x1: number;
    z1: number;
    x2: number;
    z2: number;
    halfW: number;
  }
  const roadSegGrid = new Map<string, RoadSegEntry[]>();
  const ROAD_CELL = 40;

  const indexRoadSegment = (x1: number, z1: number, x2: number, z2: number, halfW: number) => {
    const entry: RoadSegEntry = { x1, z1, x2, z2, halfW };
    const minGx = Math.floor((Math.min(x1, x2) - halfW - 6) / ROAD_CELL);
    const maxGx = Math.floor((Math.max(x1, x2) + halfW + 6) / ROAD_CELL);
    const minGz = Math.floor((Math.min(z1, z2) - halfW - 6) / ROAD_CELL);
    const maxGz = Math.floor((Math.max(z1, z2) + halfW + 6) / ROAD_CELL);
    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gz = minGz; gz <= maxGz; gz++) {
        const key = `${gx},${gz}`;
        const list = roadSegGrid.get(key);
        if (list) list.push(entry);
        else roadSegGrid.set(key, [entry]);
      }
    }
  };

  for (const r of roads) {
    indexRoadSegment(r.x1, r.z1, r.x2, r.z2, r.width * 0.5);
  }

  const addCurvedRoad = (
    id: string,
    name: string,
    districtId: ExpansionDistrictId,
    tier: 'collector' | 'residential' | 'scenic-curve',
    controlPoints: Array<{ x: number; z: number }>,
    placePlots: boolean,
    closed = false,
  ) => {
    if (controlPoints.length < 2) return;
    const width = tier === 'collector' ? 9.0 : tier === 'scenic-curve' ? 8.6 : 7.8;
    const sidewalkWidth = 1.85;
    const greenStripWidth = 0.85;

    const curve = new THREE.CatmullRomCurve3(
      controlPoints.map((pt) => new THREE.Vector3(pt.x, 0, pt.z)),
      closed,
      'catmullrom',
      0.5,
    );
    const roughLen = curve.getLength();
    const numSamples = Math.max(10, Math.ceil(roughLen / 5.5));
    const sampledVecs = curve.getSpacedPoints(numSamples);
    const sampledPoints = sampledVecs.map((v) => ({ x: v.x, z: v.z }));

    const lengths: number[] = [0];
    let accum = 0;
    for (let i = 1; i < sampledPoints.length; i++) {
      accum += Math.hypot(
        sampledPoints[i].x - sampledPoints[i - 1].x,
        sampledPoints[i].z - sampledPoints[i - 1].z,
      );
      lengths.push(accum);
    }

    const spec: CurvedRoadSplineSpec = {
      id,
      name,
      districtId,
      tier,
      width,
      sidewalkWidth,
      greenStripWidth,
      controlPoints,
      sampledPoints,
      hasDoubleCenterLine: tier === 'collector' || tier === 'scenic-curve',
      hasDashedCenterLine: tier === 'residential',
      closed,
    };

    curvedRoads.push(spec);
    allCurvedDefs.push({
      spec,
      curve,
      lengths,
      totalLen: accum,
      placePlots,
    });

    for (let i = 0; i < sampledPoints.length - 1; i++) {
      const p1 = sampledPoints[i];
      const p2 = sampledPoints[i + 1];
      indexRoadSegment(p1.x, p1.z, p2.x, p2.z, width * 0.5);
    }

    // Add streetlamps at smooth 34m intervals along both curved sidewalks
    const lampStep = tier === 'collector' ? 32 : 38;
    const lampOffset = width * 0.5 + greenStripWidth + 0.45;
    let lampSide = 1;
    let nextLampS = 18;
    while (nextLampS < accum - 14) {
      const u = THREE.MathUtils.clamp(nextLampS / Math.max(1, accum), 0.01, 0.99);
      const pt = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const nx = -tan.z;
      const nz = tan.x;
      const lx = pt.x + nx * lampOffset * lampSide;
      const lz = pt.z + nz * lampOffset * lampSide;

      // Avoid placing lamps inside reserved zones / canals / roundabouts
      const nearCanal =
        Math.abs(lx + 270) < 16 ||
        Math.abs(lx - 584) < 16 ||
        Math.abs(lz + 352) < 16 ||
        Math.abs(lz - 154) < 16;
      const nearRb = roundabouts.some(
        (rb) => Math.hypot(lx - rb.x, lz - rb.z) < rb.innerRadius + rb.roadWidth + 2,
      );
      if (!nearCanal && !nearRb) {
        lamps.push({
          id: `clmp-${id}-${lamps.length}`,
          x: lx,
          z: lz,
          rotY: Math.atan2(-nx * lampSide, -nz * lampSide),
        });
      }
      lampSide *= -1;
      nextLampS += lampStep;
    }
  };

  // Helper to clip horizontal span to the flat city ellipse at given z
  const maxXAtZ = (z: number, pad = 42): number => {
    const t = Math.min(0.935, (z / 835) ** 2);
    return Math.max(220, 1132 * Math.sqrt(Math.max(0.05, 0.955 - t)) - pad);
  };

  // Helper: build parallel phase-locked smooth S-curve streets in world-X coordinates
  // Using a consistent world-X wave ensures adjacent curved streets NEVER pinch toward each other!
  const buildSinusoidalStreet = (
    id: string,
    name: string,
    districtId: ExpansionDistrictId,
    tier: 'collector' | 'residential',
    xStart: number,
    xEnd: number,
    zBase: number,
    amp: number,
    freq: number,
    phase: number,
    placePlots = true,
  ) => {
    const span = xEnd - xStart;
    if (span < 36) return;
    const steps = Math.max(6, Math.round(span / 65));
    const pts: Array<{ x: number; z: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = xStart + span * t;
      // Smooth edge blend over first/last 45m so endpoints meet T-junctions cleanly
      const distEdge = Math.min(x - xStart, xEnd - x);
      const env = Math.min(1, distEdge / 48);
      const z = zBase + amp * env * Math.sin(x * freq + phase);
      pts.push({ x, z });
    }
    addCurvedRoad(id, name, districtId, tier, pts, placePlots);
  };

  // Helper: build smooth N-S curved collector connecting two E-W roads/bounds
  const buildVerticalCurvedCollector = (
    id: string,
    name: string,
    districtId: ExpansionDistrictId,
    xBase: number,
    zStart: number,
    zEnd: number,
    amp: number,
    cycles: number,
    phase: number,
  ) => {
    const span = zEnd - zStart;
    if (span < 40) return;
    const steps = Math.max(5, Math.round(span / 80));
    const pts: Array<{ x: number; z: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const z = zStart + span * t;
      const env = Math.sin(Math.PI * t);
      const x = xBase + amp * env * Math.sin(t * Math.PI * cycles + phase);
      pts.push({ x, z });
    }
    addCurvedRoad(id, name, districtId, 'collector', pts, false);
  };

  // --- A. WEST SIDE (x < -292): OAKWOOD, RIVERSIDE & MAPLEWOOD ---
  buildVerticalCurvedCollector('col-west-oak-n', 'Oakwood Ridge Collector', 'oakwood-district', -580, -730, -330, 12, 2.0, 0.2);
  buildVerticalCurvedCollector('col-west-oak-s', 'Oakwood Terrace Drive', 'oakwood-district', -580, -330, -130, 11, 1.5, 0.4);
  buildVerticalCurvedCollector('col-west-riv', 'Riverside Winding Parkway', 'riverside-district', -735, -130, 130, 12, 1.8, 0.0);
  buildVerticalCurvedCollector('col-west-map', 'Maplewood Grand Collector', 'maplewood-district', -580, 176, 730, 14, 2.4, 0.5);

  // Oakwood North curved streets (z in [-745 .. -385])
  const oakNorthZs = [-736, -695, -654, -613, -572, -531, -490, -449, -408];
  oakNorthZs.forEach((z, idx) => {
    const edge = -maxXAtZ(z, 36);
    if (edge < -340) {
      buildSinusoidalStreet(`oak-n-${idx}`, `Oakwood Ridge Curve ${idx + 1}`, 'oakwood-district', idx % 3 === 1 ? 'collector' : 'residential', edge, -292, z, 9.0, 0.015, 0.4);
    }
  });

  // Oakwood South curved streets (z in [-312 .. -148])
  const oakSouthZs = [-308, -267, -226, -185, -144];
  oakSouthZs.forEach((z, idx) => {
    const edge = -maxXAtZ(z, 36);
    buildSinusoidalStreet(`oak-s-${idx}`, `Oakwood Terrace Lane ${idx + 1}`, 'oakwood-district', idx === 2 ? 'collector' : 'residential', edge, -292, z, 8.5, 0.015, 0.4);
  });

  // Riverside Main (z in [-106 .. 106]) + Riverside South (z in [198 .. 335])
  const rivMainZs = [-104, -63, -22, 19, 60, 101];
  rivMainZs.forEach((z, idx) => {
    const edge = -maxXAtZ(z, 36);
    buildSinusoidalStreet(`riv-m-${idx}`, `Riverside Promenade ${idx + 1}`, 'riverside-district', idx === 2 ? 'collector' : 'residential', edge, -292, z, 9.0, 0.014, -0.3);
  });
  const rivSouthZs = [202, 243, 284, 325];
  rivSouthZs.forEach((z, idx) => {
    const edge = -maxXAtZ(z, 36);
    buildSinusoidalStreet(`riv-s-${idx}`, `Riverside South Curve ${idx + 1}`, 'riverside-district', idx === 1 ? 'collector' : 'residential', edge, -292, z, 9.0, 0.014, -0.3);
  });

  // Maplewood curved streets (z in [366 .. 735])
  const mapZs = [366, 407, 448, 489, 530, 571, 612, 653, 694, 735];
  mapZs.forEach((z, idx) => {
    const edge = -maxXAtZ(z, 36);
    if (edge < -340) {
      buildSinusoidalStreet(`map-${idx}`, `Maplewood Crescent ${idx + 1}`, 'maplewood-district', idx % 3 === 1 ? 'collector' : 'residential', edge, -292, z, 9.0, 0.015, 0.6);
    }
  });

  // --- B. NORTH CENTRAL & NE PLATEAU: HIGHLAND DISTRICT ---
  buildVerticalCurvedCollector('col-high-e', 'Highland Valley Drive', 'highland-district', 185, -755, -352, 12, 2.0, -0.4);
  buildVerticalCurvedCollector('col-high-ee', 'Highland East Parkway', 'highland-district', 440, -720, -352, 11, 1.8, 0.5);

  const highZs = [-752, -711, -670, -629, -588, -547, -506, -465, -424, -383];
  highZs.forEach((z, idx) => {
    const maxEdge = maxXAtZ(z, 36);
    const x1 = Math.max(-248, -maxEdge);
    const x2 = Math.min(564, maxEdge);
    if (x2 - x1 > 80) {
      buildSinusoidalStreet(`high-${idx}`, `Highland Ridge Curve ${idx + 1}`, 'highland-district', idx % 3 === 1 ? 'collector' : 'residential', x1, x2, z, 9.0, 0.014, 0.2);
    }
  });
  // East wing of Highland north of z = -420
  const highEastZs = [-629, -588, -547, -506, -465, -424];
  highEastZs.forEach((z, idx) => {
    const edge = maxXAtZ(z, 36);
    if (edge > 655) {
      buildSinusoidalStreet(`high-e-${idx}`, `Highland Lookout Curve ${idx + 1}`, 'highland-district', idx % 3 === 1 ? 'collector' : 'residential', 604, edge, z, 8.5, 0.016, 0.5);
    }
  });

  // --- C. EAST SIDE: LAKESIDE DISTRICT (x > 602, z in [-383 .. 308]) ---
  buildVerticalCurvedCollector('col-lake-main', 'Lakeside Grand Promenade', 'lakeside-district', 790, -640, 325, 13, 3.0, 0.2);

  const lakeZs = [-383, -306, -265, -224, -183, -142, -101, -60, -19, 22, 63, 104, 145, 186, 227, 268, 309];
  lakeZs.forEach((z, idx) => {
    const edge = maxXAtZ(z, 36);
    if (edge > 655) {
      buildSinusoidalStreet(`lake-${idx}`, `Lakeside Cove Way ${idx + 1}`, 'lakeside-district', idx % 3 === 1 ? 'collector' : 'residential', 604, edge, z, 8.5, 0.016, 0.5);
    }
  });

  // --- D. SOUTH CENTRAL: CENTRAL GARDENS (x in [-248 .. 564], z in [198 .. 510]) ---
  buildVerticalCurvedCollector('col-cg-e', 'Central Gardens East Curve', 'central-gardens', 410, 176, 515, 11, 1.6, -0.3);

  const cgZs = [198, 239, 280, 321, 362, 403, 444, 485];
  cgZs.forEach((z, idx) => {
    buildSinusoidalStreet(`cg-${idx}`, `Garden Crescent Drive ${idx + 1}`, 'central-gardens', idx % 3 === 1 ? 'collector' : 'residential', -248, 564, z, 8.8, 0.014, -0.2);
  });

  // --- E. OUTER SOUTH & SOUTH-EAST: GREENFIELD DISTRICT ---
  buildVerticalCurvedCollector('col-gf-c', 'Greenfield Orchard Drive', 'greenfield-district', 0, 515, 760, 12, 1.8, 0.4);
  buildVerticalCurvedCollector('col-gf-e', 'Greenfield Meadow Collector', 'greenfield-district', 790, 325, 690, 13, 2.2, -0.2);

  const gfSouthZs = [526, 567, 608, 649, 690, 731];
  gfSouthZs.forEach((z, idx) => {
    const maxEdge = maxXAtZ(z, 36);
    const x1 = Math.max(-248, -maxEdge);
    const x2 = Math.min(564, maxEdge);
    if (x2 - x1 > 80) {
      buildSinusoidalStreet(`gf-s-${idx}`, `Greenfield Meadow Lane ${idx + 1}`, 'greenfield-district', idx % 3 === 1 ? 'collector' : 'residential', x1, x2, z, 8.8, 0.014, 0.25);
    }
  });

  const gfEastZs = [350, 391, 432, 473, 514, 555, 596, 637, 678];
  gfEastZs.forEach((z, idx) => {
    const edge = maxXAtZ(z, 36);
    if (edge > 655) {
      buildSinusoidalStreet(`gf-e-${idx}`, `Greenfield Park Crescent ${idx + 1}`, 'greenfield-district', idx % 3 === 1 ? 'collector' : 'residential', 604, edge, z, 8.5, 0.016, -0.3);
    }
  });

  // Scenic curved perimeter collector arcs smoothly linking ends of residential streets
  const addPerimeterCrescent = (
    id: string,
    name: string,
    districtId: ExpansionDistrictId,
    angStart: number,
    angEnd: number,
    rScale: number,
  ) => {
    const pts: Array<{ x: number; z: number }> = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const a = angStart + ((angEnd - angStart) * i) / steps;
      pts.push({
        x: Math.cos(a) * 1072 * rScale,
        z: Math.sin(a) * 782 * rScale,
      });
    }
    addCurvedRoad(id, name, districtId, 'scenic-curve', pts, false);
  };

  addPerimeterCrescent('arc-oak-nw', 'Oakwood Outer Crescent', 'oakwood-district', Math.PI * 1.09, Math.PI * 1.38, 0.96);
  addPerimeterCrescent('arc-riv-w', 'Riverside Outer Curve', 'riverside-district', Math.PI * 0.91, Math.PI * 1.07, 0.98);
  addPerimeterCrescent('arc-map-sw', 'Maplewood Outer Crescent', 'maplewood-district', Math.PI * 0.62, Math.PI * 0.89, 0.96);
  addPerimeterCrescent('arc-high-n', 'Highland Summit Crescent', 'highland-district', Math.PI * 1.42, Math.PI * 1.66, 0.97);
  addPerimeterCrescent('arc-lake-e', 'Lakeside Waterfront Crescent', 'lakeside-district', -Math.PI * 0.19, Math.PI * 0.14, 0.97);
  addPerimeterCrescent('arc-gf-se', 'Greenfield Horizon Crescent', 'greenfield-district', Math.PI * 0.16, Math.PI * 0.56, 0.96);

  // ---------------------------------------------------------------------------
  // 5. CURVATURE-AWARE TANGENT-ALIGNED PLOT CANDIDATE GENERATION & OBB VALIDATION
  // ---------------------------------------------------------------------------
  const PLOT_W = 14.8;
  const PLOT_D = 12.2;
  const PLOT_GAP = 0.55;
  const FRONT_OFFSET = 3.9 + 0.85 + 1.85; // halfRoad(3.9) + greenStrip(0.85) + sidewalk(1.85) = 6.6m

  interface PlacedCandidate {
    x: number;
    z: number;
    width: number;
    depth: number;
    facingAngle: number;
    districtId: ExpansionDistrictId;
    coreDistrictId: DistrictId;
    districtName: string;
    streetName: string;
    streetPrefix: string;
    houseNumber: number;
    distSq: number;
  }

  const placedObbs: ObbSpec[] = [];
  const obbGrid = new Map<string, ObbSpec[]>();
  const OBB_CELL = 34;

  const insertObb = (obb: ObbSpec) => {
    placedObbs.push(obb);
    const gx = Math.floor(obb.cx / OBB_CELL);
    const gz = Math.floor(obb.cz / OBB_CELL);
    const key = `${gx},${gz}`;
    const list = obbGrid.get(key);
    if (list) list.push(obb);
    else obbGrid.set(key, [obb]);
  };

  // Seed OBB grid with VIP + 49 OG Villas so no new plot ever touches OG Quarter
  for (const existing of plots) {
    insertObb(makeObb(existing.x, existing.z, existing.width + 0.6, existing.depth + 0.6, existing.facingAngle));
  }

  const isClearOfAllRoads = (cx: number, cz: number, obb: ObbSpec): boolean => {
    const checkPoints: Array<[number, number]> = [
      [cx, cz],
      [cx + obb.ux * obb.hx + obb.vx * obb.hz, cz + obb.uz * obb.hx + obb.vz * obb.hz],
      [cx - obb.ux * obb.hx + obb.vx * obb.hz, cz - obb.uz * obb.hx + obb.vz * obb.hz],
      [cx + obb.ux * obb.hx - obb.vx * obb.hz, cz + obb.uz * obb.hx - obb.vz * obb.hz],
      [cx - obb.ux * obb.hx - obb.vx * obb.hz, cz - obb.uz * obb.hx - obb.vz * obb.hz],
    ];

    // Check roundabouts
    for (const rb of roundabouts) {
      const clearR = rb.innerRadius + rb.roadWidth + 2.2;
      if (Math.hypot(cx - rb.x, cz - rb.z) < clearR + Math.hypot(obb.hx, obb.hz)) {
        for (const [px, pz] of checkPoints) {
          if (Math.hypot(px - rb.x, pz - rb.z) < clearR) return false;
        }
      }
    }

    // Check spatial hash of straight + curved road segments
    const gx = Math.floor(cx / ROAD_CELL);
    const gz = Math.floor(cz / ROAD_CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const segs = roadSegGrid.get(`${gx + dx},${gz + dz}`);
        if (!segs) continue;
        for (let s = 0; s < segs.length; s++) {
          const seg = segs[s];
          const minClear = seg.halfW + 2.35;
          for (let k = 0; k < checkPoints.length; k++) {
            const d = distPointToSeg2D(
              checkPoints[k][0],
              checkPoints[k][1],
              seg.x1,
              seg.z1,
              seg.x2,
              seg.z2,
            );
            if (d < minClear) return false;
          }
        }
      }
    }
    return true;
  };

  const canPlacePlotObb = (cx: number, cz: number, width: number, depth: number, facingAngle: number): boolean => {
    // Keep comfortably inside Countryside inner flat basin (rx=1175, rz=890 Panoramic Ring)
    const normR = (cx / 1122) ** 2 + (cz / 828) ** 2;
    if (normR > 0.948) return false;

    const obb = makeObb(cx, cz, width + 0.35, depth + 0.35, facingAngle);
    const rBound = Math.hypot(obb.hx, obb.hz);
    const rect: BoxRect = {
      minX: cx - rBound,
      maxX: cx + rBound,
      minZ: cz - rBound,
      maxZ: cz + rBound,
    };
    if (RESERVED_ZONES.some((rzZone) => rectsOverlap(rect, rzZone))) {
      return false;
    }

    if (!isClearOfAllRoads(cx, cz, obb)) {
      return false;
    }

    const gx = Math.floor(cx / OBB_CELL);
    const gz = Math.floor(cz / OBB_CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = obbGrid.get(`${gx + dx},${gz + dz}`);
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          if (obbOverlaps(obb, list[i])) return false;
        }
      }
    }
    return true;
  };

  const candidates: PlacedCandidate[] = [];
  const districtCounts = new Map<ExpansionDistrictId, number>();

  for (const roadDef of allCurvedDefs) {
    if (!roadDef.placePlots) continue;
    const { spec, curve, totalLen } = roadDef;
    if (totalLen < 24) continue;

    const offsetCenter = spec.width * 0.5 + spec.greenStripWidth + spec.sidewalkWidth + PLOT_D * 0.5;
    const offsetBack = offsetCenter + PLOT_D * 0.5;

    for (const side of [-1, 1] as const) {
      let s = 14;
      let houseIdx = 0;
      while (s < totalLen - 14) {
        const u = THREE.MathUtils.clamp(s / totalLen, 0.005, 0.995);
        const pt = curve.getPointAt(u);
        const tan = curve.getTangentAt(u);
        const nx = -tan.z;
        const nz = tan.x;

        // Estimate local curvature kappa via finite difference of tangent angle
        const du = Math.min(0.03, 6 / totalLen);
        const tanPrev = curve.getTangentAt(Math.max(0, u - du));
        const tanNext = curve.getTangentAt(Math.min(1, u + du));
        const dAng = Math.atan2(
          tanPrev.x * tanNext.z - tanPrev.z * tanNext.x,
          tanPrev.x * tanNext.x + tanPrev.z * tanNext.z,
        );
        const dsSpan = 2 * du * totalLen;
        const kappa = dsSpan > 0.1 ? dAng / dsSpan : 0;

        // Place plot center along road normal
        const px = pt.x + side * nx * offsetCenter;
        const pz = pt.z + side * nz * offsetCenter;
        // Local +Z of plot points back toward road: (-side * nx, -side * nz)
        const facingAngle = Math.atan2(-side * nx, -side * nz);

        // Curvature-compensated arc advance so back/front corners never crowd on inside bends
        const arcFactor = Math.min(
          1 - side * kappa * FRONT_OFFSET,
          1 - side * kappa * offsetBack,
        );
        const stepS = (PLOT_W + PLOT_GAP) / Math.max(0.58, arcFactor);

        if (canPlacePlotObb(px, pz, PLOT_W, PLOT_D, facingAngle)) {
          const districtInfo = classifyResidentialDistrict(px, pz);
          const obb = makeObb(px, pz, PLOT_W + 0.35, PLOT_D + 0.35, facingAngle);
          insertObb(obb);

          candidates.push({
            x: px,
            z: pz,
            width: PLOT_W,
            depth: PLOT_D,
            facingAngle,
            districtId: districtInfo.districtId,
            coreDistrictId: districtInfo.coreDistrictId,
            districtName: districtInfo.districtName,
            streetName: spec.name,
            streetPrefix: districtInfo.streetPrefix,
            houseNumber: 10 + houseIdx * 2 + (side > 0 ? 1 : 0),
            distSq: px * px + pz * pz,
          });
          districtCounts.set(
            districtInfo.districtId,
            (districtCounts.get(districtInfo.districtId) ?? 0) + 1,
          );
          houseIdx++;
        }

        s += Math.max(PLOT_W * 0.72, stepS);
      }
    }
  }

  // Sort from city core outward so inner neighborhoods populate seamlessly first
  candidates.sort((a, b) => a.distSq - b.distSq);

  // Target ~500 residential plots per district (~3,605 residential + 50 OG = 3,655 total)
  const PER_DISTRICT_TARGET = 515;
  const keptCounts = new Map<ExpansionDistrictId, number>();
  const balancedCandidates: PlacedCandidate[] = [];
  for (const c of candidates) {
    const used = keptCounts.get(c.districtId) ?? 0;
    if (used < PER_DISTRICT_TARGET) {
      keptCounts.set(c.districtId, used + 1);
      balancedCandidates.push(c);
    }
  }

  // Assign every remaining follower cleanly (zero duplicates, zero missing followers)
  let followerCursor = 0;
  let openExpansionNum = remainingFollowers.length + ogRoster.length + 1;

  for (let i = 0; i < balancedCandidates.length; i++) {
    const c = balancedCandidates[i];
    const resident =
      followerCursor < remainingFollowers.length
        ? remainingFollowers[followerCursor++]
        : null;

    if (resident) {
      const idx = followerCursor - 1;
      const style = buildUniqueHouseStyle(resident, c.districtId);
      const hasCar = style.hasGarageCarport && seededHash(idx * 17 + 9) > 0.42;
      plots.push({
        plotId: resident.plotId,
        plotCode: resident.plotCode,
        districtId: c.districtId,
        coreDistrictId: c.coreDistrictId,
        districtName: c.districtName,
        address: `${c.houseNumber} ${c.streetName}`,
        streetName: c.streetName,
        x: c.x,
        z: c.z,
        width: c.width,
        depth: c.depth,
        facingAngle: c.facingAngle,
        status: 'occupied',
        resident,
        houseStyle: style,
        gardenTreeCount: ((idx % 3) + 1) as 1 | 2 | 3,
        gardenFlowerTint: GARDEN_TINTS[idx % GARDEN_TINTS.length],
        hasParkedCar: hasCar,
      });
    } else {
      const num = openExpansionNum++;
      // Open reserve lots still appear as surveyed parcels ready for new followers
      plots.push({
        plotId: `exp-open-${num}`,
        plotCode: `EXP-${String(num).padStart(4, '0')}`,
        districtId: c.districtId,
        coreDistrictId: 'district-6-expansion',
        districtName: c.districtName,
        address: `${c.houseNumber} ${c.streetName}`,
        streetName: c.streetName,
        x: c.x,
        z: c.z,
        width: c.width,
        depth: c.depth,
        facingAngle: c.facingAngle,
        status: 'expansion-open',
        resident: null,
        houseStyle: null,
        gardenTreeCount: 1,
        gardenFlowerTint: '#84cc16',
        hasParkedCar: false,
      });
    }
  }

  // Fallback guard (should never trigger when total plots >= followers)
  while (followerCursor < remainingFollowers.length) {
    const resident = remainingFollowers[followerCursor++];
    const idx = followerCursor - 1;
    const style = buildUniqueHouseStyle(resident, 'greenfield-district');
    plots.push({
      plotId: resident.plotId,
      plotCode: resident.plotCode,
      districtId: 'greenfield-district',
      coreDistrictId: 'district-6-expansion',
      districtName: 'Greenfield District',
      address: `${10 + idx * 2} Greenfield Reserve Way`,
      x: 840 + (idx % 10) * 16,
      z: 660 + Math.floor(idx / 10) * 16,
      width: PLOT_W,
      depth: PLOT_D,
      facingAngle: Math.PI,
      status: 'occupied',
      resident,
      houseStyle: style,
      gardenTreeCount: 1,
      gardenFlowerTint: '#84cc16',
      hasParkedCar: false,
    });
  }

  // Add roadside pedestrian benches near roundabouts & district parks
  for (const rb of roundabouts) {
    const rB = rb.innerRadius + rb.roadWidth + 1.2;
    for (const ang of [Math.PI * 0.25, Math.PI * 1.25]) {
      benches.push({
        id: `rb-bch-${rb.id}-${ang.toFixed(1)}`,
        x: rb.x + Math.cos(ang) * rB,
        z: rb.z + Math.sin(ang) * rB,
        rotY: Math.atan2(-Math.cos(ang), -Math.sin(ang)),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. COVERED BUS STOPS ACROSS ALL 7 DISTRICTS + CENTRAL LANDMARKS
  // ---------------------------------------------------------------------------
  busStops.push(
    { id: 'bs-og', name: 'OG Royal Quarter Transit Stop', x: -30, z: -137, rotY: 0, districtId: 'og-premium-district' },
    { id: 'bs-cp-w', name: 'Grand Central Park West Gate', x: 156, z: -124, rotY: 0, districtId: 'botanical-gardens' },
    { id: 'bs-cp-e', name: 'Venetian Waterfront Pier Stop', x: 336, z: -124, rotY: 0, districtId: 'waterfront-lake-district' },
    { id: 'bs-oak', name: 'Oakwood Pavilion Park Stop', x: -520, z: -445, rotY: 0, districtId: 'oakwood-district' },
    { id: 'bs-riv', name: 'Riverside Rose Park Stop', x: -520, z: 38, rotY: 0, districtId: 'riverside-district' },
    { id: 'bs-map', name: 'Maplewood Courtyard Park Stop', x: -520, z: 472, rotY: Math.PI, districtId: 'maplewood-district' },
    { id: 'bs-high', name: 'Highland Lily Pond Park Stop', x: 185, z: -448, rotY: 0, districtId: 'highland-district' },
    { id: 'bs-lake', name: 'Lakeside Cove Meadow Stop', x: 730, z: -36, rotY: Math.PI / 2, districtId: 'lakeside-district' },
    { id: 'bs-cg', name: 'Central Gardens Rotunda Stop', x: 155, z: 284, rotY: Math.PI, districtId: 'central-gardens' },
    { id: 'bs-gf', name: 'Greenfield Orchard Park Stop', x: 245, z: 572, rotY: Math.PI, districtId: 'greenfield-district' },
  );

  // Build spatial hash index & fast lookup maps
  const cellSize = 60;
  const buckets = new Map<string, ExpansionPlotSpec[]>();
  const plotById = new Map<string, ExpansionPlotSpec>();
  const plotByUsernameKey = new Map<string, ExpansionPlotSpec>();
  const ogPlots: ExpansionPlotSpec[] = [];
  let vipPlot: ExpansionPlotSpec | null = null;
  let residentHouseCount = 0;
  let openExpansionCount = 0;

  for (const p of plots) {
    plotById.set(p.plotId, p);
    if (p.resident) {
      plotByUsernameKey.set(p.resident.usernameKey, p);
    }
    if (p.status === 'vip') {
      vipPlot = p;
      ogPlots.push(p);
    } else if (p.status === 'og') {
      ogPlots.push(p);
    } else if (p.status === 'occupied') {
      residentHouseCount++;
    } else {
      openExpansionCount++;
    }

    const gx = Math.floor(p.x / cellSize);
    const gz = Math.floor(p.z / cellSize);
    const key = `${gx},${gz}`;
    const list = buckets.get(key);
    if (list) list.push(p);
    else buckets.set(key, [p]);
  }

  return {
    plots,
    plotById,
    plotByUsernameKey,
    ogPlots,
    vipPlot,
    monumentPosition: { x: 0, z: -158 },
    roads,
    curvyRoadSegments,
    curvedRoads,
    roundabouts,
    ogPocketGardens,
    canals: VENICE_CANALS,
    bridges,
    districtParks: DISTRICT_PARKS,
    busStops,
    crosswalks,
    sidewalks,
    lamps,
    benches,
    districts: EXPANSION_DISTRICTS,
    landmarks: EXPANSION_LANDMARKS,
    spatialIndex: { cellSize, buckets },
    counts: {
      totalExpansionPlots: plots.length,
      ogCount: ogPlots.length,
      residentHouseCount,
      openExpansionCount,
    },
  };
}

export function queryNearbyExpansionPlots(
  spatial: ExpansionSpatialIndex,
  x: number,
  z: number,
  radius: number,
): ExpansionPlotSpec[] {
  const out: ExpansionPlotSpec[] = [];
  const cs = spatial.cellSize;
  const minGx = Math.floor((x - radius) / cs);
  const maxGx = Math.floor((x + radius) / cs);
  const minGz = Math.floor((z - radius) / cs);
  const maxGz = Math.floor((z + radius) / cs);
  const rSq = radius * radius;

  for (let gx = minGx; gx <= maxGx; gx++) {
    for (let gz = minGz; gz <= maxGz; gz++) {
      const list = spatial.buckets.get(`${gx},${gz}`);
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const dx = p.x - x;
        const dz = p.z - z;
        if (dx * dx + dz * dz <= rSq) {
          out.push(p);
        }
      }
    }
  }
  return out;
}

export function getExpansionHouseMetrics(plot: ExpansionPlotSpec) {
  const style = plot.houseStyle;
  const isOg = plot.status === 'og';
  const hasGarage = Boolean(style?.hasGarageCarport);
  const houseLocalX = hasGarage && !isOg ? -1.3 : 0;
  const houseLocalZ = -1.0;
  const walkwayX = houseLocalX;
  const houseW = style?.width ?? 7.8;
  const halfW = plot.width / 2;
  const drivewayX = hasGarage
    ? isOg
      ? Math.min(halfW - 2.3, houseW / 2 + 1.45)
      : Math.min(halfW - 1.85, houseLocalX + houseW / 2 + 1.35)
    : Math.min(halfW - 1.85, houseLocalX + houseW / 2 + 1.35);

  return {
    isOg,
    hasGarage,
    houseLocalX,
    houseLocalZ,
    walkwayX,
    drivewayX,
  };
}

