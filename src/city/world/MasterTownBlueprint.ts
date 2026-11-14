import {
  DistrictChunk,
  IntersectionSpec,
  PedestrianLoopSpec,
  RoadSegmentSpec,
  TownPlot,
  TrafficLoopSpec,
} from '../types';

export const SIDEWALK_HEIGHT = 0.16;
export const SIDEWALK_WIDTH = 2.8;
export const ROAD_SURFACE_Y = 0.04;
export const MAIN_ROAD_WIDTH = 10.5;
export const SIDE_ROAD_WIDTH = 9.0;
export const LANE_OFFSET = 2.25;

export const DISTRICTS: DistrictChunk[] = [
  {
    id: 'central-square',
    name: 'Central Town Square',
    subtitle: 'Town Hall, Fountain Plaza & Civic Junction',
    center: { x: 0, z: 0 },
    bounds: { minX: -18, maxX: 18, minZ: -18, maxZ: 18 },
  },
  {
    id: 'district-1-residential',
    name: 'District 1 · Residential',
    subtitle: 'European, Scandinavian, Mediterranean & Family Homes',
    center: { x: -58, z: 22 },
    bounds: { minX: -108, maxX: -34, minZ: -18, maxZ: 71 },
  },
  {
    id: 'district-2-commercial',
    name: 'District 2 · Commercial',
    subtitle: 'Restaurants, Cafés, Retail Promenade & Dealership',
    center: { x: 0, z: 52 },
    bounds: { minX: -18, maxX: 18, minZ: 34, maxZ: 71 },
  },
  {
    id: 'district-3-park-entertainment',
    name: 'District 3 · Park & Entertainment',
    subtitle: 'Central Park, Lake, Playground, Cinema & Football Stadium',
    center: { x: 52, z: -24 },
    bounds: { minX: 34, maxX: 71, minZ: -71, maxZ: 18 },
  },
  {
    id: 'district-4-luxury',
    name: 'District 4 · Luxury Residential',
    subtitle: 'Modern Villas, European Mansions & Private Pools',
    center: { x: -52, z: -52 },
    bounds: { minX: -71, maxX: -34, minZ: -71, maxZ: -34 },
  },
  {
    id: 'district-5-public-services',
    name: 'District 5 · Public Services',
    subtitle: 'Hospital, School, University, Police & Fire Station',
    center: { x: 0, z: -52 },
    bounds: { minX: -18, maxX: 18, minZ: -71, maxZ: -34 },
  },
  {
    id: 'district-6-expansion',
    name: 'District 6 · Future Expansion',
    subtitle: 'Reserved Residential, Commercial & Civic Land',
    center: { x: 65, z: 52 },
    bounds: { minX: 34, maxX: 112, minZ: 34, maxZ: 71 },
  },
];

// Intersection box half-extents:
// At X = ±26 or Z = ±26 (main boulevards, width 10.5 -> half 5.25)
// At X = ±78 or Z = ±78 (side avenues, width 9.0 -> half 4.5)
const X_AXES = [
  { x: -78, half: 4.5 },
  { x: -26, half: 5.25 },
  { x: 26, half: 5.25 },
  { x: 78, half: 4.5 },
];

const Z_AXES = [
  { z: -78, half: 4.5 },
  { z: -26, half: 5.25 },
  { z: 26, half: 5.25 },
  { z: 78, half: 4.5 },
];

function buildRoadSegments(): RoadSegmentSpec[] {
  const segs: RoadSegmentSpec[] = [];

  // East-West road segments between N-S intersections + outer stubs
  for (const zAxis of Z_AXES) {
    const width = zAxis.half * 2;
    const isMain = Math.abs(zAxis.z) === 26;
    const roadName =
      zAxis.z === -78
        ? 'North Civic Boulevard'
        : zAxis.z === -26
          ? 'Linden Boulevard'
          : zAxis.z === 26
            ? 'Oakwood Way'
            : 'South Expansion Way';

    // West outer stub
    segs.push({
      id: `ew-${zAxis.z}-wstub`,
      name: roadName,
      start: { x: -135, z: zAxis.z },
      end: { x: X_AXES[0].x - X_AXES[0].half, z: zAxis.z },
      width,
      hasDoubleCenterLine: isMain,
      isStubExtension: true,
    });

    for (let i = 0; i < X_AXES.length - 1; i++) {
      const a = X_AXES[i];
      const b = X_AXES[i + 1];
      segs.push({
        id: `ew-${zAxis.z}-${i}`,
        name: roadName,
        start: { x: a.x + a.half, z: zAxis.z },
        end: { x: b.x - b.half, z: zAxis.z },
        width,
        hasDoubleCenterLine: isMain,
      });
    }

    // East outer stub for future district growth
    segs.push({
      id: `ew-${zAxis.z}-estub`,
      name: roadName,
      start: { x: X_AXES[3].x + X_AXES[3].half, z: zAxis.z },
      end: { x: 140, z: zAxis.z },
      width,
      hasDoubleCenterLine: isMain,
      isStubExtension: true,
    });
  }

  // North-South road segments between E-W intersections + outer stubs
  for (const xAxis of X_AXES) {
    const width = xAxis.half * 2;
    const isMain = Math.abs(xAxis.x) === 26;
    const roadName =
      xAxis.x === -78
        ? 'West Canal Street'
        : xAxis.x === -26
          ? 'West Grand Avenue'
          : xAxis.x === 26
            ? 'East Grand Avenue'
            : 'East Horizon Street';

    segs.push({
      id: `ns-${xAxis.x}-nstub`,
      name: roadName,
      start: { x: xAxis.x, z: -130 },
      end: { x: xAxis.x, z: Z_AXES[0].z - Z_AXES[0].half },
      width,
      hasDoubleCenterLine: isMain,
      isStubExtension: true,
    });

    for (let i = 0; i < Z_AXES.length - 1; i++) {
      const a = Z_AXES[i];
      const b = Z_AXES[i + 1];
      segs.push({
        id: `ns-${xAxis.x}-${i}`,
        name: roadName,
        start: { x: xAxis.x, z: a.z + a.half },
        end: { x: xAxis.x, z: b.z - b.half },
        width,
        hasDoubleCenterLine: isMain,
      });
    }

    segs.push({
      id: `ns-${xAxis.x}-sstub`,
      name: roadName,
      start: { x: xAxis.x, z: Z_AXES[3].z + Z_AXES[3].half },
      end: { x: xAxis.x, z: 130 },
      width,
      hasDoubleCenterLine: isMain,
      isStubExtension: true,
    });
  }

  return segs;
}

export const ROAD_SEGMENTS: RoadSegmentSpec[] = buildRoadSegments();

