import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';
import {
  PlotCustomization,
  PlotGuestbookEntry,
  PlotUpgradeId,
  PrivateResidentRecord,
  ResidentWallet,
  TownPlot,
  TownPublicSettings,
  UserRole,
} from '../types';
import {
  CompactShardEntry,
  ExpansionManifest,
  ParsedFollowerDataset,
} from '../expansion/types';
import {
  hydrateDatasetFromCompactEntries,
  serializeDatasetToShards,
} from '../expansion/zipFollowerParser';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const DEFAULT_TOWN_SETTINGS: TownPublicSettings = {
  welcomeTitle: 'Welcome to Lindenhof',
  welcomeSubtitle:
    'Explore our living European community town in 3D — walk the streets, visit parks, and inspect available homes with no login required.',
  instagramUrl: 'https://www.instagram.com/',
  instagramInstruction:
    'Follow our official Instagram page and send a DM with your requested in-game username. An admin will review your message and assign your house.',
};

export function sanitizeInstagramUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().slice(0, 200);
  if (/^https:\/\/[^\s]+$/i.test(trimmed)) {
    return trimmed;
  }
  return DEFAULT_TOWN_SETTINGS.instagramUrl;
}

export function normalizeUsernameKey(username: string): string {
  const clean = username.trim().toLowerCase();
  const hex = Array.from(clean)
    .map((ch) => (/[a-z0-9]/.test(ch) ? ch : ch.charCodeAt(0).toString(16)))
    .join('')
    .slice(0, 110);
  return `u_${hex || 'empty'}`;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface TownPlotOverridePayload {
  plotId: string;
  facingAngle: number;
  ownershipStatus: 'occupied' | 'available' | 'reserved' | 'civic';
  ownerUid: string;
  ownerUsername: string;
  verificationState: 'unverified-local' | 'pending-oauth' | 'verified-community' | 'none';
  claimedAt: string;
  upgradeLevel: 1 | 2 | 3;
  houseArchetype: string;
  hasGarageCarport: boolean;
  hasPool: boolean;
  hasBalcony: boolean;
  businessCategory: string;
  businessName: string;
  businessOwnerUsername: string;
  businessStatus: 'open' | 'upgrading' | 'available' | 'none';
  businessLevel: 1 | 2 | 3;
  businessDailyRevenue: number;
}

function serializePlotDoc(plot: TownPlot, actorUid: string) {
  return {
    plotId: plot.id.slice(0, 64),
    facingAngle: plot.facingAngle,
    ownershipStatus: plot.ownershipStatus,
    ownerUid: (plot.ownerUid ?? '').slice(0, 128),
    ownerUsername: (plot.ownerUsername ?? '').slice(0, 32),
    verificationState: plot.verificationState,
    claimedAt: (plot.claimedAt ?? '').slice(0, 20),
    upgradeLevel: plot.upgradeLevel,
    houseArchetype: (plot.house?.archetype ?? '').slice(0, 24),
    hasGarageCarport: Boolean(plot.house?.hasGarageCarport),
    hasPool: Boolean(plot.house?.hasPool),
    hasBalcony: Boolean(plot.house?.hasBalcony),
    businessCategory: (plot.business?.category ?? '').slice(0, 24),
    businessName: (plot.business?.name ?? '').slice(0, 48),
    businessOwnerUsername: (plot.business?.ownerUsername ?? '').slice(0, 32),
    businessStatus: plot.business ? plot.business.status : 'none',
    businessLevel: plot.business ? plot.business.level : 1,
    businessDailyRevenue: plot.business ? Math.round(plot.business.dailyRevenue) : 0,
    updatedByUid: actorUid.slice(0, 128),
    updatedAt: serverTimestamp(),
  };
}

// -----------------------------------------------------------------------------
// Admin-Only Authentication & Backend-Verified Role Resolution
// -----------------------------------------------------------------------------

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuthState(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

/**
 * Authoritative role check executed against Firestore Rules (`/admin_gate/verify`).
 * Zero admin emails, credentials, or secrets exist in client JS.
 */
export async function resolveBackendUserRole(user: User | null): Promise<UserRole> {
  if (!user) return 'visitor';
  try {
    await getDocFromServer(doc(db, 'admin_gate', 'verify'));
    return 'super-admin';
  } catch {
    return 'visitor';
  }
}

// -----------------------------------------------------------------------------
// Public Read-Only Town Subscriptions (Safe for Login-Free Visitors)
// -----------------------------------------------------------------------------

export function subscribeTownPlots(
  onUpdate: (overrides: Record<string, TownPlotOverridePayload>) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = 'town_plots';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const map: Record<string, TownPlotOverridePayload> = {};
      snap.forEach((d) => {
        const data = d.data() as Partial<TownPlotOverridePayload>;
        if (typeof data.plotId === 'string') {
          map[data.plotId] = {
            plotId: data.plotId,
            facingAngle: typeof data.facingAngle === 'number' ? data.facingAngle : 0,
            ownershipStatus: data.ownershipStatus ?? 'available',
            ownerUid: data.ownerUid ?? '',
            ownerUsername: data.ownerUsername ?? '',
            verificationState: data.verificationState ?? 'none',
            claimedAt: data.claimedAt ?? '',
            upgradeLevel:
              data.upgradeLevel === 2 || data.upgradeLevel === 3 ? data.upgradeLevel : 1,
            houseArchetype: data.houseArchetype ?? '',
            hasGarageCarport: Boolean(data.hasGarageCarport),
            hasPool: Boolean(data.hasPool),
            hasBalcony: Boolean(data.hasBalcony),
            businessCategory: data.businessCategory ?? '',
            businessName: data.businessName ?? '',
            businessOwnerUsername: data.businessOwnerUsername ?? '',
            businessStatus: data.businessStatus ?? 'none',
            businessLevel:
              data.businessLevel === 2 || data.businessLevel === 3 ? data.businessLevel : 1,
            businessDailyRevenue:
              typeof data.businessDailyRevenue === 'number' ? data.businessDailyRevenue : 0,
          };
        }
      });
      onUpdate(map);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    },
  );
}

