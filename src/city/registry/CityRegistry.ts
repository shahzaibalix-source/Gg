import {
  BusinessCategory,
  BusinessSpec,
  DistrictChunk,
  HouseArchetype,
  HouseStyleSpec,
  TownFinancialStats,
  TownPlot,
} from '../types';
import { DISTRICTS, INITIAL_TOWN_PLOTS } from '../world/MasterTownBlueprint';
import type { TownPlotOverridePayload } from '../firebase/firebaseClient';

export const ARCHETYPE_LABELS: Record<HouseArchetype, string> = {
  tudor: 'Bavarian Half-Timbered',
  townhouse: 'Dutch Canal Townhouse',
  nordic: 'Scandinavian Timber',
  'modern-villa': 'Modern Family Home',
  cottage: 'French Limestone Cottage',
  mediterranean: 'Mediterranean Villa',
  'luxury-mansion': 'Luxury European Mansion',
  'luxury-modern': 'Luxury Modern Estate',
};

export const BUSINESS_LABELS: Record<BusinessCategory, string> = {
  restaurant: 'Bistro / Restaurant',
  cafe: 'Café & Bakery',
  supermarket: 'Fresh Market',
  clothing: 'Fashion Boutique',
  dealership: 'Car Dealership',
  office: 'Commerce Office',
};

export const HOUSE_PRESETS: Record<HouseArchetype, HouseStyleSpec> = {
  tudor: {
    archetype: 'tudor',
    wallColor: '#f2ead7',
    trimColor: '#483324',
    roofColor: '#984832',
    accentColor: '#664631',
    shutterColor: '#3f5c46',
    hasBalcony: false,
    hasChimney: true,
    hasDormers: true,
    hasGarageCarport: false,
    floors: 2,
    width: 9.0,
    depth: 7.8,
    wallHeight: 5.7,
  },
  townhouse: {
    archetype: 'townhouse',
    wallColor: '#9a4d3b',
    trimColor: '#f1ede4',
    roofColor: '#3c424b',
    accentColor: '#2d3748',
    shutterColor: '#263a47',
    hasBalcony: true,
    hasChimney: true,
    hasDormers: false,
    hasGarageCarport: false,
    floors: 2,
    width: 8.2,
    depth: 8.4,
    wallHeight: 6.8,
  },
  nordic: {
    archetype: 'nordic',
    wallColor: '#d7d3ca',
    trimColor: '#30353c',
    roofColor: '#2c323a',
    accentColor: '#ab784d',
    shutterColor: '#30353c',
    hasBalcony: true,
    hasChimney: true,
    hasDormers: false,
    hasGarageCarport: true,
    floors: 2,
    width: 9.3,
    depth: 7.6,
    wallHeight: 5.5,
  },
  'modern-villa': {
    archetype: 'modern-villa',
    wallColor: '#f2f2ee',
    trimColor: '#2a2f36',
    roofColor: '#2d3239',
    accentColor: '#a2774f',
    shutterColor: '#353a41',
    hasBalcony: true,
    hasChimney: false,
    hasDormers: false,
    hasGarageCarport: true,
    floors: 2,
    width: 9.6,
    depth: 8.2,
    wallHeight: 5.9,
  },
  cottage: {
    archetype: 'cottage',
    wallColor: '#e5dac6',
    trimColor: '#d6c8b0',
    roofColor: '#454d59',
    accentColor: '#76866d',
    shutterColor: '#667d6a',
    hasBalcony: false,
    hasChimney: true,
    hasDormers: true,
    hasGarageCarport: false,
    floors: 2,
    width: 8.9,
    depth: 7.4,
    wallHeight: 5.0,
  },
  mediterranean: {
    archetype: 'mediterranean',
    wallColor: '#ebd4af',
    trimColor: '#f6efe4',
    roofColor: '#ae5b3c',
    accentColor: '#7a5237',
    shutterColor: '#48685f',
    hasBalcony: true,
    hasChimney: true,
    hasDormers: false,
    hasGarageCarport: false,
    floors: 2,
    width: 9.1,
    depth: 8.0,
    wallHeight: 5.7,
  },
  'luxury-mansion': {
    archetype: 'luxury-mansion',
    wallColor: '#eee6d6',
    trimColor: '#d5cab2',
    roofColor: '#363c46',
    accentColor: '#8d653d',
    shutterColor: '#354b44',
    hasBalcony: true,
    hasChimney: true,
    hasDormers: true,
    hasGarageCarport: true,
    hasPool: true,
    floors: 2,
    width: 11.4,
    depth: 8.4,
    wallHeight: 6.8,
  },
  'luxury-modern': {
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
    width: 11.2,
    depth: 8.5,
    wallHeight: 6.5,
  },
};

