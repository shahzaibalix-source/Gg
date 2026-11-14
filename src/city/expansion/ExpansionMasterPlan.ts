import * as THREE from 'three';
import { DistrictId, HouseArchetype, HouseStyleSpec } from '../types';
import {
  BusStopSpec,
  CrosswalkSpec,
  DistrictParkSpec,
  ExpansionBridgeSpec,
  ExpansionCanalSpec,
  ExpansionDistrictId,
  ExpansionDistrictZone,
  ExpansionLandmarkSpec,
  ExpansionPlotSpec,
  ExpansionRoadSpec,
  FollowerRecord,
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
    title: 'Horizon Reserve Residences',
    subtitle: 'Surveyed open residential parcels ready for incoming community followers',
    category: 'expansion',
    x: 700,
    z: 360,
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
    id: 'north-west-residential',
    name: 'Lindenhöhe Alpine Quarter',
    subtitle: 'Curved Residential Terraces, Bavarian Villas & Pine Pavilion Park',
    color: '#a78bfa',
    center: { x: -560, z: -200 },
    bounds: { minX: -980, maxX: -285, minZ: -740, maxZ: 135 },
  },
  {
    id: 'north-east-residential',
    name: 'Buchenberg Canal Quarter',
    subtitle: 'Hillside Townhouses, Canal Bridges & Buchenberg Lily Pond Park',
    color: '#fb7185',
    center: { x: 240, z: -530 },
    bounds: { minX: -255, maxX: 980, minZ: -740, maxZ: -370 },
  },
  {
    id: 'south-west-residential',
    name: 'Southbrook Mediterranean Quarter',
    subtitle: 'Stucco Garden Villas, San Marco Canal & Courtyard Reflection Park',
    color: '#34d399',
    center: { x: -560, z: 450 },
    bounds: { minX: -980, maxX: -285, minZ: 170, maxZ: 740 },
  },
  {
    id: 'south-east-residential',
    name: 'Linden South Commons',
    subtitle: 'Nordic & European Cottages, Family Lanes & Orchard Playground Park',
    color: '#60a5fa',
    center: { x: 160, z: 450 },
    bounds: { minX: -255, maxX: 565, minZ: 170, maxZ: 740 },
  },
  {
    id: 'future-expansion-district',
    name: 'Horizon Reserve Residences',
    subtitle: 'Surveyed Canal-East Parcels & Horizon Valley Meadow Park',
    color: '#84cc16',
    center: { x: 760, z: 260 },
    bounds: { minX: 600, maxX: 985, minZ: -335, maxZ: 740 },
  },
];

