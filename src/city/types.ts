export type HouseArchetype =
  | 'tudor'
  | 'townhouse'
  | 'nordic'
  | 'modern-villa'
  | 'cottage'
  | 'mediterranean'
  | 'luxury-mansion'
  | 'luxury-modern';

export type BusinessCategory =
  | 'restaurant'
  | 'cafe'
  | 'supermarket'
  | 'clothing'
  | 'dealership'
  | 'office';

export type PublicBuildingCategory =
  | 'town-hall'
  | 'hospital'
  | 'school'
  | 'university'
  | 'police'
  | 'fire-station'
  | 'cinema'
  | 'stadium';

export type DistrictId =
  | 'central-square'
  | 'district-1-residential'
  | 'district-2-commercial'
  | 'district-3-park-entertainment'
  | 'district-4-luxury'
  | 'district-5-public-services'
  | 'district-6-expansion';

export type PlotCategory =
  | 'residential'
  | 'luxury-residential'
  | 'commercial'
  | 'public'
  | 'expansion-residential'
  | 'expansion-commercial'
  | 'expansion-public';

export type OwnershipStatus = 'occupied' | 'available' | 'reserved' | 'civic';

export type CameraMode = 'free' | 'aerial' | 'isometric' | 'walking' | 'cinematic';

export type CinematicTourId =
  | 'town-hall-reveal'
  | 'residential-flyover'
  | 'luxury-flyover'
  | 'commercial-park-tour'
  | 'full-town-loop';

export type TimeOfDay = 'morning' | 'afternoon' | 'sunset' | 'night';

export type WeatherMode = 'sunny' | 'cloudy' | 'rainy' | 'foggy';

export type UserRole = 'visitor' | 'super-admin';

export interface MobileInputState {
  moveX: number;
  moveY: number;
  sprint: boolean;
}

export interface BenchSpec {
  id: string;
  label: string;
  districtId: DistrictId;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  occupiedByUserId?: string | null;
}

export interface PlayerProfile {
  displayName: string;
  jacketColor: string;
  trouserColor: string;
  ownedPlotId: string | null;
}

export interface TownPublicSettings {
  welcomeTitle: string;
  welcomeSubtitle: string;
  instagramUrl: string;
  instagramInstruction: string;
}

export interface PrivateResidentRecord {
  plotId: string;
  inGameUsername: string;
  instagramHandle: string;
  notes: string;
}

export type InteractableKind = 'bench' | 'house' | 'shop' | 'vehicle' | 'park' | 'civic';

export type InteractionActionId =
  | 'sit'
  | 'stand-up'
  | 'view-house'
  | 'view-owner'
  | 'toggle-door'
  | 'inspect-vehicle'
  | 'view-shop'
  | 'explore-park'
  | 'view-park-info'
  | 'view-town-info';

export interface InteractionButtonSpec {
  id: InteractionActionId;
  label: string;
  disabled?: boolean;
  reason?: string;
}

export interface NearbyInteractable {
  uid: string;
  kind: InteractableKind;
  title: string;
  subtitle: string;
  distance: number;
  plotId?: string;
  benchId?: string;
  vehicleId?: string;
  actions: InteractionButtonSpec[];
}

export interface Vec2 {
  x: number;
  z: number;
}

export interface PlotBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface HouseStyleSpec {
  archetype: HouseArchetype;
  wallColor: string;
  trimColor: string;
  roofColor: string;
  accentColor: string;
  shutterColor: string;
  hasBalcony: boolean;
  hasChimney: boolean;
  hasDormers: boolean;
  hasGarageCarport: boolean;
  hasPool?: boolean;
  floors: 1 | 2 | 3;
  width: number;
  depth: number;
  wallHeight: number;
}

export interface BusinessSpec {
  id: string;
  name: string;
  category: BusinessCategory;
  ownerUsername: string | null;
  status: 'open' | 'upgrading' | 'available';
  level: 1 | 2 | 3;
  dailyRevenue: number;
  primaryColor: string;
  accentColor: string;
  width: number;
  depth: number;
  height: number;
  hasOutdoorSeating: boolean;
}

export interface PublicBuildingSpec {
  id: string;
  name: string;
  category: PublicBuildingCategory;
  description: string;
  width: number;
  depth: number;
  height: number;
}

export interface TownPlot {
  id: string;
  plotCode: string;
  districtId: DistrictId;
  address: string;
  category: PlotCategory;
  center: Vec2;
  width: number;
  depth: number;
  facingAngle: number;
  ownershipStatus: OwnershipStatus;
  /** Verified community member handle, or null if unclaimed */
  ownerUsername: string | null;
  /** Authenticated owner UID when claimed via Firebase Auth */
  ownerUid?: string | null;
  /** Explicit verification state — manual entry alone is never marked Instagram-verified */
  verificationState: 'unverified-local' | 'pending-oauth' | 'verified-community' | 'none';
  claimedAt: string | null;
  upgradeLevel: 1 | 2 | 3;
  house: HouseStyleSpec | null;
  business: BusinessSpec | null;
  publicBuilding: PublicBuildingSpec | null;
  gardenTrees: Array<{
    x: number;
    z: number;
    scale: number;
    variant: 'broadleaf' | 'cypress' | 'ornamental';
  }>;
}

export interface RoadSegmentSpec {
  id: string;
  name: string;
  start: Vec2;
  end: Vec2;
  width: number;
  hasDoubleCenterLine: boolean;
  isStubExtension?: boolean;
}

export interface IntersectionSpec {
  id: string;
  center: Vec2;
  width: number;
  depth: number;
  hasTrafficSignal: boolean;
  crosswalks: Array<'north' | 'south' | 'east' | 'west'>;
}

export interface TrafficLoopSpec {
  id: string;
  waypoints: Vec2[];
  speedLimit: number;
}

export interface PedestrianLoopSpec {
  id: string;
  waypoints: Vec2[];
  walkSpeed: number;
}

export interface DistrictChunk {
  id: DistrictId;
  name: string;
  subtitle: string;
  center: Vec2;
  bounds: PlotBounds;
}

export interface TownFinancialStats {
  totalPopulation: number;
  totalHouses: number;
  occupiedPlots: number;
  availablePlots: number;
  businessCount: number;
  vehicleCount: number;
  publicBuildingCount: number;
  townTreasury: number;
  dailyBusinessIncome: number;
}

export interface ConstructionDraft {
  mode: 'idle' | 'place' | 'move';
  targetPlotId: string | null;
  sourcePlotId: string | null;
  buildingType: 'house' | 'business';
  houseArchetype: HouseArchetype;
  businessCategory: BusinessCategory;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
}
