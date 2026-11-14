import { TownPlot } from '../types';

/**
 * Clean integration boundaries for future backend services.
 * Local browser preview uses LocalSimulationAdapters; production deployment
 * swaps these with WebSocket/Firestore/OAuth implementations.
 */

export interface ConnectedResidentPresence {
  userId: string;
  displayName: string;
  districtId: string;
  cameraFocus: { x: number; z: number };
  lastSeenIso: string;
  isLocalSession: boolean;
}

export interface IVerificationProvider {
  readonly isConnected: boolean;
  readonly providerName: string;
  requestInstagramVerification(handle: string): Promise<{
    verified: boolean;
    status: 'pending-oauth' | 'unavailable-no-backend';
    reason: string;
  }>;
}

export interface IMultiplayerProvider {
  readonly isConnected: boolean;
  readonly transportLabel: string;
  getSessionUserId(): string;
  setActiveUserId(uid: string | null): void;
  syncBenchLocks(locks: Record<string, string>): void;
  getConnectedResidents(): ConnectedResidentPresence[];
  broadcastPlotUpdate(plot: TownPlot): void;
  getBenchOccupant(benchId: string): string | null;
  occupyBench(benchId: string, userId?: string): boolean;
  releaseBench(benchId: string, userId?: string): void;
}

export interface ICloudTownRepository {
  readonly isConnected: boolean;
  readonly storageLabel: string;
  loadTownPlots(): Promise<TownPlot[] | null>;
  saveTownPlot(plot: TownPlot): Promise<void>;
}

/**
 * Local stub explaining explicitly why Instagram verification requires an OAuth backend.
 * Never treats a manually typed handle as proof of verification.
 */
export class LocalVerificationStub implements IVerificationProvider {
  public readonly isConnected = false;
  public readonly providerName = 'Manual Admin Review via Instagram DM';

  public async requestInstagramVerification(handle: string) {
    return {
      verified: false,
      status: 'unavailable-no-backend' as const,
      reason: `Handle "${handle}" is reviewed manually by a Town Admin after Instagram DM.`,
    };
  }
}

/**
 * Login-free local session presence & bench-sitting coordinator.
 */
export class LocalMultiplayerStub implements IMultiplayerProvider {
  public readonly isConnected = false;
  public readonly transportLabel = 'Session Local Simulation (Login-Free)';
  private sessionId: string;
  private readonly benchOccupants: Map<string, string> = new Map();

  constructor() {
    this.sessionId = `visitor-${Math.random().toString(36).slice(2, 8)}`;
  }

  public getSessionUserId(): string {
    return this.sessionId;
  }

  public setActiveUserId(uid: string | null): void {
    this.sessionId = uid ?? `visitor-${Math.random().toString(36).slice(2, 8)}`;
  }

  public syncBenchLocks(locks: Record<string, string>): void {
    this.benchOccupants.clear();
    for (const [benchId, occupantUid] of Object.entries(locks)) {
      this.benchOccupants.set(benchId, occupantUid);
    }
  }

  public getConnectedResidents(): ConnectedResidentPresence[] {
    return [
      {
        userId: this.sessionId,
        displayName: 'Current Session',
        districtId: 'central-square',
        cameraFocus: { x: 0, z: 0 },
        lastSeenIso: new Date().toISOString(),
        isLocalSession: true,
      },
    ];
  }

  public broadcastPlotUpdate(_plot: TownPlot): void {
    // Synced through Firestore town_plots collection
  }

  public getBenchOccupant(benchId: string): string | null {
    return this.benchOccupants.get(benchId) ?? null;
  }

  public occupyBench(benchId: string, userId = this.sessionId): boolean {
    const existing = this.benchOccupants.get(benchId);
    if (existing && existing !== userId) return false;
    this.benchOccupants.set(benchId, userId);
    return true;
  }

  public releaseBench(benchId: string, userId = this.sessionId): void {
    if (this.benchOccupants.get(benchId) === userId) {
      this.benchOccupants.delete(benchId);
    }
  }
}

export const townVerificationService: IVerificationProvider = new LocalVerificationStub();
export const townMultiplayerService: IMultiplayerProvider = new LocalMultiplayerStub();
