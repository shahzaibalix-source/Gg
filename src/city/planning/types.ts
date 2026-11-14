import {
  DistrictChunk,
  IntersectionSpec,
  RoadSegmentSpec,
  TownPlot,
} from '../types';
import type { SidewalkPadSpec } from '../world/MasterTownBlueprint';

export type CardinalDirection = 'north' | 'south' | 'east' | 'west';

export interface RectBounds2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface UrbanPlanConfig {
  primaryRoadWidth: number;
  secondaryRoadWidth: number;
  sidewalkWidth: number;
  plannedPlotWidth: number;
  plannedPlotDepth: number;
  drivewayWidth: number;
  pathwayWidth: number;
  treeSpacing: number;
  blockSeeds: Record<string, number>;
  expansionBlockCount: number;
}

export const DEFAULT_URBAN_PLAN_CONFIG: UrbanPlanConfig = {
  primaryRoadWidth: 10.5,
  secondaryRoadWidth: 9.0,
  sidewalkWidth: 2.8,
  plannedPlotWidth: 18.3,
  plannedPlotDepth: 18.3,
  drivewayWidth: 3.2,
  pathwayWidth: 2.4,
  treeSpacing: 13.0,
  blockSeeds: {
    'block-1-belvedere-west': 0,
    'block-2-oakwood-southwest': 0,
    'block-3-south-meadows': 0,
    'block-4-east-parkside': 0,
    'block-5-west-horizon': 0,
  },
  expansionBlockCount: 0,
};

export interface PlannedResidentialBlock {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  isExpansionBlock: boolean;
  seed: number;
  bounds: RectBounds2D;
  center: { x: number; z: number };
  boundingRoadIds: string[];
  plotIds: string[];
}

export interface PlannedPlotGeometry {
  plotId: string;
  plotCode: string;
  blockId: string;
  bounds: RectBounds2D;
  center: { x: number; z: number };
  width: number;
  depth: number;
  houseCoords: { x: number; z: number };
  houseRotation: number;
  frontDirection: CardinalDirection;
  frontYardDepth: number;
  backYardDepth: number;
  garageCoords: { x: number; z: number } | null;
  drivewaySegment: {
    startX: number;
    startZ: number;
    endX: number;
    endZ: number;
    width: number;
    connectedRoadId: string | null;
    connectedRoadEdgeDist: number;
  };
  pedestrianPathSegment: {
    startX: number;
    startZ: number;
    endX: number;
    endZ: number;
    width: number;
    connectedSidewalkId: string | null;
    connectedSidewalkDist: number;
  };
  fenceBounds: RectBounds2D;
  gateOpenings: {
    pedestrianX: number;
    pedestrianZ: number;
    drivewayX: number;
    drivewayZ: number;
  };
  connectedRoadId: string | null;
  connectedRoadName: string | null;
}

export interface PlannedGreenBelt {
  id: string;
  name: string;
  bounds: RectBounds2D;
}

export interface PlacedTreeSpec {
  id: string;
  x: number;
  z: number;
  scale: number;
  variant: 'broadleaf' | 'cypress' | 'ornamental';
  rotationY: number;
  hasPit: boolean;
  zone: 'roadside' | 'park' | 'green-belt' | 'plot-garden';
  parentId: string;
}

export interface PlannedStreetLampSpec {
  id: string;
  x: number;
  z: number;
  rotationY: number;
  roadId: string;
}

export interface PlannedBenchSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  zone: string;
}

export interface PlannedObjectRecord {
  id: string;
  kind:
    | 'house'
    | 'garage'
    | 'driveway'
    | 'pathway'
    | 'fence'
    | 'tree'
    | 'lamp'
    | 'bench'
    | 'fountain'
    | 'playground'
    | 'civic';
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation: number;
  plotId?: string;
  blockId?: string;
}

export interface CityGenerationStageReport {
  stage: number;
  key: string;
  title: string;
  description: string;
  generatedCount: number;
  summary: string;
  status: 'complete' | 'warning';
}

export interface OverlapViolation {
  id: string;
  severity: 'error' | 'warning';
  category:
    | 'plot-overlap'
    | 'plot-road'
    | 'house-bounds'
    | 'tree-clearance'
    | 'connectivity'
    | 'object-overlap';
  objectA: string;
  objectB: string;
  x: number;
  z: number;
  overlapAmount: number;
  message: string;
}

export interface ValidationReport {
  isValid: boolean;
  checkedAt: number;
  errorCount: number;
  warningCount: number;
  violations: OverlapViolation[];
  stats: {
    totalObjectsChecked: number;
    disconnectedDriveways: number;
    disconnectedWalkways: number;
    treesCleared: number;
  };
}

export interface CentralParkPlan {
  bounds: RectBounds2D;
  fountain: { x: number; z: number };
  lakeBounds: RectBounds2D;
  playgrounds: Array<{ id: string; name: string; x: number; z: number }>;
  pedestrianConnections: Array<{ id: string; x: number; z: number; connectsTo: string }>;
}

export interface MasterCityMap {
  config: UrbanPlanConfig;
  cityBoundary: RectBounds2D;
  districts: DistrictChunk[];
  roads: RoadSegmentSpec[];
  intersections: IntersectionSpec[];
  sidewalks: SidewalkPadSpec[];
  centralPark: CentralParkPlan;
  greenBelts: PlannedGreenBelt[];
  residentialBlocks: PlannedResidentialBlock[];
  plots: TownPlot[];
  plannedPlotGeometries: PlannedPlotGeometry[];
  plotGeometryById: Record<string, PlannedPlotGeometry>;
  streetLamps: PlannedStreetLampSpec[];
  benches: PlannedBenchSpec[];
  roadsideTrees: PlacedTreeSpec[];
  roadsideBushes: Array<{ x: number; z: number; sx: number; sy: number; sz: number; tint: string }>;
  objects: PlannedObjectRecord[];
  stages: CityGenerationStageReport[];
  validation: ValidationReport;
}