export function subscribeTownEconomy(
  onBalance: (balance: number) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = 'town_meta/economy';
  return onSnapshot(
    doc(db, 'town_meta', 'economy'),
    (snap) => {
      if (snap.exists()) {
        const val = snap.data().treasuryBalance;
        if (typeof val === 'number') onBalance(val);
      }
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.GET, path);
    },
  );
}

export function subscribeTownSettings(
  onSettings: (settings: TownPublicSettings) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = 'town_meta/settings';
  return onSnapshot(
    doc(db, 'town_meta', 'settings'),
    (snap) => {
      if (!snap.exists()) {
        onSettings(DEFAULT_TOWN_SETTINGS);
        return;
      }
      const d = snap.data();
      onSettings({
        welcomeTitle:
          typeof d.welcomeTitle === 'string' && d.welcomeTitle.trim()
            ? d.welcomeTitle.slice(0, 80)
            : DEFAULT_TOWN_SETTINGS.welcomeTitle,
        welcomeSubtitle:
          typeof d.welcomeSubtitle === 'string' && d.welcomeSubtitle.trim()
            ? d.welcomeSubtitle.slice(0, 260)
            : DEFAULT_TOWN_SETTINGS.welcomeSubtitle,
        instagramUrl:
          typeof d.instagramUrl === 'string'
            ? sanitizeInstagramUrl(d.instagramUrl)
            : DEFAULT_TOWN_SETTINGS.instagramUrl,
        instagramInstruction:
          typeof d.instagramInstruction === 'string' && d.instagramInstruction.trim()
            ? d.instagramInstruction.slice(0, 280)
            : DEFAULT_TOWN_SETTINGS.instagramInstruction,
      });
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.GET, path);
    },
  );
}

// -----------------------------------------------------------------------------
// Super Admin Only Operations (Firestore Rules Reject All Non-Admin Requests)
// -----------------------------------------------------------------------------

export function subscribeAdminResidentRecords(
  onRecords: (records: Record<string, PrivateResidentRecord>) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = 'resident_records';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const map: Record<string, PrivateResidentRecord> = {};
      snap.forEach((d) => {
        const data = d.data();
        if (typeof data.plotId === 'string') {
          map[data.plotId] = {
            plotId: data.plotId,
            inGameUsername: typeof data.inGameUsername === 'string' ? data.inGameUsername : '',
            instagramHandle: typeof data.instagramHandle === 'string' ? data.instagramHandle : '',
            notes: typeof data.notes === 'string' ? data.notes : '',
          };
        }
      });
      onRecords(map);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    },
  );
}