function buildIntersections(): IntersectionSpec[] {
  const list: IntersectionSpec[] = [];
  for (const xAxis of X_AXES) {
    for (const zAxis of Z_AXES) {
      const isCentralCorner = Math.abs(xAxis.x) === 26 && Math.abs(zAxis.z) === 26;
      list.push({
        id: `int-${xAxis.x}-${zAxis.z}`,
        center: { x: xAxis.x, z: zAxis.z },
        width: xAxis.half * 2,
        depth: zAxis.half * 2,
        hasTrafficSignal: isCentralCorner,
        crosswalks: ['north', 'south', 'east', 'west'],
      });
    }
  }
  return list;
}

export const INTERSECTIONS: IntersectionSpec[] = buildIntersections();

export const ROUNDABOUT_CENTERS: Array<{ id: string; x: number; z: number }> = [
  { id: 'rb-west', x: -26, z: 0 },
  { id: 'rb-east', x: 26, z: 0 },
];

export interface SidewalkPadSpec {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
}

/**
 * Sidewalk perimeter rings framing all 9 interior blocks + outer West & East strips.
 */
function buildSidewalks(): SidewalkPadSpec[] {
  const pads: SidewalkPadSpec[] = [];
  const xBlocks = [
    { min: -73.5, max: -31.25 },
    { min: -20.75, max: 20.75 },
    { min: 31.25, max: 73.5 },
  ];
  const zBlocks = [
    { min: -73.5, max: -31.25 },
    { min: -20.75, max: 20.75 },
    { min: 31.25, max: 73.5 },
  ];

  xBlocks.forEach((xb, xi) => {
    zBlocks.forEach((zb, zi) => {
      const w = xb.max - xb.min;
      const d = zb.max - zb.min;
      const cx = (xb.min + xb.max) / 2;
      const cz = (zb.min + zb.max) / 2;
      const sw = SIDEWALK_WIDTH;

      // North & South sidewalks of block
      pads.push({ id: `sw-${xi}-${zi}-n`, x: cx, z: zb.min + sw / 2, width: w, depth: sw });
      pads.push({ id: `sw-${xi}-${zi}-s`, x: cx, z: zb.max - sw / 2, width: w, depth: sw });
      // West & East sidewalks of block (between N & S strips)
      pads.push({
        id: `sw-${xi}-${zi}-w`,
        x: xb.min + sw / 2,
        z: cz,
        width: sw,
        depth: d - sw * 2,
      });
      pads.push({
        id: `sw-${xi}-${zi}-e`,
        x: xb.max - sw / 2,
        z: cz,
        width: sw,
        depth: d - sw * 2,
      });
    });
  });

  // Outer West sidewalk facing X = -78 (along Z in [-73.5, +73.5])
  pads.push({ id: 'sw-outer-w', x: -83.9, z: 0, width: SIDEWALK_WIDTH, depth: 147 });
  // Outer East sidewalk facing X = +78 (along Z in [-20.75, +73.5])
  pads.push({ id: 'sw-outer-e', x: 83.9, z: 26.375, width: SIDEWALK_WIDTH, depth: 94.25 });

  return pads;
}

export const SIDEWALK_PADS: SidewalkPadSpec[] = buildSidewalks();

/**
 * Complete initial town plot registry across all 6 districts + Central Square Town Hall.
 */
