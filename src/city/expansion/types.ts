import { DistrictId, HouseStyleSpec } from '../types';

export type ResidentTier = 'vip-1' | 'og-50' | 'resident';

export type ExpansionDistrictId =
  | 'og-premium-district'
  | 'oakwood-district'
  | 'riverside-district'
  | 'greenfield-district'
  | 'maplewood-district'
  | 'highland-district'
  | 'lakeside-district'
  | 'central-gardens'
  | 'botanical-gardens'
  | 'waterfront-lake-district';

export type CityPhaseMode = 'phase-1' | 'phase-2' | 'full';

export interface FollowerRecord {
  /** Permanent Resident ID: e.g. RES-0001 .. RES-3447 */
  residentId: string;
  /** Unique Plot ID matching ExpansionPlotSpec.plotId */
  plotId: string;
  /** Human-readable Plot Code: OG-01..OG-50, LDF-0051..LDF-3447 */
  plotCode: string;
  /** Exact Instagram username from verified follower export */
  username: string;
  /** Normalized lowercase key for deduplication */
  usernameKey: string;
  /** Verified join date string from Instagram followers_1.html */
  joinedAt: string;
  /** Epoch timestamp (ms) parsed from joinedAt */
  joinedTimestamp: number;
  /** Original 0-based order inside followers_1.html */
  originalOrder: number;
  /** Chronological rank from oldest (1) to newest (N) */
  oldestRank: number;
  /** Special recognition tier */
  tier: ResidentTier;
  /** 1..50 for the 50 OG Members (1 = Sweet_thedevil) */
  ogRank: number | null;
}

export interface CompactShardEntry {
  /** residentId */
  r: string;
  /** plotId */
  p: string;
  /** plotCode */
  c: string;
  /** exact username */
  u: string;
  /** joinedAt */
  j: string;
  /** joinedTimestamp */
  ts: number;
  /** originalOrder */
  o: number;
  /** oldestRank */
  k: number;
  /** tier */
  t: ResidentTier;
  /** ogRank (optional) */
  g?: number;
}

export interface ExpansionManifest {
  sourceArchiveName: string;
  totalRawFollowers: number;
  uniqueFollowers: number;
  duplicatesRemoved: number;
  ogCount: number;
  remainingResidents: number;
  expansionOpenPlots: number;
  vipUsername: string;
  vipPlotCode: string;
  shardCount: number;
  verifiedInFirestore: boolean;
  importedAt: string;
}

export interface ParsedFollowerDataset {
  sourceName: string;
  totalRawFollowers: number;
  uniqueFollowers: number;
  duplicatesRemoved: number;
  ogMembers: FollowerRecord[];
  remainingResidents: FollowerRecord[];
  allResidents: FollowerRecord[];
  vipRecord: FollowerRecord | null;
}

export interface ExpansionPlotSpec {
  plotId: string;
  plotCode: string;
  districtId: ExpansionDistrictId;
  coreDistrictId: DistrictId;
  districtName: string;
  address: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  facingAngle: number;
  status: 'vip' | 'og' | 'occupied' | 'expansion-open';
  resident: FollowerRecord | null;
  houseStyle: HouseStyleSpec | null;
  gardenTreeCount: 1 | 2 | 3;
  gardenFlowerTint: string;
}

export interface ExpansionRoadSpec {
  id: string;
  name: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  hasDoubleCenterLine: boolean;
  hasDashedCenterLine?: boolean;
  roadTier?: 'boulevard' | 'collector' | 'residential' | 'scenic-curve';
  isMainAvenue?: boolean;
}

export interface CurvedRoadSplineSpec {
  id: string;
  name: string;
  districtId: ExpansionDistrictId;
  tier: 'collector' | 'residential' | 'scenic-curve';
  width: number;
  sidewalkWidth: number;
  greenStripWidth: number;
  controlPoints: Array<{ x: number; z: number }>;
  sampledPoints: Array<{ x: number; z: number }>;
  hasDoubleCenterLine: boolean;
  hasDashedCenterLine: boolean;
  closed?: boolean;
}

export interface RoundaboutSpec {
  id: string;
  name: string;
  districtId: ExpansionDistrictId;
  x: number;
  z: number;
  innerRadius: number;
  roadWidth: number;
  sidewalkWidth: number;
  hasFountain: boolean;
}

export interface OgPocketGardenSpec {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  flowerTint: string;
  hasBench: boolean;
}

export interface ExpansionCanalSpec {
  id: string;
  name: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
}

export interface ExpansionBridgeSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  length: number;
  width: number;
  rotY: number;
  kind: 'road' | 'pedestrian';
}

export type DistrictParkVariant =
  | 'pine-pavilion'
  | 'rose-fountain'
  | 'courtyard-pool'
  | 'orchard-playground'
  | 'lily-pond'
  | 'valley-meadow'
  | 'garden-rotunda';

export interface DistrictParkSpec {
  id: string;
  name: string;
  districtId: ExpansionDistrictId;
  x: number;
  z: number;
  width: number;
  depth: number;
  variant: DistrictParkVariant;
}

export interface BusStopSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  rotY: number;
  districtId: ExpansionDistrictId;
}

export interface CrosswalkSpec {
  id: string;
  x: number;
  z: number;
  rotY: number;
  width: number;
}

export interface ExpansionDistrictZone {
  id: ExpansionDistrictId;
  name: string;
  subtitle: string;
  architecturalTheme?: string;
  color: string;
  center: { x: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  targetCapacity?: number;
}

export interface ExpansionLandmarkSpec {
  id: string;
  title: string;
  subtitle: string;
  category: 'vip-palace' | 'monument' | 'botanical' | 'waterfront' | 'expansion';
  x: number;
  z: number;
  radius: number;
}