// Curated European & Villa architectural palettes
const WALL_PALETTES = [
  '#f3ebd8', '#9f4e3c', '#e7dcc8', '#d9d4cb', '#edd7b4', '#f4f4f1',
  '#ebe1cc', '#c6cbd0', '#ded6c6', '#e6cfb3', '#d8c3a5', '#eae7dc',
  '#b5634b', '#8d5b4c', '#cfdbd5', '#f2e8cf', '#e9d8a6', '#d6ccc2',
  '#c9ada7', '#f5ebe0', '#e3d5ca', '#dde5b6', '#cad2c5', '#f0efeb',
  '#a98467', '#e0afa0', '#cbd5e1', '#f6ecd9', '#d4a373', '#faedcd',
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

const STANDARD_ARCHETYPES: HouseArchetype[] = [
  'tudor',
  'townhouse',
  'nordic',
  'modern-villa',
  'cottage',
  'mediterranean',
];

// All 49 OG Members upgraded cleanly into luxury Villas!
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

export function buildUniqueHouseStyle(resident: FollowerRecord): HouseStyleSpec {
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

  // Upgrade all 49 OG Member residences to Luxury European & Mediterranean Villas
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

  const arch = STANDARD_ARCHETYPES[Math.floor(h1 * STANDARD_ARCHETYPES.length)];
  const wall = jitterHexColor(WALL_PALETTES[Math.floor(h2 * WALL_PALETTES.length)], h3, h4);
  const roof = jitterHexColor(ROOF_PALETTES[Math.floor(h3 * ROOF_PALETTES.length)], h1, h2);
  const trim = TRIM_PALETTES[Math.floor(h4 * TRIM_PALETTES.length)];
  const accent = ACCENT_PALETTES[Math.floor(seededHash(idx + 173) * ACCENT_PALETTES.length)];
  const shutter = SHUTTER_PALETTES[Math.floor(seededHash(idx + 199) * SHUTTER_PALETTES.length)];
  const floors: 1 | 2 | 3 = h4 > 0.8 ? 3 : h4 < 0.2 ? 1 : 2;
  const baseH = floors === 3 ? 6.6 : floors === 1 ? 4.1 : 5.4;

  return {
    archetype: arch,
    wallColor: wall,
    trimColor: trim,
    roofColor: roof,
    accentColor: accent,
    shutterColor: shutter,
    hasBalcony: h2 > 0.44,
    hasChimney: arch !== 'modern-villa' && h3 > 0.3,
    hasDormers: (arch === 'tudor' || arch === 'cottage') && h4 > 0.45,
    hasGarageCarport: h1 > 0.55,
    hasPool: false,
    floors,
    width: 7.8 + h2 * 2.0,
    depth: 6.8 + h3 * 1.4,
    wallHeight: baseH + (h1 - 0.5) * 0.5,
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

export const DISTRICT_PARKS: DistrictParkSpec[] = [
  {
    id: 'dp-nw-alpine',
    name: 'Lindenhöhe Pine & Pavilion Park',
    districtId: 'north-west-residential',
    x: -560,
    z: -462,
    width: 132,
    depth: 82,
    variant: 'pine-pavilion',
  },
  {
    id: 'dp-w-sanmarco',
    name: 'San Marco Rose & Fountain Park',
    districtId: 'north-west-residential',
    x: -560,
    z: -22,
    width: 132,
    depth: 82,
    variant: 'rose-fountain',
  },
  {
    id: 'dp-sw-courtyard',
    name: 'Southbrook Reflection Courtyard Park',
    districtId: 'south-west-residential',
    x: -560,
    z: 374,
    width: 132,
    depth: 82,
    variant: 'courtyard-pool',
  },
  {
    id: 'dp-se-orchard',
    name: 'Linden South Orchard & Playground Park',
    districtId: 'south-east-residential',
    x: 140,
    z: 374,
    width: 132,
    depth: 82,
    variant: 'orchard-playground',
  },
  {
    id: 'dp-ne-lilypond',
    name: 'Buchenberg Lookout & Lily Pond Park',
    districtId: 'north-east-residential',
    x: 280,
    z: -462,
    width: 132,
    depth: 82,
    variant: 'lily-pond',
  },
  {
    id: 'dp-horizon-meadow',
    name: 'Horizon Valley Meadow Park',
    districtId: 'future-expansion-district',
    x: 700,
    z: 242,
    width: 132,
    depth: 82,
    variant: 'valley-meadow',
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
  // Preserved original Lindenhof core city
  { minX: -148, maxX: 148, minZ: -138, maxZ: 138 },
  // OG Villas Royal Quarter (North Central Crown Terrace)
  { minX: -252, maxX: 252, minZ: -336, maxZ: -134 },
  // Grand Central Park + Waterfront Lagoon (West + East combined heart)
  { minX: 148, maxX: 568, minZ: -136, maxZ: 136 },
  // Venice Canals (protect clear waterways from any residential plots)
  { minX: -288, maxX: -252, minZ: -760, maxZ: 760 },
  { minX: 566, maxX: 602, minZ: -760, maxZ: 760 },
  { minX: -1020, maxX: 1020, minZ: -372, maxZ: -334 },
  { minX: -1020, maxX: 602, minZ: 136, maxZ: 172 },
  // Dedicated Neighborhood District Parks (zero houses placed inside)
  ...DISTRICT_PARKS.map((pk) => ({
    minX: pk.x - pk.width / 2 - 4,
    maxX: pk.x + pk.width / 2 + 4,
    minZ: pk.z - pk.depth / 2 - 4,
    maxZ: pk.z + pk.depth / 2 + 4,
  })),
];

function classifyResidentialDistrict(x: number, z: number): {
  districtId: ExpansionDistrictId;
  coreDistrictId: DistrictId;
  districtName: string;
  streetPrefix: string;
} {
  if (x < -270 && z < 154) {
    return {
      districtId: 'north-west-residential',
      coreDistrictId: 'district-1-residential',
      districtName: 'Lindenhöhe Alpine Quarter',
      streetPrefix: 'Lindenhöhe Terrace',
    };
  }
  if (x < -270 && z >= 154) {
    return {
      districtId: 'south-west-residential',
      coreDistrictId: 'district-1-residential',
      districtName: 'Southbrook Mediterranean Quarter',
      streetPrefix: 'Southbrook Way',
    };
  }
  if (z < -352) {
    return {
      districtId: 'north-east-residential',
      coreDistrictId: 'district-1-residential',
      districtName: 'Buchenberg Canal Quarter',
      streetPrefix: 'Buchenberg Promenade',
    };
  }
  if (x > 584) {
    return {
      districtId: 'future-expansion-district',
      coreDistrictId: 'district-6-expansion',
      districtName: 'Horizon Reserve Residences',
      streetPrefix: 'Horizon Canal Road',
    };
  }
  return {
    districtId: 'south-east-residential',
    coreDistrictId: 'district-1-residential',
    districtName: 'Linden South Commons',
    streetPrefix: 'Commons Garden Lane',
  };
}

/**
 * Generates the Venice-Inspired European Residential Master Plan:
 * - Strictly residential (zero new commercial districts)
 * - Preserves Historic Core [-140..140, -130..130] and every follower's plotId & residentId
 * - OG Quarter upgraded to 49 Luxury Villas + Sweet_thedevil VIP Palace + Royal Crescent Garden
 * - 4 Venice-style Canals with travertine embankments, arched bridges, and animated 3D water
 * - Curved Grand Ring Boulevard + Double-lane collector roads + crosswalks + 10 covered Bus Stops
 * - ONE Massive Grand Central Park + 6 Unique District Parks
 */
export function buildExpansionCityWorld(residents: FollowerRecord[]): ExpansionCityWorld {
  const plots: ExpansionPlotSpec[] = [];
  const roads: ExpansionRoadSpec[] = [];
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
  // 1. PRIMARY DOUBLE-LANE BOULEVARDS & CURVED GRAND RING ROAD
  // ---------------------------------------------------------------------------
  roads.push(
    {
      id: 'exp-ring-n',
      name: 'Royal Crown Ring Boulevard',
      x1: -830,
      z1: -130,
      x2: 880,
      z2: -130,
      width: 11.5,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-ring-s',
      name: 'Venetian Quay Boulevard',
      x1: -830,
      z1: 130,
      x2: 880,
      z2: 130,
      width: 11.5,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-canal-north-blvd',
      name: 'Linden North Canal Boulevard',
      x1: -830,
      z1: -330,
      x2: 880,
      z2: -330,
      width: 11.2,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-canal-south-blvd',
      name: 'Lagoon South Parkway',
      x1: -830,
      z1: 176,
      x2: 880,
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
      z1: -630,
      x2: -140,
      z2: 670,
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
      z2: 670,
      width: 11.0,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-lakeside-w',
      name: 'Conservatory & Lagoon Drive',
      x1: 326,
      z1: -630,
      x2: 326,
      z2: 670,
      width: 10.8,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-lakeside-e',
      name: 'Rialto Waterfront Boulevard',
      x1: 564,
      z1: -630,
      x2: 564,
      z2: 670,
      width: 11.0,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    {
      id: 'exp-sanmarco-quayside',
      name: 'San Marco Canal Promenade',
      x1: -292,
      z1: -630,
      x2: -292,
      z2: 670,
      width: 10.5,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    },
    // OG Royal Quarter Flanking Boulevards
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

  // Curved Outer Scenic Panorama Ring Boulevard (28 smooth overlapping arc segments!)
  const ringSegs = 28;
  const rx = 1085;
  const rz = 815;
  for (let i = 0; i < ringSegs; i++) {
    const a1 = (i / ringSegs) * Math.PI * 2;
    const a2 = ((i + 1) / ringSegs) * Math.PI * 2;
    roads.push({
      id: `exp-scenic-ring-${i}`,
      name: 'Grand Panoramic Ring Boulevard',
      x1: Math.cos(a1) * rx,
      z1: Math.sin(a1) * rz,
      x2: Math.cos(a2) * rx,
      z2: Math.sin(a2) * rz,
      width: 11.2,
      hasDoubleCenterLine: true,
      roadTier: 'boulevard',
      isMainAvenue: true,
    });
  }

  // ---------------------------------------------------------------------------
  // 2. VENICE CANAL BRIDGES (DOUBLE-LANE ROAD BRIDGES + ARCHED PEDESTRIAN BRIDGES)
  // ---------------------------------------------------------------------------
  // Bridges over San Marco Canal (X = -270)
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
  // Bridges over Rialto East Canal (X = 584)
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
  // Bridges over North Grand Canal (Z = -352)
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
  // Bridges over Venetian South Canal (Z = 154)
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

  // Crosswalks at Primary Boulevard Intersections
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
  // 3. OG VILLAS ROYAL QUARTER (VIP #1 + 49 OG LUXURY VILLAS = 50)
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
      houseStyle: buildUniqueHouseStyle(vip),
      gardenTreeCount: 3,
      gardenFlowerTint: '#f59e0b',
    });
  }

  const ogSlots: Array<{ x: number; z: number; facing: number; addr: string }> = [];
  for (let i = 0; i < 6; i++) {
    ogSlots.push({ x: -222 + i * 32, z: -152, facing: 0, addr: `${10 + i * 2} Royal Crown Ring` });
  }
  for (let i = 0; i < 6; i++) {
    ogSlots.push({ x: -222 + i * 32, z: -224, facing: Math.PI, addr: `${11 + i * 2} OG Villas Avenue` });
  }
  for (let i = 0; i < 6; i++) {
    ogSlots.push({ x: -222 + i * 32, z: -270, facing: 0, addr: `${24 + i * 2} OG Villas Avenue` });
  }
  for (let i = 0; i < 7; i++) {
    ogSlots.push({ x: -222 + i * 32, z: -304, facing: Math.PI, addr: `${1 + i * 2} Linden North Canal Blvd` });
  }
  for (let i = 0; i < 6; i++) {
    ogSlots.push({ x: 62 + i * 32, z: -152, facing: 0, addr: `${40 + i * 2} Royal Crown Ring` });
  }
  for (let i = 0; i < 6; i++) {
    ogSlots.push({ x: 62 + i * 32, z: -224, facing: Math.PI, addr: `${41 + i * 2} OG Villas Avenue` });
  }
  for (let i = 0; i < 6; i++) {
    ogSlots.push({ x: 62 + i * 32, z: -270, facing: 0, addr: `${54 + i * 2} OG Villas Avenue` });
  }
  for (let i = 0; i < 6; i++) {
    ogSlots.push({ x: 62 + i * 32, z: -304, facing: Math.PI, addr: `${25 + i * 2} Linden North Canal Blvd` });
  }

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
      width: 26,
      depth: 22,
      facingAngle: slot.facing,
      status: 'og',
      resident: member,
      houseStyle: buildUniqueHouseStyle(member),
      gardenTreeCount: (i % 2 === 0 ? 3 : 2) as 2 | 3,
      gardenFlowerTint: GARDEN_TINTS[i % GARDEN_TINTS.length],
    });
  });

  // ---------------------------------------------------------------------------
  // 4. NEIGHBORHOOD BLOCKS ACROSS STRICTLY RESIDENTIAL DISTRICTS (NO COMMERCIAL)
  // ---------------------------------------------------------------------------
  const STEP_X = 140;
  const STEP_Z = 44;
  const BLOCK_W = 128;
  const BLOCK_D = 32;
  const PLOT_SIZE = 16;

  interface CandidateBlock {
    col: number;
    row: number;
    cx: number;
    cz: number;
    distSq: number;
  }

  const validBlocks: CandidateBlock[] = [];
  for (let col = -7; col <= 7; col++) {
    for (let row = -17; row <= 17; row++) {
      const cx = col * STEP_X;
      const cz = row * STEP_Z;
      const rect: BoxRect = {
        minX: cx - BLOCK_W / 2 - 4,
        maxX: cx + BLOCK_W / 2 + 4,
        minZ: cz - BLOCK_D / 2 - 4,
        maxZ: cz + BLOCK_D / 2 + 4,
      };
      if (RESERVED_ZONES.some((rz) => rectsOverlap(rect, rz))) continue;

      // Keep outer boundary cleanly inside elliptical Panoramic Ring Road
      const normR = (cx / 1040) ** 2 + (cz / 780) ** 2;
      if (normR > 0.96) continue;

      validBlocks.push({
        col,
        row,
        cx,
        cz,
        distSq: cx * cx + cz * cz,
      });
    }
  }

  const horizonExpansionBlocks: CandidateBlock[] = [];
  const activeResidentialBlocks: CandidateBlock[] = [];

  for (const b of validBlocks) {
    if (b.cx > 584 && b.cz >= -100) {
      horizonExpansionBlocks.push(b);
    } else {
      activeResidentialBlocks.push(b);
    }
  }

  activeResidentialBlocks.sort((a, b) => a.distSq - b.distSq);
  horizonExpansionBlocks.sort((a, b) => a.distSq - b.distSq);

  // Connected collector & neighborhood roads (double-lane boulevards & secondary roads)
  const roadKeySet = new Set<string>();
  const addGridRoad = (
    id: string,
    name: string,
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    tier: 'collector' | 'residential',
  ) => {
    const key = `${Math.round(x1)},${Math.round(z1)}-${Math.round(x2)},${Math.round(z2)}`;
    if (roadKeySet.has(key)) return;
    roadKeySet.add(key);
    roads.push({
      id,
      name,
      x1,
      z1,
      x2,
      z2,
      width: tier === 'collector' ? 9.4 : 8.0,
      hasDoubleCenterLine: tier === 'collector',
      hasDashedCenterLine: tier === 'residential',
      roadTier: tier,
      isMainAvenue: tier === 'collector',
    });
  };

  for (const b of validBlocks) {
    const leftX = b.cx - STEP_X / 2;
    const rightX = b.cx + STEP_X / 2;
    const topZ = b.cz - STEP_Z / 2;
    const botZ = b.cz + STEP_Z / 2;

    addGridRoad(
      `gr-n-${b.col}-${b.row}`,
      `District Lane ${b.row}`,
      leftX,
      topZ,
      rightX,
      topZ,
      b.row % 4 === 0 ? 'collector' : 'residential',
    );
    addGridRoad(
      `gr-s-${b.col}-${b.row}`,
      `District Lane ${b.row + 1}`,
      leftX,
      botZ,
      rightX,
      botZ,
      (b.row + 1) % 4 === 0 ? 'collector' : 'residential',
    );
    addGridRoad(
      `gr-w-${b.col}-${b.row}`,
      `Avenue ${b.col}`,
      leftX,
      topZ,
      leftX,
      botZ,
      b.col % 2 === 0 ? 'collector' : 'residential',
    );
    addGridRoad(
      `gr-e-${b.col}-${b.row}`,
      `Avenue ${b.col + 1}`,
      rightX,
      topZ,
      rightX,
      botZ,
      (b.col + 1) % 2 === 0 ? 'collector' : 'residential',
    );

    sidewalks.push({
      id: `blk-sw-${b.col}-${b.row}`,
      x: b.cx,
      z: b.cz,
      width: BLOCK_W + 3.4,
      depth: BLOCK_D + 3.4,
    });

    lamps.push(
      { id: `lamp-${b.col}-${b.row}-a`, x: b.cx - 34, z: b.cz - BLOCK_D / 2 - 1.15, rotY: 0 },
      { id: `lamp-${b.col}-${b.row}-b`, x: b.cx + 34, z: b.cz + BLOCK_D / 2 + 1.15, rotY: Math.PI },
    );

    // Alternating pedestrian benches along collector avenues
    if (b.row % 3 === 0) {
      benches.push({
        id: `bch-${b.col}-${b.row}`,
        x: b.cx,
        z: b.cz + BLOCK_D / 2 + 1.1,
        rotY: Math.PI,
      });
    }
  }

  // Assign every remaining follower cleanly (zero duplicates, zero missing followers)
  let followerCursor = 0;
  let openExpansionNum = remainingFollowers.length + ogRoster.length + 1;

  for (const b of activeResidentialBlocks) {
    for (let localRow = 0; localRow < 2; localRow++) {
      const facing = localRow === 0 ? Math.PI : 0;
      const pz = b.cz + (localRow === 0 ? -PLOT_SIZE / 2 : PLOT_SIZE / 2);

      for (let localCol = 0; localCol < 8; localCol++) {
        const px = b.cx - BLOCK_W / 2 + PLOT_SIZE / 2 + localCol * PLOT_SIZE;
        const resident =
          followerCursor < remainingFollowers.length
            ? remainingFollowers[followerCursor++]
            : null;

        if (resident) {
          const districtInfo = classifyResidentialDistrict(px, pz);
          const idx = followerCursor - 1;
          plots.push({
            plotId: resident.plotId,
            plotCode: resident.plotCode,
            districtId: districtInfo.districtId,
            coreDistrictId: districtInfo.coreDistrictId,
            districtName: districtInfo.districtName,
            address: `${10 + localCol * 2} ${districtInfo.streetPrefix} ${Math.abs(b.row) + 1}`,
            x: px,
            z: pz,
            width: PLOT_SIZE,
            depth: PLOT_SIZE,
            facingAngle: facing,
            status: 'occupied',
            resident,
            houseStyle: buildUniqueHouseStyle(resident),
            gardenTreeCount: ((idx % 3) + 1) as 1 | 2 | 3,
            gardenFlowerTint: GARDEN_TINTS[idx % GARDEN_TINTS.length],
          });
        } else {
          const num = openExpansionNum++;
          const districtInfo = classifyResidentialDistrict(px, pz);
          plots.push({
            plotId: `exp-open-${num}`,
            plotCode: `EXP-${String(num).padStart(4, '0')}`,
            districtId: 'future-expansion-district',
            coreDistrictId: 'district-6-expansion',
            districtName: `${districtInfo.districtName} (Surveyed Lot)`,
            address: `${10 + localCol * 2} Horizon Reserve Way ${Math.abs(b.row) + 1}`,
            x: px,
            z: pz,
            width: PLOT_SIZE,
            depth: PLOT_SIZE,
            facingAngle: facing,
            status: 'expansion-open',
            resident: null,
            houseStyle: null,
            gardenTreeCount: 1,
            gardenFlowerTint: '#84cc16',
          });
        }
      }
    }
  }

  // Horizon Future Expansion Blocks (ensuring every remaining follower is housed first)
  for (const b of horizonExpansionBlocks) {
    for (let localRow = 0; localRow < 2; localRow++) {
      const facing = localRow === 0 ? Math.PI : 0;
      const pz = b.cz + (localRow === 0 ? -PLOT_SIZE / 2 : PLOT_SIZE / 2);

      for (let localCol = 0; localCol < 8; localCol++) {
        const px = b.cx - BLOCK_W / 2 + PLOT_SIZE / 2 + localCol * PLOT_SIZE;
        const resident =
          followerCursor < remainingFollowers.length
            ? remainingFollowers[followerCursor++]
            : null;

        if (resident) {
          const districtInfo = classifyResidentialDistrict(px, pz);
          const idx = followerCursor - 1;
          plots.push({
            plotId: resident.plotId,
            plotCode: resident.plotCode,
            districtId: districtInfo.districtId,
            coreDistrictId: districtInfo.coreDistrictId,
            districtName: districtInfo.districtName,
            address: `${10 + localCol * 2} ${districtInfo.streetPrefix} ${Math.abs(b.row) + 1}`,
            x: px,
            z: pz,
            width: PLOT_SIZE,
            depth: PLOT_SIZE,
            facingAngle: facing,
            status: 'occupied',
            resident,
            houseStyle: buildUniqueHouseStyle(resident),
            gardenTreeCount: ((idx % 3) + 1) as 1 | 2 | 3,
            gardenFlowerTint: GARDEN_TINTS[idx % GARDEN_TINTS.length],
          });
        } else {
          const num = openExpansionNum++;
          plots.push({
            plotId: `exp-open-${num}`,
            plotCode: `EXP-${String(num).padStart(4, '0')}`,
            districtId: 'future-expansion-district',
            coreDistrictId: 'district-6-expansion',
            districtName: 'Horizon Reserve Residences',
            address: `${10 + localCol * 2} Horizon Canal Blvd ${b.row + 1}`,
            x: px,
            z: pz,
            width: PLOT_SIZE,
            depth: PLOT_SIZE,
            facingAngle: facing,
            status: 'expansion-open',
            resident: null,
            houseStyle: null,
            gardenTreeCount: 1,
            gardenFlowerTint: '#84cc16',
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. COVERED BUS STOPS AT DISTRICT HUBS & GRAND CENTRAL PARK
  // ---------------------------------------------------------------------------
  busStops.push(
    { id: 'bs-og', name: 'OG Royal Quarter Transit Stop', x: -30, z: -137, rotY: 0, districtId: 'og-premium-district' },
    { id: 'bs-cp-w', name: 'Grand Central Park West Gate', x: 156, z: -124, rotY: 0, districtId: 'botanical-gardens' },
    { id: 'bs-cp-e', name: 'Venetian Waterfront Pier Stop', x: 336, z: -124, rotY: 0, districtId: 'waterfront-lake-district' },
    { id: 'bs-nw', name: 'Lindenhöhe Park Bus Stop', x: -498, z: -414, rotY: 0, districtId: 'north-west-residential' },
    { id: 'bs-w', name: 'San Marco Park Stop', x: -498, z: 24, rotY: 0, districtId: 'north-west-residential' },
    { id: 'bs-sw', name: 'Southbrook Courtyard Stop', x: -498, z: 422, rotY: Math.PI, districtId: 'south-west-residential' },
    { id: 'bs-se', name: 'Linden Commons Playground Stop', x: 140, z: 422, rotY: Math.PI, districtId: 'south-east-residential' },
    { id: 'bs-ne', name: 'Buchenberg Lily Pond Stop', x: 280, z: -414, rotY: 0, districtId: 'north-east-residential' },
    { id: 'bs-hz', name: 'Horizon Valley Meadow Stop', x: 642, z: 242, rotY: Math.PI / 2, districtId: 'future-expansion-district' },
    { id: 'bs-core-s', name: 'Lagoon Quay South Stop', x: 0, z: 124, rotY: Math.PI, districtId: 'south-east-residential' },
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