export function createBusinessPreset(
  category: BusinessCategory,
  plotId: string,
  ownerUsername: string | null,
): BusinessSpec {
  const configs: Record<
    BusinessCategory,
    Omit<BusinessSpec, 'id' | 'ownerUsername' | 'status' | 'level'>
  > = {
    restaurant: {
      name: 'New Neighborhood Bistro',
      category: 'restaurant',
      dailyRevenue: 1150,
      primaryColor: '#e9dcc8',
      accentColor: '#9b3e33',
      width: 9.2,
      depth: 7.4,
      height: 5.4,
      hasOutdoorSeating: true,
    },
    cafe: {
      name: 'Corner Espresso & Bakery',
      category: 'cafe',
      dailyRevenue: 860,
      primaryColor: '#f1eadc',
      accentColor: '#486855',
      width: 8.6,
      depth: 7.2,
      height: 4.8,
      hasOutdoorSeating: true,
    },
    supermarket: {
      name: 'Town Fresh Market',
      category: 'supermarket',
      dailyRevenue: 1750,
      primaryColor: '#ece9e1',
      accentColor: '#3f6a4b',
      width: 9.8,
      depth: 8.0,
      height: 5.2,
      hasOutdoorSeating: false,
    },
    clothing: {
      name: 'Atelier Boutique',
      category: 'clothing',
      dailyRevenue: 980,
      primaryColor: '#dedad2',
      accentColor: '#2d3748',
      width: 8.8,
      depth: 7.4,
      height: 5.6,
      hasOutdoorSeating: false,
    },
    dealership: {
      name: 'Linden Motors Showroom',
      category: 'dealership',
      dailyRevenue: 2300,
      primaryColor: '#e4e7ec',
      accentColor: '#254a6e',
      width: 9.6,
      depth: 8.0,
      height: 5.0,
      hasOutdoorSeating: false,
    },
    office: {
      name: 'Community Studio House',
      category: 'office',
      dailyRevenue: 920,
      primaryColor: '#d9dde2',
      accentColor: '#374151',
      width: 9.0,
      depth: 7.6,
      height: 7.0,
      hasOutdoorSeating: false,
    },
  };
  const base = configs[category];
  return {
    ...base,
    id: `biz-${plotId}`,
    ownerUsername,
    status: ownerUsername ? 'open' : 'available',
    level: 1,
  };
}

/**
 * Spatial chunked CityRegistry supporting 1,000+ plots via O(1) spatial hash buckets,
 * residential ownership, business economy, and permission-checked construction editing.
 */
export class CityRegistry {
  private districts: Map<string, DistrictChunk> = new Map();
  private plots: Map<string, TownPlot> = new Map();
  private basePlots: Map<string, TownPlot> = new Map();
  private spatialIndex: Map<string, string[]> = new Map();
  private treasuryBalance: number = 42500;
  private readonly chunkSize = 120;

  constructor(initialPlots: TownPlot[] = INITIAL_TOWN_PLOTS) {
    for (const d of DISTRICTS) {
      this.districts.set(d.id, d);
    }

    for (const base of initialPlots) {
      this.basePlots.set(base.id, base);
      this.registerPlot(base);
    }
  }

  public setTreasuryBalance(balance: number): void {
    this.treasuryBalance = balance;
  }