export async function adminAssignResidentInFirestore(params: {
  plot: TownPlot;
  previousUsername: string | null;
  inGameUsername: string;
  instagramHandle: string;
  notes: string;
  adminUid: string;
}): Promise<void> {
  const { plot, previousUsername, inGameUsername, instagramHandle, notes, adminUid } = params;
  const cleanUser = inGameUsername.trim().slice(0, 32);
  const cleanIg = instagramHandle.trim().replace(/^@+/, '@').slice(0, 40);
  const newKey = normalizeUsernameKey(cleanUser);
  const lockRef = doc(db, 'resident_usernames', newKey);
  const recordRef = doc(db, 'resident_records', plot.id);
  const plotPath = `town_plots/${plot.id}`;

  try {
    const [existingLock, existingRecord] = await Promise.all([
      getDoc(lockRef),
      getDoc(recordRef),
    ]);

    if (existingLock.exists() && existingLock.data().plotId !== plot.id) {
      throw new Error(
        `Username "${cleanUser}" is already locked to plot ${String(existingLock.data().plotId)}.`,
      );
    }

    const batch = writeBatch(db);
    if (previousUsername && normalizeUsernameKey(previousUsername) !== newKey) {
      batch.delete(doc(db, 'resident_usernames', normalizeUsernameKey(previousUsername)));
    }

    batch.set(doc(db, 'town_plots', plot.id), serializePlotDoc(plot, adminUid));

    const approvedAtValue = existingRecord.exists()
      ? existingRecord.data().approvedAt
      : serverTimestamp();

    batch.set(recordRef, {
      plotId: plot.id.slice(0, 64),
      inGameUsername: cleanUser,
      instagramHandle: cleanIg || '@instagram_user',
      notes: notes.trim().slice(0, 200),
      approvedByUid: adminUid.slice(0, 128),
      approvedAt: approvedAtValue,
      updatedAt: serverTimestamp(),
    });

    batch.set(lockRef, {
      usernameKey: newKey,
      plotId: plot.id.slice(0, 64),
      updatedByUid: adminUid.slice(0, 128),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, plotPath);
  }
}

export async function adminRevokeResidentInFirestore(params: {
  plot: TownPlot;
  previousUsername: string | null;
  adminUid: string;
}): Promise<void> {
  const { plot, previousUsername, adminUid } = params;
  const path = `town_plots/${plot.id}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'town_plots', plot.id), serializePlotDoc(plot, adminUid));
    batch.delete(doc(db, 'resident_records', plot.id));
    if (previousUsername) {
      batch.delete(doc(db, 'resident_usernames', normalizeUsernameKey(previousUsername)));
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function adminSavePlotToFirestore(plot: TownPlot, adminUid: string): Promise<void> {
  const path = `town_plots/${plot.id}`;
  try {
    await setDoc(doc(db, 'town_plots', plot.id), serializePlotDoc(plot, adminUid));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function adminMovePlotsInFirestore(
  dstPlot: TownPlot,
  srcPlot: TownPlot,
  adminUid: string,
): Promise<void> {
  const path = `town_plots/${dstPlot.id}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'town_plots', dstPlot.id), serializePlotDoc(dstPlot, adminUid));
    batch.set(doc(db, 'town_plots', srcPlot.id), serializePlotDoc(srcPlot, adminUid));
    if (dstPlot.ownerUsername) {
      const key = normalizeUsernameKey(dstPlot.ownerUsername);
      batch.set(doc(db, 'resident_usernames', key), {
        usernameKey: key,
        plotId: dstPlot.id.slice(0, 64),
        updatedByUid: adminUid.slice(0, 128),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function adminSaveTreasuryToFirestore(
  treasuryBalance: number,
  adminUid: string,
): Promise<void> {
  const path = 'town_meta/economy';
  try {
    await setDoc(doc(db, 'town_meta', 'economy'), {
      treasuryBalance: Math.max(0, Math.round(treasuryBalance)),
      lastCollectedByUid: adminUid.slice(0, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function adminSaveTownSettingsToFirestore(
  settings: TownPublicSettings,
  adminUid: string,
): Promise<void> {
  const path = 'town_meta/settings';
  try {
    await setDoc(doc(db, 'town_meta', 'settings'), {
      welcomeTitle:
        settings.welcomeTitle.trim().slice(0, 80) || DEFAULT_TOWN_SETTINGS.welcomeTitle,
      welcomeSubtitle:
        settings.welcomeSubtitle.trim().slice(0, 260) || DEFAULT_TOWN_SETTINGS.welcomeSubtitle,
      instagramUrl: sanitizeInstagramUrl(settings.instagramUrl),
      instagramInstruction:
        settings.instagramInstruction.trim().slice(0, 280) ||
        DEFAULT_TOWN_SETTINGS.instagramInstruction,
      updatedByUid: adminUid.slice(0, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function adminDemolishPlotInFirestore(params: {
  plot: TownPlot;
  previousUsername: string | null;
  adminUid: string;
}): Promise<void> {
  const { plot, previousUsername, adminUid } = params;
  const path = `town_plots/${plot.id}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'town_plots', plot.id), serializePlotDoc(plot, adminUid));
    batch.delete(doc(db, 'resident_records', plot.id));
    if (previousUsername) {
      batch.delete(doc(db, 'resident_usernames', normalizeUsernameKey(previousUsername)));
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export interface AdminRosterEntry {
  uid: string;
  grantedAt: string | null;
}

export function subscribeAdmins(
  onAdmins: (entries: AdminRosterEntry[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = 'admins';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const list: AdminRosterEntry[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const uid = typeof data.uid === 'string' ? data.uid : d.id;
        let grantedAt: string | null = null;
        if (data.grantedAt && typeof data.grantedAt.toDate === 'function') {
          grantedAt = (data.grantedAt.toDate() as Date).toISOString().slice(0, 10);
        }
        list.push({ uid, grantedAt });
      });
      list.sort((a, b) => a.uid.localeCompare(b.uid));
      onAdmins(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    },
  );
}

export async function adminGrantAdminInFirestore(targetUid: string): Promise<void> {
  const cleanUid = targetUid.trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanUid)) {
    throw new Error('Invalid Firebase UID (allowed: letters, digits, _ and -, max 128 chars).');
  }
  const path = `admins/${cleanUid}`;
  try {
    await setDoc(doc(db, 'admins', cleanUid), {
      uid: cleanUid,
      grantedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function adminRevokeAdminInFirestore(targetUid: string): Promise<void> {
  const cleanUid = targetUid.trim();
  const path = `admins/${cleanUid}`;
  try {
    await deleteDoc(doc(db, 'admins', cleanUid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function adminSeedTownDefaultsInFirestore(params: {
  plots: TownPlot[];
  treasuryBalance: number;
  settings: TownPublicSettings;
  adminUid: string;
}): Promise<void> {
  const { plots, treasuryBalance, settings, adminUid } = params;
  const path = 'town_plots';
  try {
    const batch = writeBatch(db);
    for (const plot of plots) {
      batch.set(doc(db, 'town_plots', plot.id), serializePlotDoc(plot, adminUid));
    }
    batch.set(doc(db, 'town_meta', 'economy'), {
      treasuryBalance: Math.max(0, Math.round(treasuryBalance)),
      lastCollectedByUid: adminUid.slice(0, 128),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'town_meta', 'settings'), {
      welcomeTitle:
        settings.welcomeTitle.trim().slice(0, 80) || DEFAULT_TOWN_SETTINGS.welcomeTitle,
      welcomeSubtitle:
        settings.welcomeSubtitle.trim().slice(0, 260) || DEFAULT_TOWN_SETTINGS.welcomeSubtitle,
      instagramUrl: sanitizeInstagramUrl(settings.instagramUrl),
      instagramInstruction:
        settings.instagramInstruction.trim().slice(0, 280) ||
        DEFAULT_TOWN_SETTINGS.instagramInstruction,
      updatedByUid: adminUid.slice(0, 128),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// -----------------------------------------------------------------------------
// Sharded Follower Directory Persistence (3,447+ Residents) + Server Readback Verification
// -----------------------------------------------------------------------------

export function subscribeExpansionManifest(
  onManifest: (manifest: ExpansionManifest | null) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = 'town_meta/expansion_manifest';
  return onSnapshot(
    doc(db, 'town_meta', 'expansion_manifest'),
    (snap) => {
      if (!snap.exists()) {
        onManifest(null);
        return;
      }
      const d = snap.data();
      let importedAt = '';
      if (d.updatedAt && typeof d.updatedAt.toDate === 'function') {
        importedAt = (d.updatedAt.toDate() as Date).toISOString();
      }
      onManifest({
        sourceArchiveName: String(d.sourceArchiveName ?? 'instagram-followers'),
        totalRawFollowers: Number(d.totalRawFollowers ?? 0),
        uniqueFollowers: Number(d.uniqueFollowers ?? 0),
        duplicatesRemoved: Number(d.duplicatesRemoved ?? 0),
        ogCount: Number(d.ogCount ?? 0),
        remainingResidents: Number(d.remainingResidents ?? 0),
        expansionOpenPlots: Number(d.expansionOpenPlots ?? 0),
        vipUsername: String(d.vipUsername ?? ''),
        vipPlotCode: String(d.vipPlotCode ?? 'OG-01'),
        shardCount: Number(d.shardCount ?? 0),
        verifiedInFirestore: true,
        importedAt,
      });
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.GET, path);
    },
  );
}

export async function loadExpansionDirectoryShardsFromServer(
  manifest: ExpansionManifest,
): Promise<ParsedFollowerDataset> {
  const snap = await getDocsFromServer(collection(db, 'resident_directory_shards'));
  const shardDocs: Array<{ index: number; entries: CompactShardEntry[] }> = [];

  snap.forEach((d) => {
    const data = d.data();
    const index = typeof data.shardIndex === 'number' ? data.shardIndex : 0;
    const entries = Array.isArray(data.entries) ? (data.entries as CompactShardEntry[]) : [];
    shardDocs.push({ index, entries });
  });

  shardDocs.sort((a, b) => a.index - b.index);
  const flatEntries = shardDocs.flatMap((s) => s.entries);

  return hydrateDatasetFromCompactEntries(flatEntries, {
    sourceName: manifest.sourceArchiveName,
    totalRawFollowers: manifest.totalRawFollowers,
    duplicatesRemoved: manifest.duplicatesRemoved,
  });
}

export async function verifyExpansionPersistenceInFirestore(): Promise<{
  exists: boolean;
  manifest: ExpansionManifest | null;
  verifiedShardCount: number;
  verifiedResidentCount: number;
}> {
  const manifestSnap = await getDocFromServer(doc(db, 'town_meta', 'expansion_manifest'));
  if (!manifestSnap.exists()) {
    return {
      exists: false,
      manifest: null,
      verifiedShardCount: 0,
      verifiedResidentCount: 0,
    };
  }

  const d = manifestSnap.data();
  const shardSnap = await getDocsFromServer(collection(db, 'resident_directory_shards'));
  let verifiedResidentCount = 0;
  shardSnap.forEach((docSnap) => {
    const entries = docSnap.data().entries;
    if (Array.isArray(entries)) verifiedResidentCount += entries.length;
  });

  let importedAt = '';
  if (d.updatedAt && typeof d.updatedAt.toDate === 'function') {
    importedAt = (d.updatedAt.toDate() as Date).toISOString();
  }

  return {
    exists: true,
    manifest: {
      sourceArchiveName: String(d.sourceArchiveName ?? 'instagram-followers'),
      totalRawFollowers: Number(d.totalRawFollowers ?? 0),
      uniqueFollowers: Number(d.uniqueFollowers ?? 0),
      duplicatesRemoved: Number(d.duplicatesRemoved ?? 0),
      ogCount: Number(d.ogCount ?? 0),
      remainingResidents: Number(d.remainingResidents ?? 0),
      expansionOpenPlots: Number(d.expansionOpenPlots ?? 0),
      vipUsername: String(d.vipUsername ?? ''),
      vipPlotCode: String(d.vipPlotCode ?? 'OG-01'),
      shardCount: Number(d.shardCount ?? 0),
      verifiedInFirestore: verifiedResidentCount === Number(d.uniqueFollowers ?? 0),
      importedAt,
    },
    verifiedShardCount: shardSnap.size,
    verifiedResidentCount,
  };
}

export async function adminImportExpansionToFirestore(params: {
  dataset: ParsedFollowerDataset;
  expansionOpenPlots: number;
  adminUid: string;
  onProgress?: (label: string) => void;
}): Promise<{
  verifiedShardCount: number;
  verifiedResidentCount: number;
}> {
  const { dataset, expansionOpenPlots, adminUid, onProgress } = params;
  const shards = serializeDatasetToShards(dataset, 200);
  const totalShards = shards.length;
  const path = 'resident_directory_shards';

  try {
    // Write shards in conservative batches (5 shards per commit for payload safety)
    for (let start = 0; start < totalShards; start += 5) {
      const batch = writeBatch(db);
      const end = Math.min(totalShards, start + 5);
      for (let i = start; i < end; i++) {
        const shardId = `shard-${String(i).padStart(4, '0')}`;
        batch.set(doc(db, 'resident_directory_shards', shardId), {
          shardId,
          shardIndex: i,
          totalShards,
          entries: shards[i],
          updatedByUid: adminUid.slice(0, 128),
          updatedAt: serverTimestamp(),
        });
      }
      onProgress?.(`Uploading directory shards ${start + 1}–${end} of ${totalShards}...`);
      await batch.commit();
    }

    // Delete any stale trailing shards from larger previous imports
    const existingShards = await getDocsFromServer(collection(db, 'resident_directory_shards'));
    const validIds = new Set(shards.map((_, idx) => `shard-${String(idx).padStart(4, '0')}`));
    const staleDocs = existingShards.docs.filter((d) => !validIds.has(d.id));
    if (staleDocs.length > 0) {
      const delBatch = writeBatch(db);
      staleDocs.forEach((d) => delBatch.delete(d.ref));
      await delBatch.commit();
    }

    onProgress?.('Writing verified expansion manifest...');
    await setDoc(doc(db, 'town_meta', 'expansion_manifest'), {
      sourceArchiveName: dataset.sourceName.slice(0, 160),
      totalRawFollowers: dataset.totalRawFollowers,
      uniqueFollowers: dataset.uniqueFollowers,
      duplicatesRemoved: dataset.duplicatesRemoved,
      ogCount: dataset.ogMembers.length,
      remainingResidents: dataset.remainingResidents.length,
      expansionOpenPlots,
      vipUsername: (dataset.vipRecord?.username ?? 'sweet_thedevil').slice(0, 32),
      vipPlotCode: (dataset.vipRecord?.plotCode ?? 'OG-01').slice(0, 24),
      shardCount: totalShards,
      updatedByUid: adminUid.slice(0, 128),
      updatedAt: serverTimestamp(),
    });

    onProgress?.('Running Firestore server readback verification...');
    const verification = await verifyExpansionPersistenceInFirestore();
    if (
      !verification.exists ||
      verification.verifiedResidentCount !== dataset.uniqueFollowers ||
      verification.verifiedShardCount !== totalShards
    ) {
      throw new Error(
        `Server verification mismatch: expected ${dataset.uniqueFollowers} residents across ${totalShards} shards, read back ${verification.verifiedResidentCount} across ${verification.verifiedShardCount}.`,
      );
    }

    return {
      verifiedShardCount: verification.verifiedShardCount,
      verifiedResidentCount: verification.verifiedResidentCount,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// -----------------------------------------------------------------------------
// Resident Daily Check-In, Town Currency Wallet, Plot Upgrades & Guestbook
// -----------------------------------------------------------------------------

export function getUtcDayString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getPreviousUtcDayString(dayStr: string): string {
  const dt = new Date(`${dayStr}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function computeDailyCheckInReward(nextStreak: number): number {
  return 100 + Math.min(Math.max(0, nextStreak - 1), 6) * 25;
}

export const PLOT_UPGRADE_CATALOG: ReadonlyArray<{
  id: PlotUpgradeId;
  name: string;
  description: string;
  cost: number;
}> = [
  {
    id: 'driveway-lights',
    name: 'Warm Driveway Post Lamps',
    description: 'Twin warm-amber garden post lanterns flanking your plot walkway at dusk & night.',
    cost: 100,
  },
  {
    id: 'flower-planters',
    name: 'Manicured Flower Planters',
    description: 'Vibrant blooming front-porch planters and decorative garden borders.',
    cost: 150,
  },
  {
    id: 'garden-fountain',
    name: 'Courtyard Stone Birdbath Fountain',
    description: 'Tiered European stone fountain ornament installed in your front garden.',
    cost: 250,
  },
  {
    id: 'festive-garland',
    name: 'Evening Warm String Garland',
    description: 'Golden canopy eaves lights welcoming visitors along your porch roofline.',
    cost: 300,
  },
];

export function subscribeResidentWallet(
  uid: string,
  onWallet: (wallet: ResidentWallet | null) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = `resident_wallets/${uid}`;
  return onSnapshot(
    doc(db, 'resident_wallets', uid),
    (snap) => {
      if (!snap.exists()) {
        onWallet(null);
        return;
      }
      const d = snap.data();
      onWallet({
        uid: String(d.uid ?? uid),
        balance: Number(d.balance ?? 0),
        streakDays: Number(d.streakDays ?? 0),
        lastCheckInDay: String(d.lastCheckInDay ?? ''),
        totalCheckIns: Number(d.totalCheckIns ?? 0),
        linkedPlotId: String(d.linkedPlotId ?? ''),
        linkedPlotCode: String(d.linkedPlotCode ?? ''),
        linkedUsername: String(d.linkedUsername ?? ''),
      });
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.GET, path);
    },
  );
}

export async function linkPlotToResidentWallet(params: {
  uid: string;
  plotId: string;
  plotCode: string;
  username: string;
  currentWallet: ResidentWallet | null;
}): Promise<ResidentWallet> {
  const { uid, plotId, plotCode, username, currentWallet } = params;
  const path = `resident_wallets/${uid}`;
  const cleanPlotId = plotId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const cleanPlotCode = plotCode.trim().slice(0, 24);
  const cleanUsername = username.trim().slice(0, 32);

  const nextWallet: ResidentWallet = {
    uid,
    balance: currentWallet?.balance ?? 0,
    streakDays: currentWallet?.streakDays ?? 0,
    lastCheckInDay: currentWallet?.lastCheckInDay ?? '',
    totalCheckIns: currentWallet?.totalCheckIns ?? 0,
    linkedPlotId: cleanPlotId,
    linkedPlotCode: cleanPlotCode,
    linkedUsername: cleanUsername,
  };

  try {
    await setDoc(doc(db, 'resident_wallets', uid), {
      ...nextWallet,
      updatedAt: serverTimestamp(),
    });
    return nextWallet;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function performDailyPlotCheckIn(params: {
  uid: string;
  plotId: string;
  plotCode: string;
  username: string;
  currentWallet: ResidentWallet | null;
  currentCustomization: PlotCustomization | null;
}): Promise<{ wallet: ResidentWallet; customization: PlotCustomization; reward: number }> {
  const { uid, plotId, plotCode, username, currentWallet, currentCustomization } = params;
  const today = getUtcDayString();
  const yesterday = getPreviousUtcDayString(today);

  if (currentWallet?.lastCheckInDay === today) {
    throw new Error('You have already checked in today. Come back tomorrow UTC!');
  }

  const cleanPlotId = plotId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const cleanPlotCode = plotCode.trim().slice(0, 24);
  const cleanUsername = username.trim().slice(0, 32);

  const nextStreak =
    currentWallet?.lastCheckInDay === yesterday ? (currentWallet.streakDays || 0) + 1 : 1;
  const reward = computeDailyCheckInReward(nextStreak);

  const nextWallet: ResidentWallet = {
    uid,
    balance: (currentWallet?.balance ?? 0) + reward,
    streakDays: nextStreak,
    lastCheckInDay: today,
    totalCheckIns: (currentWallet?.totalCheckIns ?? 0) + 1,
    linkedPlotId: cleanPlotId,
    linkedPlotCode: cleanPlotCode,
    linkedUsername: cleanUsername,
  };

  const canWritePlotCust =
    !currentCustomization || currentCustomization.ownerUid === uid;

  const nextCustomization: PlotCustomization = {
    plotId: cleanPlotId,
    ownerUid: currentCustomization?.ownerUid || uid,
    ownerUsername: currentCustomization?.ownerUsername || cleanUsername,
    bio: currentCustomization?.bio ?? '',
    hasDrivewayLights: currentCustomization?.hasDrivewayLights ?? false,
    hasFlowerPlanters: currentCustomization?.hasFlowerPlanters ?? false,
    hasGardenFountain: currentCustomization?.hasGardenFountain ?? false,
    hasFestiveGarland: currentCustomization?.hasFestiveGarland ?? false,
    upgradeTier: currentCustomization?.upgradeTier ?? 0,
    checkInCount: (currentCustomization?.checkInCount ?? 0) + 1,
    lastCheckInDay: today,
  };

  const path = `resident_wallets/${uid}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'resident_wallets', uid), {
      ...nextWallet,
      updatedAt: serverTimestamp(),
    });
    if (canWritePlotCust) {
      batch.set(doc(db, 'plot_customizations', cleanPlotId), {
        ...nextCustomization,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return { wallet: nextWallet, customization: nextCustomization, reward };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function purchasePlotUpgradeInFirestore(params: {
  uid: string;
  plotId: string;
  username: string;
  upgradeId: PlotUpgradeId;
  cost: number;
  currentWallet: ResidentWallet;
  currentCustomization: PlotCustomization | null;
}): Promise<{ wallet: ResidentWallet; customization: PlotCustomization }> {
  const { uid, plotId, username, upgradeId, cost, currentWallet, currentCustomization } = params;
  if (currentWallet.balance < cost) {
    throw new Error(`Need ${cost} LDF Coins to unlock this upgrade.`);
  }

  const cleanPlotId = plotId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  if (currentCustomization && currentCustomization.ownerUid !== uid) {
    throw new Error('This plot customization belongs to another verified owner.');
  }

  const baseCust: PlotCustomization = currentCustomization ?? {
    plotId: cleanPlotId,
    ownerUid: uid,
    ownerUsername: username.trim().slice(0, 32),
    bio: '',
    hasDrivewayLights: false,
    hasFlowerPlanters: false,
    hasGardenFountain: false,
    hasFestiveGarland: false,
    upgradeTier: 0,
    checkInCount: 0,
    lastCheckInDay: '',
  };

  const nextCust: PlotCustomization = {
    ...baseCust,
    hasDrivewayLights: baseCust.hasDrivewayLights || upgradeId === 'driveway-lights',
    hasFlowerPlanters: baseCust.hasFlowerPlanters || upgradeId === 'flower-planters',
    hasGardenFountain: baseCust.hasGardenFountain || upgradeId === 'garden-fountain',
    hasFestiveGarland: baseCust.hasFestiveGarland || upgradeId === 'festive-garland',
    upgradeTier: 0,
  };
  nextCust.upgradeTier =
    Number(nextCust.hasDrivewayLights) +
    Number(nextCust.hasFlowerPlanters) +
    Number(nextCust.hasGardenFountain) +
    Number(nextCust.hasFestiveGarland);

  const nextWallet: ResidentWallet = {
    ...currentWallet,
    balance: currentWallet.balance - cost,
  };

  const path = `plot_customizations/${cleanPlotId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'resident_wallets', uid), {
      ...nextWallet,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'plot_customizations', cleanPlotId), {
      ...nextCust,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return { wallet: nextWallet, customization: nextCust };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function savePlotBioInFirestore(params: {
  uid: string;
  plotId: string;
  username: string;
  bio: string;
  currentCustomization: PlotCustomization | null;
}): Promise<PlotCustomization> {
  const { uid, plotId, username, bio, currentCustomization } = params;
  const cleanPlotId = plotId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  if (currentCustomization && currentCustomization.ownerUid !== uid) {
    throw new Error('Only the verified plot holder may edit this greeting.');
  }
  const nextCust: PlotCustomization = {
    plotId: cleanPlotId,
    ownerUid: currentCustomization?.ownerUid ?? uid,
    ownerUsername: currentCustomization?.ownerUsername ?? username.trim().slice(0, 32),
    bio: bio.trim().slice(0, 160),
    hasDrivewayLights: currentCustomization?.hasDrivewayLights ?? false,
    hasFlowerPlanters: currentCustomization?.hasFlowerPlanters ?? false,
    hasGardenFountain: currentCustomization?.hasGardenFountain ?? false,
    hasFestiveGarland: currentCustomization?.hasFestiveGarland ?? false,
    upgradeTier: currentCustomization?.upgradeTier ?? 0,
    checkInCount: currentCustomization?.checkInCount ?? 0,
    lastCheckInDay: currentCustomization?.lastCheckInDay ?? '',
  };
  const path = `plot_customizations/${cleanPlotId}`;
  try {
    await setDoc(doc(db, 'plot_customizations', cleanPlotId), {
      ...nextCust,
      updatedAt: serverTimestamp(),
    });
    return nextCust;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribePlotCustomizations(
  onMap: (map: Record<string, PlotCustomization>) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = 'plot_customizations';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const next: Record<string, PlotCustomization> = {};
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const pid = String(d.plotId ?? docSnap.id);
        next[pid] = {
          plotId: pid,
          ownerUid: String(d.ownerUid ?? ''),
          ownerUsername: String(d.ownerUsername ?? ''),
          bio: String(d.bio ?? ''),
          hasDrivewayLights: Boolean(d.hasDrivewayLights),
          hasFlowerPlanters: Boolean(d.hasFlowerPlanters),
          hasGardenFountain: Boolean(d.hasGardenFountain),
          hasFestiveGarland: Boolean(d.hasFestiveGarland),
          upgradeTier: Number(d.upgradeTier ?? 0),
          checkInCount: Number(d.checkInCount ?? 0),
          lastCheckInDay: String(d.lastCheckInDay ?? ''),
        };
      });
      onMap(next);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    },
  );
}

export function subscribePlotGuestbook(
  plotId: string,
  onEntries: (entries: PlotGuestbookEntry[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const cleanPlotId = plotId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const path = 'plot_guestbook';
  const q = query(
    collection(db, path),
    where('plotId', '==', cleanPlotId),
    limit(25),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: PlotGuestbookEntry[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        let createdAt = '';
        if (d.createdAt && typeof d.createdAt.toDate === 'function') {
          createdAt = (d.createdAt.toDate() as Date).toISOString();
        }
        list.push({
          entryId: String(d.entryId ?? docSnap.id),
          plotId: String(d.plotId ?? cleanPlotId),
          authorUid: String(d.authorUid ?? ''),
          authorName: String(d.authorName ?? 'Visitor'),
          message: String(d.message ?? ''),
          createdAt,
        });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onEntries(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    },
  );
}

export async function addPlotGuestbookEntryInFirestore(params: {
  plotId: string;
  authorUid: string;
  authorName: string;
  message: string;
}): Promise<PlotGuestbookEntry> {
  const { plotId, authorUid, authorName, message } = params;
  const cleanPlotId = plotId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const cleanName = (authorName.trim() || 'Resident').slice(0, 32);
  const cleanMsg = message.trim().slice(0, 180);
  if (!cleanMsg) {
    throw new Error('Guestbook note cannot be empty.');
  }
  const entryId = `gb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `plot_guestbook/${entryId}`;
  try {
    await setDoc(doc(db, 'plot_guestbook', entryId), {
      entryId,
      plotId: cleanPlotId,
      authorUid: authorUid.slice(0, 128),
      authorName: cleanName,
      message: cleanMsg,
      createdAt: serverTimestamp(),
    });
    return {
      entryId,
      plotId: cleanPlotId,
      authorUid,
      authorName: cleanName,
      message: cleanMsg,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deletePlotGuestbookEntryInFirestore(entryId: string): Promise<void> {
  const cleanId = entryId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `plot_guestbook/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'plot_guestbook', cleanId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