export const INITIAL_TOWN_PLOTS: TownPlot[] = [
  // =========================================================================
  // CENTRAL TOWN SQUARE (X in [-17.95, 17.95], Z in [-17.95, 17.95])
  // =========================================================================
  {
    id: 'plot-town-hall',
    plotCode: 'CIVIC-01',
    districtId: 'central-square',
    address: '1 Town Square',
    category: 'public',
    center: { x: 0, z: -6.5 },
    width: 24,
    depth: 16,
    facingAngle: 0,
    ownershipStatus: 'civic',
    ownerUsername: 'City of Lindenhof',
    verificationState: 'verified-community',
    claimedAt: '2026-01-01',
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: {
      id: 'pub-town-hall',
      name: 'Lindenhof Town Hall',
      category: 'town-hall',
      description: 'Historic municipal seat with clocktower, civic council hall & public plaza.',
      width: 17.5,
      depth: 11.2,
      height: 11.5,
    },
    gardenTrees: [],
  },

  // =========================================================================
  // DISTRICT 1 — RESIDENTIAL (12 Plots: 9 Built Homes + 3 Open Fan Plots)
  // =========================================================================
  // West-Center Block: X in [-70.7, -34.05] (width 36.65 -> 2x 18.325), Z in [-17.95, +17.95] (depth 35.9 -> 2x 17.95)
  {
    id: 'res-01',
    plotCode: 'RES-01',
    districtId: 'district-1-residential',
    address: '12 Linden Boulevard',
    category: 'residential',
    center: { x: -61.53, z: -8.97 },
    width: 18.3,
    depth: 17.95,
    facingAngle: Math.PI,
    ownershipStatus: 'occupied',
    ownerUsername: 'H. Lindqvist',
    verificationState: 'verified-community',
    claimedAt: '2026-04-12',
    upgradeLevel: 1,
    house: {
      archetype: 'tudor',
      wallColor: '#f3ebd8',
      trimColor: '#4a3525',
      roofColor: '#9c4b34',
      accentColor: '#6d4c35',
      shutterColor: '#3f5d47',
      hasBalcony: false,
      hasChimney: true,
      hasDormers: true,
      hasGarageCarport: false,
      floors: 2,
      width: 9.2,
      depth: 7.8,
      wallHeight: 5.8,
    },
    gardenTrees: [
      { x: -6.2, z: 5.6, scale: 0.9, variant: 'ornamental' },
      { x: 6.2, z: -5.8, scale: 1.0, variant: 'broadleaf' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'res-02',
    plotCode: 'RES-02',
    districtId: 'district-1-residential',
    address: '14 Linden Boulevard',
    category: 'residential',
    center: { x: -43.21, z: -8.97 },
    width: 18.3,
    depth: 17.95,
    facingAngle: Math.PI,
    ownershipStatus: 'occupied',
    ownerUsername: 'M. Van Der Berg',
    verificationState: 'verified-community',
    claimedAt: '2026-04-19',
    upgradeLevel: 2,
    house: {
      archetype: 'townhouse',
      wallColor: '#9f4e3c',
      trimColor: '#f1ede4',
      roofColor: '#3d434c',
      accentColor: '#2d3748',
      shutterColor: '#253948',
      hasBalcony: true,
      hasChimney: true,
      hasDormers: false,
      hasGarageCarport: false,
      floors: 2,
      width: 8.2,
      depth: 8.4,
      wallHeight: 6.8,
    },
    gardenTrees: [
      { x: -6.2, z: -5.5, scale: 0.95, variant: 'cypress' },
      { x: -6.0, z: 5.2, scale: 0.85, variant: 'ornamental' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'res-03',
    plotCode: 'RES-03',
    districtId: 'district-1-residential',
    address: '11 Oakwood Way',
    category: 'residential',
    center: { x: -61.53, z: 8.97 },
    width: 18.3,
    depth: 17.95,
    facingAngle: 0,
    ownershipStatus: 'occupied',
    ownerUsername: 'C. Moreau',
    verificationState: 'verified-community',
    claimedAt: '2026-05-03',
    upgradeLevel: 1,
    house: {
      archetype: 'cottage',
      wallColor: '#e7dcc8',
      trimColor: '#d7cab2',
      roofColor: '#48505c',
      accentColor: '#7b8b72',
      shutterColor: '#69816e',
      hasBalcony: false,
      hasChimney: true,
      hasDormers: true,
      hasGarageCarport: false,
      floors: 2,
      width: 9.0,
      depth: 7.4,
      wallHeight: 5.0,
    },
    gardenTrees: [
      { x: -6.1, z: 5.2, scale: 0.9, variant: 'ornamental' },
      { x: 6.0, z: -6.0, scale: 1.05, variant: 'broadleaf' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'res-04',
    plotCode: 'RES-04',
    districtId: 'district-1-residential',
    address: '15 Oakwood Way',
    category: 'residential',
    center: { x: -43.21, z: 8.97 },
    width: 18.3,
    depth: 17.95,
    facingAngle: 0,
    ownershipStatus: 'occupied',
    ownerUsername: 'S. Solberg',
    verificationState: 'verified-community',
    claimedAt: '2026-05-22',
    upgradeLevel: 1,
    house: {
      archetype: 'nordic',
      wallColor: '#d9d4cb',
      trimColor: '#32373e',
      roofColor: '#2d333b',
      accentColor: '#a9774d',
      shutterColor: '#32373e',
      hasBalcony: true,
      hasChimney: true,
      hasDormers: false,
      hasGarageCarport: true,
      floors: 2,
      width: 9.4,
      depth: 7.6,
      wallHeight: 5.6,
    },
    gardenTrees: [
      { x: -6.1, z: 5.4, scale: 0.92, variant: 'cypress' },
      { x: 6.0, z: -5.8, scale: 1.08, variant: 'broadleaf' },
    ],
    business: null,
    publicBuilding: null,
  },

  // South-West Block: X in [-70.7, -34.05], Z in [34.05, 70.7]
  {
    id: 'res-05',
    plotCode: 'RES-05',
    districtId: 'district-1-residential',
    address: '10 Oakwood Way',
    category: 'residential',
    center: { x: -61.53, z: 43.21 },
    width: 18.3,
    depth: 18.3,
    facingAngle: Math.PI,
    ownershipStatus: 'occupied',
    ownerUsername: 'L. Rossi',
    verificationState: 'verified-community',
    claimedAt: '2026-06-01',
    upgradeLevel: 1,
    house: {
      archetype: 'mediterranean',
      wallColor: '#edd7b4',
      trimColor: '#f6efe4',
      roofColor: '#b05c3d',
      accentColor: '#7c5338',
      shutterColor: '#4c6d63',
      hasBalcony: true,
      hasChimney: true,
      hasDormers: false,
      hasGarageCarport: false,
      floors: 2,
      width: 9.2,
      depth: 8.0,
      wallHeight: 5.7,
    },
    gardenTrees: [
      { x: -6.2, z: 5.6, scale: 1.0, variant: 'cypress' },
      { x: 6.1, z: -5.8, scale: 0.9, variant: 'ornamental' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'res-06',
    plotCode: 'RES-06',
    districtId: 'district-1-residential',
    address: '14 Oakwood Way',
    category: 'residential',
    center: { x: -43.21, z: 43.21 },
    width: 18.3,
    depth: 18.3,
    facingAngle: Math.PI,
    ownershipStatus: 'occupied',
    ownerUsername: 'K. Weber',
    verificationState: 'verified-community',
    claimedAt: '2026-05-14',
    upgradeLevel: 2,
    house: {
      archetype: 'modern-villa',
      wallColor: '#f4f4f1',
      trimColor: '#2c3138',
      roofColor: '#2e333b',
      accentColor: '#a67b52',
      shutterColor: '#363b42',
      hasBalcony: true,
      hasChimney: false,
      hasDormers: false,
      hasGarageCarport: true,
      floors: 2,
      width: 9.8,
      depth: 8.2,
      wallHeight: 6.0,
    },
    gardenTrees: [
      { x: -6.3, z: 5.5, scale: 0.95, variant: 'cypress' },
      { x: -5.8, z: -6.0, scale: 1.0, variant: 'ornamental' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'res-07',
    plotCode: 'RES-07',
    districtId: 'district-1-residential',
    address: '5 South Expansion Way',
    category: 'residential',
    center: { x: -61.53, z: 61.53 },
    width: 18.3,
    depth: 18.3,
    facingAngle: 0,
    ownershipStatus: 'occupied',
    ownerUsername: 'J. Holm',
    verificationState: 'verified-community',
    claimedAt: '2026-07-11',
    upgradeLevel: 1,
    house: {
      archetype: 'nordic',
      wallColor: '#c6cbd0',
      trimColor: '#262b30',
      roofColor: '#282d33',
      accentColor: '#b38354',
      shutterColor: '#262b30',
      hasBalcony: true,
      hasChimney: true,
      hasDormers: false,
      hasGarageCarport: true,
      floors: 2,
      width: 9.2,
      depth: 7.6,
      wallHeight: 5.5,
    },
    gardenTrees: [
      { x: -6.2, z: 5.4, scale: 0.98, variant: 'cypress' },
      { x: 6.0, z: -5.8, scale: 0.9, variant: 'ornamental' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'res-08',
    plotCode: 'RES-08',
    districtId: 'district-1-residential',
    address: '9 South Expansion Way',
    category: 'residential',
    center: { x: -43.21, z: 61.53 },
    width: 18.3,
    depth: 18.3,
    facingAngle: 0,
    ownershipStatus: 'available',
    ownerUsername: null,
    verificationState: 'none',
    claimedAt: null,
    upgradeLevel: 1,
    house: null,
    gardenTrees: [
      { x: -6.4, z: -5.8, scale: 0.95, variant: 'broadleaf' },
      { x: 6.4, z: -5.5, scale: 0.9, variant: 'ornamental' },
    ],
    business: null,
    publicBuilding: null,
  },

  // Outer West Residential Row (X in [-105, -85.3], facing East +X onto West Canal St X = -78)
  {
    id: 'res-09',
    plotCode: 'RES-09',
    districtId: 'district-1-residential',
    address: '4 West Canal Street',
    category: 'residential',
    center: { x: -95.15, z: -43.21 },
    width: 18.3,
    depth: 19.7,
    facingAngle: Math.PI / 2,
    ownershipStatus: 'occupied',
    ownerUsername: 'E. Dubois',
    verificationState: 'verified-community',
    claimedAt: '2026-07-02',
    upgradeLevel: 1,
    house: {
      archetype: 'cottage',
      wallColor: '#ded6c6',
      trimColor: '#c9bfa8',
      roofColor: '#414954',
      accentColor: '#5c7288',
      shutterColor: '#546b82',
      hasBalcony: false,
      hasChimney: true,
      hasDormers: true,
      hasGarageCarport: false,
      floors: 2,
      width: 8.8,
      depth: 7.4,
      wallHeight: 4.9,
    },
    gardenTrees: [
      { x: -6.2, z: 5.8, scale: 0.9, variant: 'ornamental' },
      { x: 6.0, z: -6.2, scale: 1.05, variant: 'broadleaf' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'res-10',
    plotCode: 'RES-10',
    districtId: 'district-1-residential',
    address: '8 West Canal Street',
    category: 'residential',
    center: { x: -95.15, z: -8.97 },
    width: 17.95,
    depth: 19.7,
    facingAngle: Math.PI / 2,
    ownershipStatus: 'occupied',
    ownerUsername: 'F. Hartmann',
    verificationState: 'verified-community',
    claimedAt: '2026-06-15',
    upgradeLevel: 1,
    house: {
      archetype: 'tudor',
      wallColor: '#ebe1cc',
      trimColor: '#3f2c1f',
      roofColor: '#8d412e',
      accentColor: '#5c412d',
      shutterColor: '#6d352c',
      hasBalcony: false,
      hasChimney: true,
      hasDormers: true,
      hasGarageCarport: false,
      floors: 2,
      width: 9.0,
      depth: 7.8,
      wallHeight: 5.8,
    },
    gardenTrees: [
      { x: -6.2, z: 5.6, scale: 1.0, variant: 'broadleaf' },
      { x: 6.0, z: -6.0, scale: 0.9, variant: 'cypress' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'res-11',
    plotCode: 'RES-11',
    districtId: 'district-1-residential',
    address: '12 West Canal Street',
    category: 'residential',
    center: { x: -95.15, z: 8.97 },
    width: 17.95,
    depth: 19.7,
    facingAngle: Math.PI / 2,
    ownershipStatus: 'occupied',
    ownerUsername: 'N. Kowalski',
    verificationState: 'verified-community',
    claimedAt: '2026-06-21',
    upgradeLevel: 2,
    house: {
      archetype: 'modern-villa',
      wallColor: '#ebeae4',
      trimColor: '#2b3036',
      roofColor: '#25292e',
      accentColor: '#9c7853',
      shutterColor: '#31363c',
      hasBalcony: true,
      hasChimney: false,
      hasDormers: false,
      hasGarageCarport: true,
      floors: 2,
      width: 9.6,
      depth: 8.2,
      wallHeight: 5.9,
    },
    gardenTrees: [
      { x: -6.3, z: 5.6, scale: 0.95, variant: 'cypress' },
      { x: 6.2, z: -6.2, scale: 1.05, variant: 'broadleaf' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'res-12',
    plotCode: 'RES-12',
    districtId: 'district-1-residential',
    address: '16 West Canal Street',
    category: 'residential',
    center: { x: -95.15, z: 43.21 },
    width: 18.3,
    depth: 19.7,
    facingAngle: Math.PI / 2,
    ownershipStatus: 'available',
    ownerUsername: null,
    verificationState: 'none',
    claimedAt: null,
    upgradeLevel: 1,
    house: null,
    gardenTrees: [
      { x: -6.2, z: -6.0, scale: 0.95, variant: 'broadleaf' },
      { x: 6.2, z: -5.5, scale: 0.9, variant: 'cypress' },
    ],
    business: null,
    publicBuilding: null,
  },

  // =========================================================================
  // DISTRICT 4 — LUXURY RESIDENTIAL (North-West Block: X in [-70.7, -34.05], Z in [-70.7, -34.05])
  // =========================================================================
  {
    id: 'lux-01',
    plotCode: 'LUX-01',
    districtId: 'district-4-luxury',
    address: '1 Belvedere Crest',
    category: 'luxury-residential',
    center: { x: -61.53, z: -61.53 },
    width: 18.3,
    depth: 18.3,
    facingAngle: Math.PI,
    ownershipStatus: 'occupied',
    ownerUsername: 'A. Von Berg',
    verificationState: 'verified-community',
    claimedAt: '2026-03-15',
    upgradeLevel: 2,
    house: {
      archetype: 'luxury-modern',
      wallColor: '#f5f4f0',
      trimColor: '#25292e',
      roofColor: '#2c3138',
      accentColor: '#b38352',
      shutterColor: '#25292e',
      hasBalcony: true,
      hasChimney: false,
      hasDormers: false,
      hasGarageCarport: true,
      hasPool: true,
      floors: 2,
      width: 11.4,
      depth: 8.6,
      wallHeight: 6.6,
    },
    gardenTrees: [
      { x: -6.8, z: 5.5, scale: 1.05, variant: 'cypress' },
      { x: 6.8, z: 5.5, scale: 1.05, variant: 'cypress' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'lux-02',
    plotCode: 'LUX-02',
    districtId: 'district-4-luxury',
    address: '3 Belvedere Crest',
    category: 'luxury-residential',
    center: { x: -43.21, z: -61.53 },
    width: 18.3,
    depth: 18.3,
    facingAngle: Math.PI,
    ownershipStatus: 'occupied',
    ownerUsername: 'V. Castellano',
    verificationState: 'verified-community',
    claimedAt: '2026-03-22',
    upgradeLevel: 3,
    house: {
      archetype: 'luxury-mansion',
      wallColor: '#eee6d6',
      trimColor: '#d9ceb8',
      roofColor: '#363c46',
      accentColor: '#8d653d',
      shutterColor: '#354b44',
      hasBalcony: true,
      hasChimney: true,
      hasDormers: true,
      hasGarageCarport: true,
      hasPool: true,
      floors: 2,
      width: 11.6,
      depth: 8.4,
      wallHeight: 6.9,
    },
    gardenTrees: [
      { x: -6.8, z: -5.8, scale: 1.1, variant: 'broadleaf' },
      { x: 6.8, z: 5.6, scale: 1.0, variant: 'cypress' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'lux-03',
    plotCode: 'LUX-03',
    districtId: 'district-4-luxury',
    address: '2 Linden Estate Row',
    category: 'luxury-residential',
    center: { x: -61.53, z: -43.21 },
    width: 18.3,
    depth: 18.3,
    facingAngle: 0,
    ownershipStatus: 'occupied',
    ownerUsername: 'D. Lindholm',
    verificationState: 'verified-community',
    claimedAt: '2026-04-02',
    upgradeLevel: 2,
    house: {
      archetype: 'luxury-mansion',
      wallColor: '#e7dfd0',
      trimColor: '#c9bea6',
      roofColor: '#87402e',
      accentColor: '#6b4d35',
      shutterColor: '#3a5547',
      hasBalcony: true,
      hasChimney: true,
      hasDormers: true,
      hasGarageCarport: true,
      hasPool: true,
      floors: 2,
      width: 11.4,
      depth: 8.4,
      wallHeight: 6.7,
    },
    gardenTrees: [
      { x: -6.7, z: 5.6, scale: 1.05, variant: 'cypress' },
      { x: 6.6, z: -5.6, scale: 1.08, variant: 'broadleaf' },
    ],
    business: null,
    publicBuilding: null,
  },
  {
    id: 'lux-04',
    plotCode: 'LUX-04',
    districtId: 'district-4-luxury',
    address: '4 Linden Estate Row',
    category: 'luxury-residential',
    center: { x: -43.21, z: -43.21 },
    width: 18.3,
    depth: 18.3,
    facingAngle: 0,
    ownershipStatus: 'available',
    ownerUsername: null,
    verificationState: 'none',
    claimedAt: null,
    upgradeLevel: 1,
    house: null,
    gardenTrees: [
      { x: -6.5, z: -5.8, scale: 1.05, variant: 'cypress' },
      { x: 6.5, z: -5.8, scale: 1.05, variant: 'cypress' },
    ],
    business: null,
    publicBuilding: null,
  },

  // =========================================================================
  // DISTRICT 2 — COMMERCIAL (South-Center Block: X in [-17.95, 17.95], Z in [34.05, 70.7])
  // 6 Interactive Commercial Businesses along a central shopping street
  // =========================================================================
  {
    id: 'com-01',
    plotCode: 'COM-01',
    districtId: 'district-2-commercial',
    address: '2 Market Promenade',
    category: 'commercial',
    center: { x: -11.2, z: 40.5 },
    width: 11.4,
    depth: 11.8,
    facingAngle: Math.PI / 2,
    ownershipStatus: 'occupied',
    ownerUsername: 'Chef M. Laurent',
    verificationState: 'verified-community',
    claimedAt: '2026-02-10',
    upgradeLevel: 2,
    house: null,
    business: {
      id: 'biz-bistro',
      name: "Bistro L'Étoile",
      category: 'restaurant',
      ownerUsername: 'Chef M. Laurent',
      status: 'open',
      level: 2,
      dailyRevenue: 1450,
      primaryColor: '#e9dcc8',
      accentColor: '#9b3e33',
      width: 9.2,
      depth: 7.4,
      height: 5.4,
      hasOutdoorSeating: true,
    },
    publicBuilding: null,
    gardenTrees: [],
  },
  {
    id: 'com-02',
    plotCode: 'COM-02',
    districtId: 'district-2-commercial',
    address: '6 Market Promenade',
    category: 'commercial',
    center: { x: -11.2, z: 52.4 },
    width: 11.4,
    depth: 11.4,
    facingAngle: Math.PI / 2,
    ownershipStatus: 'occupied',
    ownerUsername: 'B. Lindner',
    verificationState: 'verified-community',
    claimedAt: '2026-02-14',
    upgradeLevel: 1,
    house: null,
    business: {
      id: 'biz-cafe',
      name: 'Café Linden & Bakery',
      category: 'cafe',
      ownerUsername: 'B. Lindner',
      status: 'open',
      level: 1,
      dailyRevenue: 880,
      primaryColor: '#f1eadc',
      accentColor: '#486855',
      width: 8.6,
      depth: 7.2,
      height: 4.8,
      hasOutdoorSeating: true,
    },
    publicBuilding: null,
    gardenTrees: [],
  },
  {
    id: 'com-03',
    plotCode: 'COM-03',
    districtId: 'district-2-commercial',
    address: '10 Market Promenade',
    category: 'commercial',
    center: { x: -11.2, z: 64.2 },
    width: 11.4,
    depth: 11.8,
    facingAngle: Math.PI / 2,
    ownershipStatus: 'occupied',
    ownerUsername: 'G. Bellini',
    verificationState: 'verified-community',
    claimedAt: '2026-02-22',
    upgradeLevel: 2,
    house: null,
    business: {
      id: 'biz-clothing',
      name: 'Atelier Moda',
      category: 'clothing',
      ownerUsername: 'G. Bellini',
      status: 'open',
      level: 2,
      dailyRevenue: 1120,
      primaryColor: '#dedad2',
      accentColor: '#2d3748',
      width: 8.8,
      depth: 7.4,
      height: 5.8,
      hasOutdoorSeating: false,
    },
    publicBuilding: null,
    gardenTrees: [],
  },
  {
    id: 'com-04',
    plotCode: 'COM-04',
    districtId: 'district-2-commercial',
    address: '3 Market Promenade',
    category: 'commercial',
    center: { x: 11.2, z: 40.5 },
    width: 11.4,
    depth: 11.8,
    facingAngle: -Math.PI / 2,
    ownershipStatus: 'occupied',
    ownerUsername: 'Linden Co-op',
    verificationState: 'verified-community',
    claimedAt: '2026-01-25',
    upgradeLevel: 2,
    house: null,
    business: {
      id: 'biz-market',
      name: 'Markthalle Fresh',
      category: 'supermarket',
      ownerUsername: 'Linden Co-op',
      status: 'open',
      level: 2,
      dailyRevenue: 2150,
      primaryColor: '#ece9e1',
      accentColor: '#3f6a4b',
      width: 9.8,
      depth: 8.0,
      height: 5.2,
      hasOutdoorSeating: false,
    },
    publicBuilding: null,
    gardenTrees: [],
  },
  {
    id: 'com-05',
    plotCode: 'COM-05',
    districtId: 'district-2-commercial',
    address: '7 Market Promenade',
    category: 'commercial',
    center: { x: 11.2, z: 52.4 },
    width: 11.4,
    depth: 11.4,
    facingAngle: -Math.PI / 2,
    ownershipStatus: 'occupied',
    ownerUsername: 'Autohaus Group',
    verificationState: 'verified-community',
    claimedAt: '2026-03-04',
    upgradeLevel: 2,
    house: null,
    business: {
      id: 'biz-dealer',
      name: 'Autohaus Linden',
      category: 'dealership',
      ownerUsername: 'Autohaus Group',
      status: 'open',
      level: 2,
      dailyRevenue: 2800,
      primaryColor: '#e4e7ec',
      accentColor: '#254a6e',
      width: 9.6,
      depth: 8.0,
      height: 5.0,
      hasOutdoorSeating: false,
    },
    publicBuilding: null,
    gardenTrees: [],
  },
  {
    id: 'com-06',
    plotCode: 'COM-06',
    districtId: 'district-2-commercial',
    address: '11 Market Promenade',
    category: 'commercial',
    center: { x: 11.2, z: 64.2 },
    width: 11.4,
    depth: 11.8,
    facingAngle: -Math.PI / 2,
    ownershipStatus: 'occupied',
    ownerUsername: null,
    verificationState: 'none',
    claimedAt: null,
    upgradeLevel: 1,
    house: null,
    business: {
      id: 'biz-office',
      name: 'Kronos Commerce House',
      category: 'office',
      ownerUsername: null,
      status: 'available',
      level: 1,
      dailyRevenue: 950,
      primaryColor: '#d9dde2',
      accentColor: '#374151',
      width: 9.0,
      depth: 7.6,
      height: 7.4,
      hasOutdoorSeating: false,
    },
    publicBuilding: null,
    gardenTrees: [],
  },

  // =========================================================================
  // DISTRICT 3 — PARK & ENTERTAINMENT (Cinema + Stadium Plots)
  // =========================================================================
  {
    id: 'ent-cinema',
    plotCode: 'ENT-01',
    districtId: 'district-3-park-entertainment',
    address: '18 East Grand Avenue',
    category: 'public',
    center: { x: 60.5, z: 9.5 },
    width: 18,
    depth: 15,
    facingAngle: -Math.PI / 2,
    ownershipStatus: 'civic',
    ownerUsername: 'Lindenhof Arts',
    verificationState: 'verified-community',
    claimedAt: '2026-02-01',
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: {
      id: 'pub-cinema',
      name: 'Lumière Cinema & Arts',
      category: 'cinema',
      description: 'Art-Deco neighborhood cinema, live stage, and weekend film nights.',
      width: 13.4,
      depth: 10.6,
      height: 7.2,
    },
    gardenTrees: [],
  },
  {
    id: 'ent-stadium',
    plotCode: 'ENT-02',
    districtId: 'district-3-park-entertainment',
    address: '10 Stadium Way',
    category: 'public',
    center: { x: 52.38, z: -52.38 },
    width: 35,
    depth: 35,
    facingAngle: 0,
    ownershipStatus: 'civic',
    ownerUsername: 'Lindenhof Athletic Club',
    verificationState: 'verified-community',
    claimedAt: '2026-01-15',
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: {
      id: 'pub-stadium',
      name: 'Lindenhof Arena & Sports',
      category: 'stadium',
      description: 'Community football pitch with floodlights, spectator stands & tennis court.',
      width: 28,
      depth: 22,
      height: 6.5,
    },
    gardenTrees: [],
  },

  // =========================================================================
  // DISTRICT 5 — PUBLIC SERVICES (North-Center Block: X in [-17.95, 17.95], Z in [-70.7, -34.05])
  // =========================================================================
  {
    id: 'pub-hospital',
    plotCode: 'PUB-01',
    districtId: 'district-5-public-services',
    address: '2 North Civic Boulevard',
    category: 'public',
    center: { x: -9.5, z: -61.5 },
    width: 16,
    depth: 16,
    facingAngle: Math.PI,
    ownershipStatus: 'civic',
    ownerUsername: 'Lindenhof Health',
    verificationState: 'verified-community',
    claimedAt: '2026-01-05',
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: {
      id: 'bldg-hospital',
      name: 'St. Luke General Hospital',
      category: 'hospital',
      description: '24-hour emergency clinic, outpatient care & ambulance bay.',
      width: 12.8,
      depth: 9.2,
      height: 7.6,
    },
    gardenTrees: [],
  },
  {
    id: 'pub-university',
    plotCode: 'PUB-02',
    districtId: 'district-5-public-services',
    address: '8 North Civic Boulevard',
    category: 'public',
    center: { x: 9.5, z: -61.5 },
    width: 16,
    depth: 16,
    facingAngle: Math.PI,
    ownershipStatus: 'civic',
    ownerUsername: 'Lindenhof University',
    verificationState: 'verified-community',
    claimedAt: '2026-01-05',
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: {
      id: 'bldg-university',
      name: 'Lindenhof University',
      category: 'university',
      description: 'Neoclassical lecture halls, architecture faculty & research library.',
      width: 13.0,
      depth: 9.4,
      height: 8.2,
    },
    gardenTrees: [],
  },
  {
    id: 'pub-school',
    plotCode: 'PUB-03',
    districtId: 'district-5-public-services',
    address: '15 Linden Boulevard',
    category: 'public',
    center: { x: -11.5, z: -43.2 },
    width: 12,
    depth: 14,
    facingAngle: 0,
    ownershipStatus: 'civic',
    ownerUsername: 'Public Education Board',
    verificationState: 'verified-community',
    claimedAt: '2026-01-05',
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: {
      id: 'bldg-school',
      name: 'Lindenhof Primary Academy',
      category: 'school',
      description: 'Neighborhood primary & secondary academy with clock bell gable.',
      width: 10.2,
      depth: 7.8,
      height: 5.8,
    },
    gardenTrees: [],
  },
  {
    id: 'pub-police',
    plotCode: 'PUB-04',
    districtId: 'district-5-public-services',
    address: '19 Linden Boulevard',
    category: 'public',
    center: { x: 0.2, z: -43.2 },
    width: 10.5,
    depth: 14,
    facingAngle: 0,
    ownershipStatus: 'civic',
    ownerUsername: 'Municipal Police',
    verificationState: 'verified-community',
    claimedAt: '2026-01-05',
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: {
      id: 'bldg-police',
      name: 'Municipal Police Precinct',
      category: 'police',
      description: 'Community safety headquarters & traffic coordination desk.',
      width: 8.6,
      depth: 7.4,
      height: 5.4,
    },
    gardenTrees: [],
  },
  {
    id: 'pub-fire',
    plotCode: 'PUB-05',
    districtId: 'district-5-public-services',
    address: '23 Linden Boulevard',
    category: 'public',
    center: { x: 11.8, z: -43.2 },
    width: 11,
    depth: 14,
    facingAngle: 0,
    ownershipStatus: 'civic',
    ownerUsername: 'Lindenhof Fire Dept',
    verificationState: 'verified-community',
    claimedAt: '2026-01-05',
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: {
      id: 'bldg-fire',
      name: 'Central Fire Station No. 1',
      category: 'fire-station',
      description: 'Dual engine bays, hose drying tower & rapid response crew.',
      width: 9.2,
      depth: 7.8,
      height: 6.2,
    },
    gardenTrees: [],
  },

  // =========================================================================
  // DISTRICT 6 — FUTURE EXPANSION (South-East Block + Outer East Reserve)
  // =========================================================================
  {
    id: 'exp-01',
    plotCode: 'EXP-01',
    districtId: 'district-6-expansion',
    address: '30 Oakwood Way',
    category: 'expansion-residential',
    center: { x: 43.21, z: 43.21 },
    width: 18.3,
    depth: 18.3,
    facingAngle: Math.PI,
    ownershipStatus: 'available',
    ownerUsername: null,
    verificationState: 'none',
    claimedAt: null,
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: null,
    gardenTrees: [{ x: -6.2, z: -6.0, scale: 0.9, variant: 'broadleaf' }],
  },
  {
    id: 'exp-02',
    plotCode: 'EXP-02',
    districtId: 'district-6-expansion',
    address: '34 Oakwood Way',
    category: 'expansion-residential',
    center: { x: 61.53, z: 43.21 },
    width: 18.3,
    depth: 18.3,
    facingAngle: Math.PI,
    ownershipStatus: 'available',
    ownerUsername: null,
    verificationState: 'none',
    claimedAt: null,
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: null,
    gardenTrees: [{ x: 6.2, z: -6.0, scale: 0.95, variant: 'cypress' }],
  },
  {
    id: 'exp-03',
    plotCode: 'EXP-03',
    districtId: 'district-6-expansion',
    address: '31 South Expansion Way',
    category: 'expansion-commercial',
    center: { x: 43.21, z: 61.53 },
    width: 18.3,
    depth: 18.3,
    facingAngle: 0,
    ownershipStatus: 'available',
    ownerUsername: null,
    verificationState: 'none',
    claimedAt: null,
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: null,
    gardenTrees: [],
  },
  {
    id: 'exp-04',
    plotCode: 'EXP-04',
    districtId: 'district-6-expansion',
    address: '35 South Expansion Way',
    category: 'expansion-commercial',
    center: { x: 61.53, z: 61.53 },
    width: 18.3,
    depth: 18.3,
    facingAngle: 0,
    ownershipStatus: 'available',
    ownerUsername: null,
    verificationState: 'none',
    claimedAt: null,
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: null,
    gardenTrees: [],
  },
  {
    id: 'exp-05',
    plotCode: 'EXP-05',
    districtId: 'district-6-expansion',
    address: '5 East Horizon Street',
    category: 'expansion-public',
    center: { x: 96.5, z: 43.21 },
    width: 18.3,
    depth: 22.0,
    facingAngle: -Math.PI / 2,
    ownershipStatus: 'reserved',
    ownerUsername: null,
    verificationState: 'none',
    claimedAt: null,
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: null,
    gardenTrees: [{ x: 6.8, z: -6.5, scale: 1.0, variant: 'broadleaf' }],
  },
  {
    id: 'exp-06',
    plotCode: 'EXP-06',
    districtId: 'district-6-expansion',
    address: '9 East Horizon Street',
    category: 'expansion-residential',
    center: { x: 96.5, z: 61.53 },
    width: 18.3,
    depth: 22.0,
    facingAngle: -Math.PI / 2,
    ownershipStatus: 'available',
    ownerUsername: null,
    verificationState: 'none',
    claimedAt: null,
    upgradeLevel: 1,
    house: null,
    business: null,
    publicBuilding: null,
    gardenTrees: [{ x: 6.5, z: 6.5, scale: 0.9, variant: 'ornamental' }],
  },
];

/**
 * Connected right-hand driving traffic loops across the 4x4 road grid.
 * Right-hand lane offsets (+2.25m when traveling +X or -Z; -2.25m when traveling -X or +Z).
 */
export const TRAFFIC_LOOPS: TrafficLoopSpec[] = [
  // Loop 1: Inner Ring Clockwise around Central Square (X = ±26, Z = ±26)
  {
    id: 'loop-central-cw',
    speedLimit: 8.6,
    waypoints: [
      { x: -18, z: -23.75 },
      { x: 18, z: -23.75 },
      { x: 23.75, z: -18 },
      { x: 23.75, z: 18 },
      { x: 18, z: 23.75 },
      { x: -18, z: 23.75 },
      { x: -23.75, z: 18 },
      { x: -23.75, z: -18 },
    ],
  },
  // Loop 2: Inner Ring Counter-Clockwise (outer right-hand lane of Central Ring)
  {
    id: 'loop-central-ccw',
    speedLimit: 8.2,
    waypoints: [
      { x: 20, z: -28.25 },
      { x: -20, z: -28.25 },
      { x: -28.25, z: -20 },
      { x: -28.25, z: 20 },
      { x: -20, z: 28.25 },
      { x: 20, z: 28.25 },
      { x: 28.25, z: 20 },
      { x: 28.25, z: -20 },
    ],
  },
  // Loop 3: West Residential & Luxury District Loop (X = -78..-26, Z = -78..+78)
  {
    id: 'loop-west-districts',
    speedLimit: 9.0,
    waypoints: [
      { x: -70, z: -75.75 },
      { x: -32, z: -75.75 },
      { x: -28.25, z: -70 },
      { x: -28.25, z: 70 },
      { x: -32, z: 75.75 },
      { x: -70, z: 75.75 },
      { x: -75.75, z: 70 },
      { x: -75.75, z: -70 },
    ],
  },
  // Loop 4: East Park, Stadium & Expansion Loop (X = +26..+78, Z = -78..+78)
  {
    id: 'loop-east-districts',
    speedLimit: 9.0,
    waypoints: [
      { x: 32, z: -75.75 },
      { x: 70, z: -75.75 },
      { x: 75.75, z: -70 },
      { x: 75.75, z: 70 },
      { x: 70, z: 75.75 },
      { x: 32, z: 75.75 },
      { x: 28.25, z: 70 },
      { x: 28.25, z: -70 },
    ],
  },
  // Loop 5: Grand Outer Perimeter Loop (X = ±78, Z = ±78)
  {
    id: 'loop-grand-outer',
    speedLimit: 9.6,
    waypoints: [
      { x: 72, z: -80.25 },
      { x: -72, z: -80.25 },
      { x: -80.25, z: -72 },
      { x: -80.25, z: 72 },
      { x: -72, z: 80.25 },
      { x: 72, z: 80.25 },
      { x: 80.25, z: 72 },
      { x: 80.25, z: -72 },
    ],
  },
];

/**
 * Sidewalk & park pedestrian promenade loops (y = SIDEWALK_HEIGHT).
 */
export const PEDESTRIAN_LOOPS: PedestrianLoopSpec[] = [
  // Central Town Square promenade
  {
    id: 'ped-town-square',
    walkSpeed: 1.3,
    waypoints: [
      { x: -13.5, z: 2.5 },
      { x: 13.5, z: 2.5 },
      { x: 13.5, z: 14.5 },
      { x: -13.5, z: 14.5 },
    ],
  },
  // Commercial Shopping Street Promenade
  {
    id: 'ped-commercial-street',
    walkSpeed: 1.35,
    waypoints: [
      { x: -2.0, z: 36.0 },
      { x: 2.0, z: 36.0 },
      { x: 2.0, z: 68.5 },
      { x: -2.0, z: 68.5 },
    ],
  },
  // Residential West-Center Sidewalk Loop
  {
    id: 'ped-residential-loop',
    walkSpeed: 1.4,
    waypoints: [
      { x: -72.1, z: -19.3 },
      { x: -32.6, z: -19.3 },
      { x: -32.6, z: 19.3 },
      { x: -72.1, z: 19.3 },
    ],
  },
  // Park & Lake Walking Path
  {
    id: 'ped-park-lake',
    walkSpeed: 1.25,
    waypoints: [
      { x: 35.5, z: -16.5 },
      { x: 67.5, z: -16.5 },
      { x: 67.5, z: -1.0 },
      { x: 35.5, z: -1.0 },
    ],
  },
  // Luxury District Boulevard Stroll
  {
    id: 'ped-luxury-loop',
    walkSpeed: 1.3,
    waypoints: [
      { x: -72.1, z: -72.1 },
      { x: -32.6, z: -72.1 },
      { x: -32.6, z: -32.6 },
      { x: -72.1, z: -32.6 },
    ],
  },
];

export interface StreetLampSpec {
  id: string;
  x: number;
  z: number;
  rotationY: number;
}

function buildStreetLamps(): StreetLampSpec[] {
  const lamps: StreetLampSpec[] = [];
  let idx = 1;
  // Along Central Ring & Main Boulevards
  for (const x of [-62, -42, -12, 12, 42, 62]) {
    lamps.push({ id: `lamp-${idx++}`, x, z: -20.0, rotationY: Math.PI });
    lamps.push({ id: `lamp-${idx++}`, x, z: 20.0, rotationY: 0 });
    lamps.push({ id: `lamp-${idx++}`, x, z: -32.0, rotationY: 0 });
    lamps.push({ id: `lamp-${idx++}`, x, z: 32.0, rotationY: Math.PI });
  }
  for (const z of [-62, -42, 42, 62]) {
    lamps.push({ id: `lamp-${idx++}`, x: -20.0, z, rotationY: -Math.PI / 2 });
    lamps.push({ id: `lamp-${idx++}`, x: 20.0, z, rotationY: Math.PI / 2 });
    lamps.push({ id: `lamp-${idx++}`, x: -32.0, z, rotationY: Math.PI / 2 });
    lamps.push({ id: `lamp-${idx++}`, x: 32.0, z, rotationY: -Math.PI / 2 });
  }
  return lamps;
}

export const STREET_LAMPS: StreetLampSpec[] = buildStreetLamps();

/**
 * Dedicated parked vehicles in Commercial & Public Service parking bays.
 */
export const PARKED_CARS: Array<{
  id: string;
  x: number;
  z: number;
  rotY: number;
  color: string;
  style: 'sedan' | 'hatchback' | 'wagon';
}> = [
  // Commercial Dealership forecourt & customer bays
  { id: 'pk-1', x: 14.5, z: 52.4, rotY: -Math.PI / 2, color: '#c93c34', style: 'sedan' },
  { id: 'pk-2', x: -16.0, z: 36.2, rotY: 0, color: '#2b4c6f', style: 'hatchback' },
  { id: 'pk-3', x: 16.0, z: 36.2, rotY: 0, color: '#d8d5cd', style: 'wagon' },
  // Hospital & Police Bays
  { id: 'pk-4', x: -15.5, z: -69.5, rotY: 0, color: '#f3f4f6', style: 'wagon' },
  { id: 'pk-5', x: 1.5, z: -36.5, rotY: Math.PI, color: '#1f3a5f', style: 'sedan' },
  // Stadium Parking
  { id: 'pk-6', x: 37.5, z: -68.5, rotY: Math.PI / 2, color: '#475569', style: 'hatchback' },
  { id: 'pk-7', x: 37.5, z: -64.5, rotY: Math.PI / 2, color: '#395a49', style: 'sedan' },
];

/**
 * Single source of truth for all 15 interactive benches across the town:
 * Central Town Square (5), District 3 Park (4), and District 2 Shopping Promenade (6).
 */
export const TOWN_BENCHES: import('../types').BenchSpec[] = [
  // Central Town Square
  { id: 'bench-sq-w', label: 'Town Square West Bench', districtId: 'central-square', x: -5.2, y: SIDEWALK_HEIGHT, z: 8.8, rotationY: Math.PI / 2 },
  { id: 'bench-sq-e', label: 'Town Square East Bench', districtId: 'central-square', x: 5.2, y: SIDEWALK_HEIGHT, z: 8.8, rotationY: -Math.PI / 2 },
  { id: 'bench-sq-s', label: 'Town Square South Bench', districtId: 'central-square', x: 0, y: SIDEWALK_HEIGHT, z: 14.2, rotationY: Math.PI },
  { id: 'bench-sq-nw', label: 'Town Hall Lawn Bench (W)', districtId: 'central-square', x: -8.6, y: SIDEWALK_HEIGHT, z: 3.2, rotationY: 0 },
  { id: 'bench-sq-ne', label: 'Town Hall Lawn Bench (E)', districtId: 'central-square', x: 8.6, y: SIDEWALK_HEIGHT, z: 3.2, rotationY: 0 },

  // District 3 Central Park
  { id: 'bench-park-fw', label: 'Park Fountain Bench (W)', districtId: 'district-3-park-entertainment', x: 38.2, y: SIDEWALK_HEIGHT, z: -1.0, rotationY: Math.PI / 2 },
  { id: 'bench-park-fe', label: 'Park Fountain Bench (E)', districtId: 'district-3-park-entertainment', x: 46.2, y: SIDEWALK_HEIGHT, z: -1.0, rotationY: -Math.PI / 2 },
  { id: 'bench-park-pg', label: 'Playground Bench', districtId: 'district-3-park-entertainment', x: 47.2, y: SIDEWALK_HEIGHT, z: 5.2, rotationY: -Math.PI / 2 },
  { id: 'bench-park-lake', label: 'Lakeside Bench', districtId: 'district-3-park-entertainment', x: 54.2, y: SIDEWALK_HEIGHT, z: -2.6, rotationY: 0 },

  // District 2 Commercial Promenade
  { id: 'bench-com-1w', label: 'Bistro Promenade Bench', districtId: 'district-2-commercial', x: -1.9, y: SIDEWALK_HEIGHT, z: 40.5, rotationY: -Math.PI / 2 },
  { id: 'bench-com-1e', label: 'Market Promenade Bench', districtId: 'district-2-commercial', x: 1.9, y: SIDEWALK_HEIGHT, z: 40.5, rotationY: Math.PI / 2 },
  { id: 'bench-com-2w', label: 'Café Promenade Bench', districtId: 'district-2-commercial', x: -1.9, y: SIDEWALK_HEIGHT, z: 52.4, rotationY: -Math.PI / 2 },
  { id: 'bench-com-2e', label: 'Autohaus Promenade Bench', districtId: 'district-2-commercial', x: 1.9, y: SIDEWALK_HEIGHT, z: 52.4, rotationY: Math.PI / 2 },
  { id: 'bench-com-3w', label: 'Boutique Promenade Bench', districtId: 'district-2-commercial', x: -1.9, y: SIDEWALK_HEIGHT, z: 64.2, rotationY: -Math.PI / 2 },
  { id: 'bench-com-3e', label: 'Commerce Promenade Bench', districtId: 'district-2-commercial', x: 1.9, y: SIDEWALK_HEIGHT, z: 64.2, rotationY: Math.PI / 2 },
];