  public applyRemoteOverrides(overrides: Record<string, TownPlotOverridePayload>): void {
    for (const [id, base] of this.basePlots.entries()) {
      const ov = overrides[id];
      if (!ov) {
        this.plots.set(id, base);
        continue;
      }

      let house: HouseStyleSpec | null = base.house;
      if (ov.houseArchetype && ov.houseArchetype in HOUSE_PRESETS) {
        const preset = HOUSE_PRESETS[ov.houseArchetype as HouseArchetype];
        house = {
          ...preset,
          hasGarageCarport: ov.hasGarageCarport,
          hasPool: ov.hasPool,
          hasBalcony: ov.hasBalcony,
        };
      } else if (ov.houseArchetype === '' && !ov.businessCategory && ov.ownershipStatus === 'available') {
        house = null;
      }

      let business: BusinessSpec | null = base.business;
      if (ov.businessCategory && ov.businessCategory in BUSINESS_LABELS) {
        const preset = createBusinessPreset(
          ov.businessCategory as BusinessCategory,
          id,
          ov.businessOwnerUsername || null,
        );
        business = {
          ...preset,
          name: ov.businessName || preset.name,
          ownerUsername: ov.businessOwnerUsername || null,
          status: ov.businessStatus === 'none' ? 'available' : ov.businessStatus,
          level: ov.businessLevel,
          dailyRevenue: ov.businessDailyRevenue || preset.dailyRevenue,
        };
      } else if (ov.businessCategory === '' && ov.ownershipStatus === 'available') {
        business = null;
      }

      const merged: TownPlot = {
        ...base,
        facingAngle: ov.facingAngle ?? base.facingAngle,
        ownershipStatus: ov.ownershipStatus,
        ownerUid: ov.ownerUid || null,
        ownerUsername: ov.ownerUsername || null,
        verificationState: ov.verificationState,
        claimedAt: ov.claimedAt || null,
        upgradeLevel: ov.upgradeLevel,
        house,
        business,
      };
      this.plots.set(id, merged);
    }
  }

  private getSpatialKey(x: number, z: number): string {
    const gx = Math.floor(x / this.chunkSize);
    const gz = Math.floor(z / this.chunkSize);
    return `${gx},${gz}`;
  }

  public registerPlot(plot: TownPlot): void {
    this.plots.set(plot.id, plot);
    const key = this.getSpatialKey(plot.center.x, plot.center.z);
    const bucket = this.spatialIndex.get(key) ?? [];
    if (!bucket.includes(plot.id)) {
      bucket.push(plot.id);
      this.spatialIndex.set(key, bucket);
    }
  }

  public getAllPlots(): TownPlot[] {
    return Array.from(this.plots.values());
  }

  public getPlotById(id: string): TownPlot | undefined {
    return this.plots.get(id);
  }

  public getNearbyPlots(x: number, z: number, radius: number): TownPlot[] {
    const out: TownPlot[] = [];
    const rSq = radius * radius;
    const minGx = Math.floor((x - radius) / this.chunkSize);
    const maxGx = Math.floor((x + radius) / this.chunkSize);
    const minGz = Math.floor((z - radius) / this.chunkSize);
    const maxGz = Math.floor((z + radius) / this.chunkSize);

    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gz = minGz; gz <= maxGz; gz++) {
        const ids = this.spatialIndex.get(`${gx},${gz}`);
        if (!ids) continue;
        for (const id of ids) {
          const p = this.plots.get(id);
          if (!p) continue;
          const dx = p.center.x - x;
          const dz = p.center.z - z;
          if (dx * dx + dz * dz <= rSq) out.push(p);
        }
      }
    }
    return out;
  }

  public getTownStats(activeVehicleCount: number): TownFinancialStats {
    const all = this.getAllPlots();
    let totalHouses = 0;
    let occupiedPlots = 0;
    let availablePlots = 0;
    let businessCount = 0;
    let publicBuildingCount = 0;
    let dailyBusinessIncome = 0;
    let totalPopulation = 0;

    for (const p of all) {
      if (p.house) {
        totalHouses++;
        if (p.ownershipStatus === 'occupied') {
          totalPopulation += p.category === 'luxury-residential' ? 4 + p.upgradeLevel : 2 + p.upgradeLevel;
        }
      }
      if (p.business) {
        businessCount++;
        if (p.business.status === 'open') {
          dailyBusinessIncome += p.business.dailyRevenue;
        }
      }
      if (p.publicBuilding) {
        publicBuildingCount++;
      }
      if (p.ownershipStatus === 'occupied') occupiedPlots++;
      else if (p.ownershipStatus === 'available' || p.ownershipStatus === 'reserved') availablePlots++;
    }

    return {
      totalPopulation,
      totalHouses,
      occupiedPlots,
      availablePlots,
      businessCount,
      vehicleCount: activeVehicleCount,
      publicBuildingCount,
      townTreasury: this.treasuryBalance,
      dailyBusinessIncome,
    };
  }

  public isUsernameAssignedElsewhere(
    username: string,
    excludePlotId?: string,
  ): TownPlot | null {
    const clean = username.trim().toLowerCase();
    if (!clean) return null;
    for (const p of this.plots.values()) {
      if (excludePlotId && p.id === excludePlotId) continue;
      if (p.ownerUsername && p.ownerUsername.trim().toLowerCase() === clean) {
        return p;
      }
    }
    return null;
  }

  /**
   * Admin approves a community resident from Instagram DM and assigns an unoccupied residential plot.
   * Prevents duplicate assignments onto occupied plots or duplicate usernames across plots.
   */
  public approveResidentForPlot(
    plotId: string,
    inGameUsername: string,
    archetype?: HouseArchetype,
  ): { ok: boolean; plot?: TownPlot; error?: string } {
    const plot = this.plots.get(plotId);
    if (!plot) return { ok: false, error: 'Selected plot does not exist.' };
    if (plot.category === 'public' || plot.category === 'commercial') {
      return { ok: false, error: 'Only residential or expansion residential plots can be assigned.' };
    }
    if (plot.ownershipStatus === 'occupied' || Boolean(plot.ownerUsername)) {
      return {
        ok: false,
        error: `${plot.plotCode} is already assigned to ${plot.ownerUsername ?? 'a resident'}. Revoke or use Change Owner instead.`,
      };
    }

    const cleanName = inGameUsername.trim().slice(0, 32);
    if (!cleanName) return { ok: false, error: 'In-game username is required.' };

    const duplicate = this.isUsernameAssignedElsewhere(cleanName, plotId);
    if (duplicate) {
      return {
        ok: false,
        error: `"${cleanName}" already owns ${duplicate.plotCode}. Duplicate house assignments are blocked.`,
      };
    }

    const chosenArchetype =
      archetype ??
      plot.house?.archetype ??
      (plot.category === 'luxury-residential' ? 'luxury-modern' : 'cottage');

    const nextHouse = plot.house ?? { ...HOUSE_PRESETS[chosenArchetype] };
    const updated: TownPlot = {
      ...plot,
      ownershipStatus: 'occupied',
      ownerUid: null,
      ownerUsername: cleanName,
      verificationState: 'verified-community',
      claimedAt: new Date().toISOString().slice(0, 10),
      house: nextHouse,
    };
    this.plots.set(plotId, updated);
    return { ok: true, plot: updated };
  }

  /**
   * Admin reassigns ownership of an existing residential plot to a new approved resident.
   */
  public reassignResidentOnPlot(
    plotId: string,
    newInGameUsername: string,
    archetype?: HouseArchetype,
  ): { ok: boolean; previousUsername: string | null; plot?: TownPlot; error?: string } {
    const plot = this.plots.get(plotId);
    if (!plot) return { ok: false, previousUsername: null, error: 'Plot does not exist.' };
    if (plot.category === 'public' || plot.category === 'commercial') {
      return {
        ok: false,
        previousUsername: plot.ownerUsername,
        error: 'Only residential plots support resident ownership.',
      };
    }

    const cleanName = newInGameUsername.trim().slice(0, 32);
    if (!cleanName) {
      return { ok: false, previousUsername: plot.ownerUsername, error: 'In-game username is required.' };
    }

    const duplicate = this.isUsernameAssignedElsewhere(cleanName, plotId);
    if (duplicate) {
      return {
        ok: false,
        previousUsername: plot.ownerUsername,
        error: `"${cleanName}" already owns ${duplicate.plotCode}. Duplicate house assignments are blocked.`,
      };
    }

    const previousUsername = plot.ownerUsername;
    const chosenArchetype =
      archetype ??
      plot.house?.archetype ??
      (plot.category === 'luxury-residential' ? 'luxury-modern' : 'cottage');

    const updated: TownPlot = {
      ...plot,
      ownershipStatus: 'occupied',
      ownerUid: null,
      ownerUsername: cleanName,
      verificationState: 'verified-community',
      claimedAt: new Date().toISOString().slice(0, 10),
      house: plot.house ?? { ...HOUSE_PRESETS[chosenArchetype] },
    };
    this.plots.set(plotId, updated);
    return { ok: true, previousUsername, plot: updated };
  }

  /**
   * Admin revokes ownership of a residential plot, returning the house/plot to Available.
   */
  public revokeResidentOwnership(
    plotId: string,
  ): { ok: boolean; previousUsername: string | null; plot?: TownPlot; error?: string } {
    const plot = this.plots.get(plotId);
    if (!plot) return { ok: false, previousUsername: null, error: 'Plot does not exist.' };
    if (plot.publicBuilding) {
      return { ok: false, previousUsername: null, error: 'Civic buildings cannot be revoked.' };
    }

    const previousUsername = plot.ownerUsername;
    const updated: TownPlot = {
      ...plot,
      ownershipStatus: 'available',
      ownerUid: null,
      ownerUsername: null,
      verificationState: 'none',
      claimedAt: null,
    };
    this.plots.set(plotId, updated);
    return { ok: true, previousUsername, plot: updated };
  }

  public assignResidentPlot(
    plotId: string,
    ownerUsername: string,
    archetype?: HouseArchetype,
  ): TownPlot | null {
    const res = this.approveResidentForPlot(plotId, ownerUsername, archetype);
    return res.ok ? (res.plot ?? null) : null;
  }

  public upgradePlot(plotId: string): TownPlot | null {
    const plot = this.plots.get(plotId);
    if (!plot || plot.upgradeLevel >= 3) return null;
    const nextLevel = (plot.upgradeLevel + 1) as 1 | 2 | 3;

    let updated: TownPlot = { ...plot, upgradeLevel: nextLevel };
    if (plot.house) {
      updated = {
        ...updated,
        house: {
          ...plot.house,
          hasBalcony: true,
          hasGarageCarport: nextLevel >= 2 ? true : plot.house.hasGarageCarport,
          hasPool: plot.category === 'luxury-residential' ? true : plot.house.hasPool,
        },
      };
    }
    if (plot.business) {
      const revenueBoost = Math.round(plot.business.dailyRevenue * 1.35);
      updated = {
        ...updated,
        business: {
          ...plot.business,
          level: nextLevel,
          dailyRevenue: revenueBoost,
          status: 'open',
        },
      };
    }

    this.plots.set(plotId, updated);
    return updated;
  }

  public claimOrOpenBusiness(plotId: string, ownerUsername: string): TownPlot | null {
    const plot = this.plots.get(plotId);
    if (!plot || !plot.business) return null;
    const clean = ownerUsername.trim().slice(0, 24 > 0 ? 32 : 32);
    if (!clean) return null;

    const updated: TownPlot = {
      ...plot,
      ownershipStatus: 'occupied',
      ownerUsername: clean,
      verificationState: 'pending-oauth',
      claimedAt: new Date().toISOString().slice(0, 10),
      business: {
        ...plot.business,
        ownerUsername: clean,
        status: 'open',
      },
    };
    this.plots.set(plotId, updated);
    return updated;
  }

  public collectDailyBusinessRevenue(): number {
    const stats = this.getTownStats(0);
    this.treasuryBalance += stats.dailyBusinessIncome;
    return this.treasuryBalance;
  }

  /**
   * Editor: Place a new house or business on an empty available/reserved plot.
   * Prevents placing on occupied plots, public parcels, or outside plot boundaries.
   */
  public placeBuildingOnEmptyPlot(
    plotId: string,
    opts: {
      buildingType: 'house' | 'business';
      houseArchetype?: HouseArchetype;
      businessCategory?: BusinessCategory;
      rotationQuarterTurns?: 0 | 1 | 2 | 3;
      ownerUsername?: string;
    },
  ): { ok: boolean; plot?: TownPlot; error?: string } {
    const plot = this.plots.get(plotId);
    if (!plot) return { ok: false, error: 'Plot does not exist.' };
    if (plot.house || plot.business || plot.publicBuilding) {
      return { ok: false, error: 'Plot is already occupied. Choose an empty plot.' };
    }
    if (plot.category === 'public') {
      return { ok: false, error: 'Civic parcel cannot be overwritten.' };
    }

    const baseTurns = opts.rotationQuarterTurns ?? 0;
    const newFacing = plot.facingAngle + (baseTurns * Math.PI) / 2;

    if (opts.buildingType === 'house') {
      const arch = opts.houseArchetype ?? 'cottage';
      const spec = { ...HOUSE_PRESETS[arch] };
      if (spec.width > plot.width - 1.5 || spec.depth > plot.depth - 1.5) {
        return { ok: false, error: 'Building footprint exceeds plot boundaries.' };
      }
      const updated: TownPlot = {
        ...plot,
        facingAngle: newFacing,
        ownershipStatus: opts.ownerUsername ? 'occupied' : 'available',
        ownerUid: null,
        ownerUsername: opts.ownerUsername ?? null,
        verificationState: opts.ownerUsername ? 'pending-oauth' : 'none',
        claimedAt: opts.ownerUsername ? new Date().toISOString().slice(0, 10) : null,
        house: spec,
      };
      this.plots.set(plotId, updated);
      return { ok: true, plot: updated };
    }

    const cat = opts.businessCategory ?? 'cafe';
    const biz = createBusinessPreset(cat, plot.id, opts.ownerUsername ?? 'Town Enterprise');
    const updated: TownPlot = {
      ...plot,
      facingAngle: newFacing,
      ownershipStatus: 'occupied',
      ownerUid: null,
      ownerUsername: biz.ownerUsername,
      verificationState: 'pending-oauth',
      claimedAt: new Date().toISOString().slice(0, 10),
      business: biz,
    };
    this.plots.set(plotId, updated);
    return { ok: true, plot: updated };
  }

  /**
   * Editor: Move an eligible house or business from an occupied plot onto an empty plot.
   */
  public moveBuildingBetweenPlots(
    sourcePlotId: string,
    targetPlotId: string,
  ): { ok: boolean; dstPlot?: TownPlot; srcPlot?: TownPlot; error?: string } {
    if (sourcePlotId === targetPlotId) return { ok: false, error: 'Select a different target plot.' };
    const src = this.plots.get(sourcePlotId);
    const dst = this.plots.get(targetPlotId);
    if (!src || !dst) return { ok: false, error: 'Invalid source or destination plot.' };
    if (src.publicBuilding || (!src.house && !src.business)) {
      return { ok: false, error: 'Source plot has no movable building.' };
    }
    if (dst.house || dst.business || dst.publicBuilding || dst.category === 'public') {
      return { ok: false, error: 'Destination plot is occupied or civic-protected.' };
    }

    const updatedDst: TownPlot = {
      ...dst,
      house: src.house,
      business: src.business,
      ownershipStatus: src.ownershipStatus,
      ownerUid: src.ownerUid ?? null,
      ownerUsername: src.ownerUsername,
      verificationState: src.verificationState,
      claimedAt: src.claimedAt,
      upgradeLevel: src.upgradeLevel,
    };
    const clearedSrc: TownPlot = {
      ...src,
      house: null,
      business: null,
      ownershipStatus: 'available',
      ownerUid: null,
      ownerUsername: null,
      verificationState: 'none',
      claimedAt: null,
      upgradeLevel: 1,
    };

    this.plots.set(targetPlotId, updatedDst);
    this.plots.set(sourcePlotId, clearedSrc);
    return { ok: true, dstPlot: updatedDst, srcPlot: clearedSrc };
  }

  /**
   * Restores a single plot snapshot (used to roll back optimistic UI state on Firestore failure).
   */
  public restorePlot(snapshot: TownPlot): void {
    this.plots.set(snapshot.id, snapshot);
  }

  /**
   * Editor: Demolish a non-civic house or business on a plot, returning it to an empty available plot.
   */
  public removeBuildingFromPlot(
    plotId: string,
  ): { ok: boolean; previousUsername: string | null; plot?: TownPlot; error?: string } {
    const plot = this.plots.get(plotId);
    if (!plot) return { ok: false, previousUsername: null, error: 'Plot does not exist.' };
    if (plot.publicBuilding || plot.category === 'public') {
      return { ok: false, previousUsername: null, error: 'Civic buildings cannot be demolished.' };
    }
    if (!plot.house && !plot.business) {
      return { ok: false, previousUsername: null, error: 'Plot has no building to demolish.' };
    }

    const previousUsername = plot.ownerUsername;
    const cleared: TownPlot = {
      ...plot,
      house: null,
      business: null,
      ownershipStatus: 'available',
      ownerUid: null,
      ownerUsername: null,
      verificationState: 'none',
      claimedAt: null,
      upgradeLevel: 1,
    };
    this.plots.set(plotId, cleared);
    return { ok: true, previousUsername, plot: cleared };
  }
}
