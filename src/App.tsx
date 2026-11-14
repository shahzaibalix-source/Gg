import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CityRegistry } from './city/registry/CityRegistry';
import {
  CameraMode,
  CinematicTourId,
  ConstructionDraft,
  HouseArchetype,
  InteractionActionId,
  MobileInputState,
  NearbyInteractable,
  PlayerProfile,
  PrivateResidentRecord,
  TimeOfDay,
  TownPlot,
  TownPublicSettings,
  UserRole,
  WeatherMode,
} from './city/types';
import { CityScene } from './city/CityScene';
import {
  CityHUD,
  InspectedParkInfo,
  InspectedVehicleInfo,
} from './city/ui/CityHUD';
import { AdminPanelTab, FirestoreExpansionVerificationState } from './city/ui/AdminPanel';
import { MobileJoystick } from './city/ui/MobileJoystick';
import { CameraFocusTarget } from './city/camera/CityCameraController';
import { TOTAL_TOWN_VEHICLE_COUNT } from './city/simulation/TrafficManager';
import { cozyMusicEngine } from './city/audio/CozyMusicEngine';
import { spatialBirdAudio } from './city/audio/SpatialBirdAudio';
import { PARKED_CARS, SIDEWALK_HEIGHT, TOWN_BENCHES } from './city/world/MasterTownBlueprint';
import { DynamicVehicleObstacle } from './city/simulation/WorldCollision';
import { PlayerPoseState } from './city/player/WalkingPlayerController';
import { townMultiplayerService } from './city/services/TownServices';
import {
  buildExpansionCityWorld,
  ExpansionCityWorld,
} from './city/expansion/ExpansionMasterPlan';
import { generateMasterCityMap } from './city/planning/MasterCityPlanner';
import { DEFAULT_URBAN_PLAN_CONFIG, UrbanPlanConfig } from './city/planning/types';
import {
  CompactShardEntry,
  ExpansionManifest,
  ExpansionPlotSpec,
  ParsedFollowerDataset,
} from './city/expansion/types';
import {
  BUNDLED_ARCHIVE_PATH,
  BUNDLED_SEED_JSON_PATH,
  hydrateDatasetFromCompactEntries,
  parseFollowersFromUploadedFile,
  parseFollowersFromZipUrl,
} from './city/expansion/zipFollowerParser';
import {
  AdminRosterEntry,
  DEFAULT_TOWN_SETTINGS,
  adminAssignResidentInFirestore,
  adminDemolishPlotInFirestore,
  adminGrantAdminInFirestore,
  adminImportExpansionToFirestore,
  adminMovePlotsInFirestore,
  adminRevokeAdminInFirestore,
  adminRevokeResidentInFirestore,
  adminSavePlotToFirestore,
  adminSaveTownSettingsToFirestore,
  adminSaveTreasuryToFirestore,
  adminSeedTownDefaultsInFirestore,
  loadExpansionDirectoryShardsFromServer,
  resolveBackendUserRole,
  sanitizeInstagramUrl,
  signInWithGoogle,
  signOutUser,
  subscribeAdminResidentRecords,
  subscribeAdmins,
  subscribeAuthState,
  subscribeExpansionManifest,
  subscribeTownEconomy,
  subscribeTownPlots,
  subscribeTownSettings,
  verifyExpansionPersistenceInFirestore,
} from './city/firebase/firebaseClient';

const DEFAULT_PROFILE: PlayerProfile = {
  displayName: 'Town Visitor',
  jacketColor: '#2f5a87',
  trouserColor: '#2d3540',
  ownedPlotId: null,
};

function isAdminPathRequested(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    hash === '#/admin' ||
    hash.startsWith('#/admin/') ||
    hash === '#admin'
  );
}

const INITIAL_DRAFT: ConstructionDraft = {
  mode: 'idle',
  targetPlotId: null,
  sourcePlotId: null,
  buildingType: 'house',
  houseArchetype: 'cottage',
  businessCategory: 'cafe',
  rotationQuarterTurns: 0,
};

const PARK_INFO_MAP: Record<string, InspectedParkInfo> = {
  'park:park-central-lake': {
    title: 'Lindenhof Park Lake',
    subtitle: 'Tranquil centerpiece of District 3 Central Park.',
    highlights: [
      'Cross the arched timber footbridge freely on foot',
      'Four lakeside benches ready for first-person relaxation',
      'Surrounded by decomposed granite paths, tennis & playground',
    ],
  },
  'park:park-playground': {
    title: "Children's Playground",
    subtitle: 'Family recreation corner on cushioned timber-bordered ground.',
    highlights: [
      'Double swing set, climbing slide tower, and seesaw pad',
      'Adjacent to lakeside benches and shady broadleaf trees',
    ],
  },
  'park:park-tennis': {
    title: 'Community Tennis Court',
    subtitle: 'Open-air neighborhood tennis court in District 3.',
    highlights: [
      'Regulation-inspired green acrylic court with center net',
      'Steps away from the Cinema & Football Stadium promenade',
    ],
  },
  'park:park-fountain': {
    title: 'Central Square Fountain',
    subtitle: 'Historic tiered stone fountain plaza in front of Town Hall.',
    highlights: [
      '5 Town Square benches circle the cobblestone plaza',
      'Connects Residential, Commercial, and Park avenues',
    ],
  },
  'park:park-botanical-conservatory': {
    title: 'Lindenhof Botanical Conservatory',
    subtitle: 'Grand glasshouse dome, geometric parterres & rose arboretum.',
    highlights: [
      'Glass botanical dome surrounded by manicured European parterres',
      'Walkable promenades connecting East Historic Lindenhof to Grand Lake',
    ],
  },
  'park:park-waterfront-harbor': {
    title: 'Grand Lake & Waterfront Pier',
    subtitle: 'Panoramic harbor lakefront, timber boardwalk & twin piers.',
    highlights: [
      'Stroll onto either lakeside wooden pier to view moored sailboats',
      'Scenic coastal avenue linking Botanical Gardens and Outer Residential Quarters',
    ],
  },
};

export default function App() {
  const [urbanPlanConfig, setUrbanPlanConfig] = useState<UrbanPlanConfig>(DEFAULT_URBAN_PLAN_CONFIG);
  const masterCityPlan = useMemo(
    () => generateMasterCityMap(urbanPlanConfig),
    [urbanPlanConfig],
  );
  const registry = useMemo(() => new CityRegistry(masterCityPlan.plots), []);
  const [plots, setPlots] = useState<TownPlot[]>(() => registry.getAllPlots());
  const [treasuryVersion, setTreasuryVersion] = useState(0);

  useEffect(() => {
    registry.syncPlannedPlots(masterCityPlan.plots);
    setPlots(registry.getAllPlots());
  }, [registry, masterCityPlan]);

  const handleUpdatePlanConfig = useCallback((patch: Partial<UrbanPlanConfig>) => {
    setUrbanPlanConfig((prev) => ({
      ...prev,
      ...patch,
      blockSeeds: {
        ...prev.blockSeeds,
        ...(patch.blockSeeds ?? {}),
      },
    }));
  }, []);

  const handleRegenerateBlock = useCallback((blockId: string) => {
    setUrbanPlanConfig((prev) => ({
      ...prev,
      blockSeeds: {
        ...prev.blockSeeds,
        [blockId]: (prev.blockSeeds[blockId] ?? 0) + 1,
      },
    }));
  }, []);

  const handleExpandCityBlock = useCallback(() => {
    setUrbanPlanConfig((prev) => ({
      ...prev,
      expansionBlockCount: Math.min(3, prev.expansionBlockCount + 1),
    }));
  }, []);

  const handleResetMasterPlan = useCallback(() => {
    setUrbanPlanConfig(DEFAULT_URBAN_PLAN_CONFIG);
  }, []);

  const [cameraMode, setCameraMode] = useState<CameraMode>('isometric');
  const [cinematicTour, setCinematicTour] = useState<CinematicTourId>('town-hall-reveal');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('afternoon');
  const [weather, setWeather] = useState<WeatherMode>('sunny');

  // Admin-Only Firebase Auth State (Visitors are completely login-free)
  const [userRole, setUserRole] = useState<UserRole>('visitor');
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [adminRouteRequested, setAdminRouteRequested] = useState<boolean>(() =>
    isAdminPathRequested(),
  );

  // Welcome Screen & Admin Panel State
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() => !isAdminPathRequested());
  const [townSettings, setTownSettings] = useState<TownPublicSettings>(DEFAULT_TOWN_SETTINGS);
  const [adminPanelOpen, setAdminPanelOpen] = useState<boolean>(false);
  const [adminPanelTab, setAdminPanelTab] = useState<AdminPanelTab>('residents');
  const [focusedAdminPlotId, setFocusedAdminPlotId] = useState<string | null>(null);
  const [adminEntries, setAdminEntries] = useState<AdminRosterEntry[]>([]);
  const [residentRecords, setResidentRecords] = useState<Record<string, PrivateResidentRecord>>(
    {},
  );
  const [adminActionNotice, setAdminActionNotice] = useState<string | null>(null);

  const [selectedPlot, setSelectedPlot] = useState<TownPlot | null>(null);
  const [selectedExpansionPlot, setSelectedExpansionPlot] = useState<ExpansionPlotSpec | null>(null);
  const [followerDataset, setFollowerDataset] = useState<ParsedFollowerDataset | null>(null);
  const [expansionManifest, setExpansionManifest] = useState<ExpansionManifest | null>(null);
  const [firestoreVerifiedInfo, setFirestoreVerifiedInfo] =
    useState<FirestoreExpansionVerificationState | null>(null);
  const [cityMapOpen, setCityMapOpen] = useState(false);
  const [ogMonumentOpen, setOgMonumentOpen] = useState(false);

  const [constructionDraft, setConstructionDraft] = useState<ConstructionDraft>(INITIAL_DRAFT);
  const [editorFeedback, setEditorFeedback] = useState<string | null>(null);

  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(() => cozyMusicEngine.getVolume());
  const [birdAudioEnabled, setBirdAudioEnabled] = useState(() => spatialBirdAudio.isEnabled());
  const [reelsFrameEnabled, setReelsFrameEnabled] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // Login-free walking visitor appearance & interaction state
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [playerPanelOpen, setPlayerPanelOpen] = useState(false);
  const [sittingBenchId, setSittingBenchId] = useState<string | null>(null);
  const [openDoors, setOpenDoors] = useState<Record<string, boolean>>({});
  const [activeInteraction, setActiveInteraction] = useState<NearbyInteractable | null>(null);
  const [playerCoords, setPlayerCoords] = useState<{ x: number; z: number }>({ x: 0, z: 16.5 });

  const [inspectedVehicle, setInspectedVehicle] = useState<InspectedVehicleInfo | null>(null);
  const [inspectedPark, setInspectedPark] = useState<InspectedParkInfo | null>(null);
  const [ownerSpotlightPlot, setOwnerSpotlightPlot] = useState<TownPlot | null>(null);

  const focusTargetRef = useRef<CameraFocusTarget | null>(null);
  const playerPoseRef = useRef<PlayerPoseState>({
    x: 0,
    y: SIDEWALK_HEIGHT,
    z: 16.5,
    yaw: Math.PI,
  });
  const mobileInputRef = useRef<MobileInputState>({ moveX: 0, moveY: 0, sprint: false });
  const vehicleStatesRef = useRef<DynamicVehicleObstacle[]>([]);

  // Build deterministic 3D expansion city while preserving any existing core plot usernames
  const expansionWorld = useMemo<ExpansionCityWorld | null>(() => {
    if (!followerDataset) return null;
    const coreUsernames = new Set(
      plots
        .map((p) => p.ownerUsername?.trim().toLowerCase())
        .filter((u): u is string => Boolean(u)),
    );
    const nonConflictingResidents = followerDataset.allResidents.filter(
      (r) => !coreUsernames.has(r.usernameKey),
    );
    return buildExpansionCityWorld(
      nonConflictingResidents.length > 0 ? nonConflictingResidents : followerDataset.allResidents,
    );
  }, [followerDataset, plots]);

  useEffect(() => {
    if (!expansionWorld) {
      setSelectedExpansionPlot(null);
      return;
    }
    setSelectedExpansionPlot((prev) =>
      prev ? expansionWorld.plotById.get(prev.plotId) ?? null : null,
    );
  }, [expansionWorld]);

  const stats = useMemo(() => {
    const core = registry.getTownStats(TOTAL_TOWN_VEHICLE_COUNT);
    if (!expansionWorld) return core;
    const builtFollowerHouses =
      expansionWorld.counts.ogCount + expansionWorld.counts.residentHouseCount;
    return {
      ...core,
      totalHouses: core.totalHouses + builtFollowerHouses,
      occupiedPlots: core.occupiedPlots + builtFollowerHouses,
      availablePlots: core.availablePlots + expansionWorld.counts.openExpansionCount,
      totalPopulation: core.totalPopulation + builtFollowerHouses,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, plots, treasuryVersion, expansionWorld]);

  // Listen for browser navigation to /admin or #/admin
  useEffect(() => {
    const syncRoute = () => {
      setAdminRouteRequested(isAdminPathRequested());
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  // Automatically open Admin Panel once verified Super Admin visits /admin
  useEffect(() => {
    if (authLoading) return;
    if (adminRouteRequested && userRole === 'super-admin') {
      setWelcomeOpen(false);
      setAdminPanelOpen(true);
    } else if (userRole !== 'super-admin') {
      setAdminPanelOpen(false);
      setConstructionDraft(INITIAL_DRAFT);
    }
  }, [authLoading, adminRouteRequested, userRole]);

  // Subscribe to Firebase Authentication strictly for Admin verification
  useEffect(() => {
    let authSeq = 0;
    const unsubscribe = subscribeAuthState(async (user) => {
      const seq = ++authSeq;
      setAuthLoading(true);
      if (!user) {
        if (seq !== authSeq) return;
        setCurrentUserUid(null);
        setUserRole('visitor');
        setResidentRecords({});
        setAdminPanelOpen(false);
        setConstructionDraft(INITIAL_DRAFT);
        setAuthLoading(false);
        return;
      }

      try {
        const resolvedRole = await resolveBackendUserRole(user);
        if (seq !== authSeq) return;
        setCurrentUserUid(user.uid);
        setUserRole(resolvedRole);
        if (resolvedRole !== 'super-admin') {
          setAdminPanelOpen(false);
          setConstructionDraft(INITIAL_DRAFT);
          setResidentRecords({});
        }
      } catch (err) {
        if (seq !== authSeq) return;
        console.error('Admin verification check error:', err);
        setCurrentUserUid(user.uid);
        setUserRole('visitor');
      } finally {
        if (seq === authSeq) {
          setAuthLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to private resident records & admin roster strictly when Super Admin is verified
  useEffect(() => {
    if (userRole !== 'super-admin') {
      setResidentRecords({});
      setAdminEntries([]);
      return;
    }
    const unsubRecords = subscribeAdminResidentRecords(
      (records) => setResidentRecords(records),
      (err) => {
        console.warn('Admin resident records listener:', err.message);
      },
    );
    const unsubAdmins = subscribeAdmins(
      (entries) => setAdminEntries(entries),
      (err) => {
        console.warn('Admin roster listener:', err.message);
      },
    );
    return () => {
      unsubRecords();
      unsubAdmins();
    };
  }, [userRole]);

  // Subscribe to public read-only Cloud Firestore town data (no sign-in required)
  useEffect(() => {
    const unsubPlots = subscribeTownPlots(
      (overrides) => {
        registry.applyRemoteOverrides(overrides);
        const updatedPlots = registry.getAllPlots();
        setPlots(updatedPlots);
        setSelectedPlot((prev) =>
          prev ? updatedPlots.find((p) => p.id === prev.id) ?? null : null,
        );
      },
      (err) => {
        console.warn('Town plots sync warning:', err.message);
      },
    );

    const unsubEconomy = subscribeTownEconomy(
      (balance) => {
        registry.setTreasuryBalance(balance);
        setTreasuryVersion((v) => v + 1);
      },
      (err) => {
        console.warn('Town treasury sync warning:', err.message);
      },
    );

    const unsubSettings = subscribeTownSettings(
      (settings) => setTownSettings(settings),
      (err) => {
        console.warn('Town settings sync warning:', err.message);
      },
    );

    return () => {
      unsubPlots();
      unsubEconomy();
      unsubSettings();
    };
  }, [registry]);

  // Load bundled follower seed JSON immediately on boot (non-blocking, zero unauthenticated Firestore writes)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(BUNDLED_SEED_JSON_PATH);
        if (!res.ok) return;
        const seed = (await res.json()) as {
          sourceName: string;
          totalRawFollowers: number;
          duplicatesRemoved: number;
          shards: CompactShardEntry[][];
        };
        if (cancelled || !Array.isArray(seed.shards)) return;
        const hydrated = hydrateDatasetFromCompactEntries(seed.shards.flat(), {
          sourceName: seed.sourceName,
          totalRawFollowers: seed.totalRawFollowers,
          duplicatesRemoved: seed.duplicatesRemoved,
        });
        setFollowerDataset((prev) => prev ?? hydrated);
      } catch (err) {
        console.warn('Follower seed JSON preload warning:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to Cloud Firestore expansion manifest; when present, hydrate authoritatively from server shards
  useEffect(() => {
    let active = true;
    const unsubManifest = subscribeExpansionManifest(
      async (manifest) => {
        if (!active) return;
        setExpansionManifest(manifest);
        if (!manifest || manifest.shardCount <= 0) {
          setFirestoreVerifiedInfo({
            exists: false,
            verifiedShardCount: 0,
            verifiedResidentCount: 0,
          });
          return;
        }
        try {
          const [loadedDataset, verified] = await Promise.all([
            loadExpansionDirectoryShardsFromServer(manifest),
            verifyExpansionPersistenceInFirestore(),
          ]);
          if (!active) return;
          if (loadedDataset.allResidents.length > 0) {
            setFollowerDataset(loadedDataset);
          }
          setFirestoreVerifiedInfo({
            exists: verified.exists,
            verifiedShardCount: verified.verifiedShardCount,
            verifiedResidentCount: verified.verifiedResidentCount,
            lastCheckedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('Firestore expansion shard load warning:', err);
        }
      },
      (err) => {
        console.warn('Expansion manifest listener:', err.message);
      },
    );
    return () => {
      active = false;
      unsubManifest();
    };
  }, []);

  const handleChangeCameraMode = useCallback(
    (nextMode: CameraMode) => {
      if (nextMode !== 'walking' && sittingBenchId) {
        townMultiplayerService.releaseBench(sittingBenchId);
        setSittingBenchId(null);
      }
      if (nextMode !== 'walking') {
        mobileInputRef.current.moveX = 0;
        mobileInputRef.current.moveY = 0;
        setActiveInteraction(null);
      }
      setCameraMode(nextMode);
    },
    [sittingBenchId],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'KeyC') {
        setCameraMode((prev) => {
          const next =
            prev === 'isometric'
              ? 'free'
              : prev === 'free'
                ? 'aerial'
                : prev === 'aerial'
                  ? 'walking'
                  : prev === 'walking'
                    ? 'cinematic'
                    : 'isometric';
          if (next !== 'walking' && sittingBenchId) {
            townMultiplayerService.releaseBench(sittingBenchId);
            setSittingBenchId(null);
          }
          if (next !== 'walking') {
            mobileInputRef.current.moveX = 0;
            mobileInputRef.current.moveY = 0;
            setActiveInteraction(null);
          }
          return next;
        });
      } else if (e.code === 'Escape') {
        if (sittingBenchId) {
          townMultiplayerService.releaseBench(sittingBenchId);
          setSittingBenchId(null);
        } else {
          setWelcomeOpen(false);
          setCityMapOpen(false);
          setOgMonumentOpen(false);
          setSelectedExpansionPlot(null);
          setConstructionDraft(INITIAL_DRAFT);
          setEditorFeedback(null);
          setPlayerPanelOpen(false);
          setAdminPanelOpen(false);
          setInspectedVehicle(null);
          setInspectedPark(null);
          setOwnerSpotlightPlot(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sittingBenchId]);

  useEffect(() => () => cozyMusicEngine.stop(), []);

  const handleSignIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed.';
      if (!message.includes('auth/popup-closed-by-user')) {
        setAuthError('Sign-in was interrupted or blocked. Please allow popups and try again.');
      }
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setAuthError(null);
    try {
      await signOutUser();
      setAdminPanelOpen(false);
      setResidentRecords({});
      setConstructionDraft(INITIAL_DRAFT);
      setEditorFeedback(null);
      setAdminActionNotice(null);
      setAdminRouteRequested(false);
      if (typeof window !== 'undefined' && isAdminPathRequested()) {
        window.history.replaceState(null, '', '/');
      }
    } catch {
      setAuthError('Could not sign out cleanly. Please try again.');
    }
  }, []);

  const handleDismissAdminGate = useCallback(() => {
    setAdminRouteRequested(false);
    if (typeof window !== 'undefined' && isAdminPathRequested()) {
      window.history.replaceState(null, '', '/');
    }
  }, []);

  const handleUpdateProfile = useCallback((patch: Partial<PlayerProfile>) => {
    setPlayerProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleFocusLocation = useCallback((x: number, z: number, zoom = 52) => {
    focusTargetRef.current = { x, z, zoom };
  }, []);

  const handleWalkToLocation = useCallback(
    (x: number, z: number, expansionPlot?: ExpansionPlotSpec, corePlot?: TownPlot) => {
      if (sittingBenchId) {
        townMultiplayerService.releaseBench(sittingBenchId);
        setSittingBenchId(null);
      }
      let destX = x;
      let destZ = z;
      let destYaw = Math.PI;
      if (expansionPlot) {
        const approach = expansionPlot.status === 'vip' ? 23.0 : expansionPlot.depth / 2 + 2.4;
        destX = expansionPlot.x + Math.sin(expansionPlot.facingAngle) * approach;
        destZ = expansionPlot.z + Math.cos(expansionPlot.facingAngle) * approach;
        destYaw = expansionPlot.facingAngle + Math.PI;
      } else if (corePlot) {
        const approach = corePlot.depth / 2 + 2.4;
        destX = corePlot.center.x + Math.sin(corePlot.facingAngle) * approach;
        destZ = corePlot.center.z + Math.cos(corePlot.facingAngle) * approach;
        destYaw = corePlot.facingAngle + Math.PI;
      }
      playerPoseRef.current.x = destX;
      playerPoseRef.current.y = SIDEWALK_HEIGHT;
      playerPoseRef.current.z = destZ;
      playerPoseRef.current.yaw = destYaw;
      setPlayerCoords({ x: destX, z: destZ });
      setCameraMode('walking');
      focusTargetRef.current = { x: destX, z: destZ, zoom: 38 };
    },
    [sittingBenchId],
  );

  const handleSelectExpansionPlot = useCallback((plot: ExpansionPlotSpec | null) => {
    setSelectedExpansionPlot(plot);
    if (plot) {
      setSelectedPlot(null);
      setInspectedVehicle(null);
      setInspectedPark(null);
      setOwnerSpotlightPlot(null);
    }
  }, []);

  const handleSelectPlot = useCallback(
    (plot: TownPlot | null) => {
      if (constructionDraft.mode !== 'idle' && plot && userRole === 'super-admin') {
        const isEmpty =
          !plot.house && !plot.business && !plot.publicBuilding && plot.category !== 'public';
        if (!isEmpty) {
          setEditorFeedback(`${plot.plotCode} is already occupied or civic-protected.`);
          return;
        }
        setEditorFeedback(null);
        setConstructionDraft((prev) => ({ ...prev, targetPlotId: plot.id }));
        return;
      }
      setSelectedPlot(plot);
      if (plot) {
        setSelectedExpansionPlot(null);
        setInspectedVehicle(null);
        setInspectedPark(null);
        setOwnerSpotlightPlot(null);
      }
    },
    [constructionDraft.mode, userRole],
  );

  const handleActiveInteractionChange = useCallback((item: NearbyInteractable | null) => {
    setActiveInteraction(item);
    setPlayerCoords({ x: playerPoseRef.current.x, z: playerPoseRef.current.z });
  }, []);

  const handleTogglePlayerPanel = useCallback(() => {
    setPlayerCoords({ x: playerPoseRef.current.x, z: playerPoseRef.current.z });
    setPlayerPanelOpen((v) => !v);
  }, []);

  const handleTriggerInteraction = useCallback(
    (actionId: InteractionActionId) => {
      if (actionId === 'stand-up') {
        if (sittingBenchId) {
          townMultiplayerService.releaseBench(sittingBenchId);
          setSittingBenchId(null);
        }
        return;
      }

      if (!activeInteraction) return;

      if (actionId === 'sit' && activeInteraction.benchId) {
        if (townMultiplayerService.occupyBench(activeInteraction.benchId)) {
          setSittingBenchId(activeInteraction.benchId);
          setSelectedPlot(null);
          setInspectedVehicle(null);
          setInspectedPark(null);
          setOwnerSpotlightPlot(null);
        }
        return;
      }

      if (actionId === 'open-og-monument') {
        setOgMonumentOpen(true);
        return;
      }

      if (actionId === 'toggle-door') {
        const pid = activeInteraction.plotId ?? activeInteraction.expansionPlotId;
        if (pid) {
          setOpenDoors((prev) => ({ ...prev, [pid]: !prev[pid] }));
        }
        return;
      }

      if (actionId === 'view-house' || actionId === 'view-shop' || actionId === 'view-town-info') {
        if (activeInteraction.expansionPlotId && expansionWorld) {
          const ep = expansionWorld.plotById.get(activeInteraction.expansionPlotId) ?? null;
          if (ep) {
            setSelectedExpansionPlot(ep);
            setSelectedPlot(null);
            setInspectedVehicle(null);
            setInspectedPark(null);
            setOwnerSpotlightPlot(null);
          }
          return;
        }
        if (activeInteraction.plotId) {
          const plot = plots.find((p) => p.id === activeInteraction.plotId) ?? null;
          if (plot) {
            setSelectedPlot(plot);
            setSelectedExpansionPlot(null);
            setInspectedVehicle(null);
            setInspectedPark(null);
            setOwnerSpotlightPlot(null);
          }
        }
        return;
      }

      if (actionId === 'view-owner') {
        if (activeInteraction.expansionPlotId && expansionWorld) {
          const ep = expansionWorld.plotById.get(activeInteraction.expansionPlotId) ?? null;
          if (ep) {
            setSelectedExpansionPlot(ep);
            setSelectedPlot(null);
            setInspectedVehicle(null);
            setInspectedPark(null);
            setOwnerSpotlightPlot(null);
          }
          return;
        }
        if (activeInteraction.plotId) {
          const plot = plots.find((p) => p.id === activeInteraction.plotId) ?? null;
          if (plot) {
            setOwnerSpotlightPlot(plot);
            setSelectedPlot(null);
            setSelectedExpansionPlot(null);
            setInspectedVehicle(null);
            setInspectedPark(null);
          }
        }
        return;
      }

      if (actionId === 'inspect-vehicle' && activeInteraction.vehicleId) {
        const vid = activeInteraction.vehicleId;
        const parked = PARKED_CARS.find((c) => c.id === vid);
        if (parked) {
          setInspectedVehicle({
            id: parked.id,
            title: `Parked ${parked.style.charAt(0).toUpperCase() + parked.style.slice(1)}`,
            style: parked.style,
            color: parked.color,
            status: 'Parked in public bay',
            speedKmh: 0,
          });
        } else {
          const live = vehicleStatesRef.current.find((v) => v.id === vid);
          if (live) {
            setInspectedVehicle({
              id: live.id,
              title: `Town ${live.style.charAt(0).toUpperCase() + live.style.slice(1)}`,
              style: live.style,
              color: live.color,
              status: live.speed < 0.8 ? 'Yielding at signal' : 'Cruising avenue',
              speedKmh: Math.round(live.speed * 3.6),
            });
          }
        }
        setSelectedPlot(null);
        setInspectedPark(null);
        setOwnerSpotlightPlot(null);
        return;
      }

      if (actionId === 'view-park-info') {
        const info = PARK_INFO_MAP[activeInteraction.uid] ?? {
          title: activeInteraction.title,
          subtitle: activeInteraction.subtitle,
          highlights: ['Public European town green space'],
        };
        setInspectedPark(info);
        setSelectedPlot(null);
        setInspectedVehicle(null);
        setOwnerSpotlightPlot(null);
        return;
      }

      if (actionId === 'explore-park') {
        if (activeInteraction.uid === 'park:park-central-lake') {
          focusTargetRef.current = { x: 58.0, z: -2.6, zoom: 38 };
        } else if (activeInteraction.uid === 'park:park-fountain') {
          focusTargetRef.current = { x: 0, z: 14.5, zoom: 38 };
        } else if (activeInteraction.uid === 'park:park-playground') {
          focusTargetRef.current = { x: 42.2, z: 15.8, zoom: 38 };
        } else if (activeInteraction.uid === 'park:park-botanical-conservatory') {
          focusTargetRef.current = { x: 236, z: 0, zoom: 48 };
        } else if (activeInteraction.uid === 'park:park-waterfront-harbor') {
          focusTargetRef.current = { x: 378, z: 0, zoom: 48 };
        } else {
          focusTargetRef.current = { x: 41.2, z: -6.5, zoom: 38 };
        }
      }
    },
    [activeInteraction, expansionWorld, plots, sittingBenchId],
  );

  const handleTriggerPrimaryAction = useCallback(() => {
    if (sittingBenchId) {
      townMultiplayerService.releaseBench(sittingBenchId);
      setSittingBenchId(null);
      return;
    }
    if (!activeInteraction || activeInteraction.actions.length === 0) return;
    const firstEnabled = activeInteraction.actions.find((a) => !a.disabled);
    if (firstEnabled) {
      handleTriggerInteraction(firstEnabled.id);
    }
  }, [activeInteraction, handleTriggerInteraction, sittingBenchId]);

  const handleSelectBenchFromScene = useCallback(
    (benchId: string) => {
      if (cameraMode !== 'walking' || sittingBenchId) return;
      const bench = TOWN_BENCHES.find((b) => b.id === benchId);
      if (!bench) return;
      const dist = Math.hypot(playerPoseRef.current.x - bench.x, playerPoseRef.current.z - bench.z);
      if (dist <= 3.6 && townMultiplayerService.occupyBench(benchId)) {
        setSittingBenchId(benchId);
      }
    },
    [cameraMode, sittingBenchId],
  );

  // ---------------------------------------------------------------------------
  // Super Admin Actions (Protected by Firestore Security Rules)
  // ---------------------------------------------------------------------------

  const handleToggleAdminPanel = useCallback(
    (requestedTab?: AdminPanelTab) => {
      if (userRole !== 'super-admin') return;
      if (requestedTab) {
        setAdminPanelTab(requestedTab);
        setAdminPanelOpen(true);
        if (requestedTab === 'builder' && constructionDraft.mode === 'idle') {
          setConstructionDraft((prev) => ({ ...prev, mode: 'place' }));
        }
        return;
      }
      setAdminPanelOpen((prev) => {
        const next = !prev;
        if (!next) {
          setConstructionDraft(INITIAL_DRAFT);
          setEditorFeedback(null);
        }
        return next;
      });
    },
    [userRole, constructionDraft.mode],
  );

  const handleManagePlotOwnership = useCallback(
    (plotId: string) => {
      if (userRole !== 'super-admin') return;
      setFocusedAdminPlotId(plotId);
      setAdminPanelTab('residents');
      setAdminPanelOpen(true);
    },
    [userRole],
  );

  const handleApproveResident = useCallback(
    async (params: {
      plotId: string;
      inGameUsername: string;
      instagramHandle: string;
      notes: string;
      archetype: HouseArchetype;
    }): Promise<boolean> => {
      if (userRole !== 'super-admin' || !currentUserUid) {
        setAuthError('Super Admin authorization required.');
        return false;
      }
      setAdminActionNotice(null);

      const cleanIg = params.instagramHandle.trim().replace(/^@+/, '@').toLowerCase();
      const duplicateIgEntry = Object.values(residentRecords).find(
        (rec) =>
          rec.plotId !== params.plotId &&
          rec.instagramHandle.trim().replace(/^@+/, '@').toLowerCase() === cleanIg,
      );
      if (duplicateIgEntry) {
        setAdminActionNotice(
          `Instagram handle ${cleanIg} is already assigned to plot ${duplicateIgEntry.plotId.toUpperCase()}. Duplicate assignments are blocked.`,
        );
        return false;
      }

      const prevSnapshot = registry.getPlotById(params.plotId);
      const res = registry.approveResidentForPlot(
        params.plotId,
        params.inGameUsername,
        params.archetype,
      );
      if (!res.ok || !res.plot) {
        setAdminActionNotice(res.error ?? 'Could not assign resident.');
        return false;
      }

      try {
        await adminAssignResidentInFirestore({
          plot: res.plot,
          previousUsername: null,
          inGameUsername: params.inGameUsername,
          instagramHandle: params.instagramHandle,
          notes: params.notes,
          adminUid: currentUserUid,
        });
        setPlots(registry.getAllPlots());
        setSelectedPlot(res.plot);
        setAdminActionNotice(
          `Approved ${res.plot.ownerUsername} on ${res.plot.plotCode}.`,
        );
        return true;
      } catch (err) {
        console.error('Admin resident approval failed:', err);
        if (prevSnapshot) {
          registry.restorePlot(prevSnapshot);
          setPlots(registry.getAllPlots());
          setSelectedPlot((cur) => (cur?.id === prevSnapshot.id ? prevSnapshot : cur));
        }
        setAdminActionNotice(
          'Failed to save resident assignment in Cloud Firestore (duplicate or permission error).',
        );
        return false;
      }
    },
    [userRole, currentUserUid, residentRecords, registry],
  );

  const handleReassignResident = useCallback(
    async (params: {
      plotId: string;
      inGameUsername: string;
      instagramHandle: string;
      notes: string;
    }): Promise<boolean> => {
      if (userRole !== 'super-admin' || !currentUserUid) {
        setAuthError('Super Admin authorization required.');
        return false;
      }
      setAdminActionNotice(null);

      const cleanIg = params.instagramHandle.trim().replace(/^@+/, '@').toLowerCase();
      const duplicateIgEntry = Object.values(residentRecords).find(
        (rec) =>
          rec.plotId !== params.plotId &&
          rec.instagramHandle.trim().replace(/^@+/, '@').toLowerCase() === cleanIg,
      );
      if (duplicateIgEntry) {
        setAdminActionNotice(
          `Instagram handle ${cleanIg} is already assigned to another house (${duplicateIgEntry.plotId.toUpperCase()}).`,
        );
        return false;
      }

      const prevSnapshot = registry.getPlotById(params.plotId);
      const res = registry.reassignResidentOnPlot(params.plotId, params.inGameUsername);
      if (!res.ok || !res.plot) {
        setAdminActionNotice(res.error ?? 'Could not update ownership.');
        return false;
      }

      try {
        await adminAssignResidentInFirestore({
          plot: res.plot,
          previousUsername: res.previousUsername,
          inGameUsername: params.inGameUsername,
          instagramHandle: params.instagramHandle,
          notes: params.notes,
          adminUid: currentUserUid,
        });
        setPlots(registry.getAllPlots());
        setSelectedPlot(res.plot);
        setAdminActionNotice(`Updated owner of ${res.plot.plotCode} to ${res.plot.ownerUsername}.`);
        return true;
      } catch (err) {
        console.error('Admin resident reassign failed:', err);
        if (prevSnapshot) {
          registry.restorePlot(prevSnapshot);
          setPlots(registry.getAllPlots());
          setSelectedPlot((cur) => (cur?.id === prevSnapshot.id ? prevSnapshot : cur));
        }
        setAdminActionNotice('Could not update resident ownership in Cloud Firestore.');
        return false;
      }
    },
    [userRole, currentUserUid, residentRecords, registry],
  );

  const handleRevokeResident = useCallback(
    async (plotId: string): Promise<boolean> => {
      if (userRole !== 'super-admin' || !currentUserUid) {
        setAuthError('Super Admin authorization required.');
        return false;
      }
      setAdminActionNotice(null);

      const prevSnapshot = registry.getPlotById(plotId);
      const res = registry.revokeResidentOwnership(plotId);
      if (!res.ok || !res.plot) {
        setAdminActionNotice(res.error ?? 'Could not revoke ownership.');
        return false;
      }

      try {
        await adminRevokeResidentInFirestore({
          plot: res.plot,
          previousUsername: res.previousUsername,
          adminUid: currentUserUid,
        });
        setPlots(registry.getAllPlots());
        setSelectedPlot(res.plot);
        setAdminActionNotice(
          `Revoked ownership on ${res.plot.plotCode}. Plot is now Available.`,
        );
        return true;
      } catch (err) {
        console.error('Admin revoke failed:', err);
        if (prevSnapshot) {
          registry.restorePlot(prevSnapshot);
          setPlots(registry.getAllPlots());
          setSelectedPlot((cur) => (cur?.id === prevSnapshot.id ? prevSnapshot : cur));
        }
        setAdminActionNotice('Could not revoke ownership in Cloud Firestore.');
        return false;
      }
    },
    [userRole, currentUserUid, registry],
  );

  const handleDemolishPlot = useCallback(
    async (plotId: string): Promise<boolean> => {
      if (userRole !== 'super-admin' || !currentUserUid) {
        setAuthError('Super Admin authorization required.');
        return false;
      }
      setAdminActionNotice(null);

      const prevSnapshot = registry.getPlotById(plotId);
      const res = registry.removeBuildingFromPlot(plotId);
      if (!res.ok || !res.plot) {
        setAdminActionNotice(res.error ?? 'Could not demolish building.');
        return false;
      }

      setPlots(registry.getAllPlots());
      setSelectedPlot(res.plot);
      try {
        await adminDemolishPlotInFirestore({
          plot: res.plot,
          previousUsername: res.previousUsername,
          adminUid: currentUserUid,
        });
        setAdminActionNotice(`Demolished building on ${res.plot.plotCode}. Plot is now empty.`);
        return true;
      } catch (err) {
        console.error('Admin demolish failed:', err);
        if (prevSnapshot) {
          registry.restorePlot(prevSnapshot);
          setPlots(registry.getAllPlots());
          setSelectedPlot((cur) => (cur?.id === prevSnapshot.id ? prevSnapshot : cur));
        }
        setAdminActionNotice('Could not demolish building in Cloud Firestore.');
        return false;
      }
    },
    [userRole, currentUserUid, registry],
  );

  const handleSaveTownSettings = useCallback(
    async (nextSettings: TownPublicSettings): Promise<boolean> => {
      if (userRole !== 'super-admin' || !currentUserUid) {
        setAuthError('Super Admin authorization required.');
        return false;
      }
      const cleaned: TownPublicSettings = {
        welcomeTitle: nextSettings.welcomeTitle.trim() || DEFAULT_TOWN_SETTINGS.welcomeTitle,
        welcomeSubtitle:
          nextSettings.welcomeSubtitle.trim() || DEFAULT_TOWN_SETTINGS.welcomeSubtitle,
        instagramUrl: sanitizeInstagramUrl(nextSettings.instagramUrl),
        instagramInstruction:
          nextSettings.instagramInstruction.trim() || DEFAULT_TOWN_SETTINGS.instagramInstruction,
      };
      try {
        await adminSaveTownSettingsToFirestore(cleaned, currentUserUid);
        setTownSettings(cleaned);
        setAdminActionNotice('Saved Welcome Screen & Instagram URL settings to Cloud Firestore.');
        return true;
      } catch (err) {
        console.error('Save settings failed:', err);
        setAdminActionNotice('Could not save settings to Cloud Firestore.');
        return false;
      }
    },
    [userRole, currentUserUid],
  );

  const handleGrantAdmin = useCallback(
    async (targetUid: string): Promise<boolean> => {
      if (userRole !== 'super-admin') {
        setAuthError('Super Admin authorization required.');
        return false;
      }
      setAdminActionNotice(null);
      try {
        await adminGrantAdminInFirestore(targetUid);
        setAdminActionNotice(`Granted Super Admin role to UID ${targetUid}.`);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not grant admin role.';
        setAdminActionNotice(msg);
        return false;
      }
    },
    [userRole],
  );

  const handleRevokeAdmin = useCallback(
    async (targetUid: string): Promise<boolean> => {
      if (userRole !== 'super-admin') {
        setAuthError('Super Admin authorization required.');
        return false;
      }
      if (targetUid === currentUserUid) {
        setAdminActionNotice('You cannot revoke your own active admin UID.');
        return false;
      }
      setAdminActionNotice(null);
      try {
        await adminRevokeAdminInFirestore(targetUid);
        setAdminActionNotice(`Revoked Super Admin role for UID ${targetUid}.`);
        return true;
      } catch {
        setAdminActionNotice('Could not revoke admin UID in Cloud Firestore.');
        return false;
      }
    },
    [userRole, currentUserUid],
  );

  const handleSeedTownDefaults = useCallback(async (): Promise<boolean> => {
    if (userRole !== 'super-admin' || !currentUserUid) {
      setAuthError('Super Admin authorization required.');
      return false;
    }
    setAdminActionNotice(null);
    try {
      const currentPlots = registry.getAllPlots();
      await adminSeedTownDefaultsInFirestore({
        plots: currentPlots,
        treasuryBalance: stats.townTreasury,
        settings: townSettings,
        adminUid: currentUserUid,
      });
      setAdminActionNotice(`Synced ${currentPlots.length} town plots, treasury, and settings to Cloud Firestore.`);
      return true;
    } catch (err) {
      console.error('Cloud town seed failed:', err);
      setAdminActionNotice('Could not sync town defaults to Cloud Firestore.');
      return false;
    }
  }, [userRole, currentUserUid, registry, stats.townTreasury, townSettings]);

  const handleImportDatasetToFirestore = useCallback(
    async (dataset: ParsedFollowerDataset, onProgress?: (msg: string) => void): Promise<boolean> => {
      if (userRole !== 'super-admin' || !currentUserUid) {
        setAuthError('Super Admin authorization required to persist follower directory.');
        return false;
      }
      setAdminActionNotice(null);
      try {
        setFollowerDataset(dataset);
        const world = buildExpansionCityWorld(dataset.allResidents);
        const result = await adminImportExpansionToFirestore({
          dataset,
          expansionOpenPlots: world.counts.openExpansionCount,
          adminUid: currentUserUid,
          onProgress,
        });
        const verified = await verifyExpansionPersistenceInFirestore();
        setFirestoreVerifiedInfo({
          exists: verified.exists,
          verifiedShardCount: verified.verifiedShardCount,
          verifiedResidentCount: verified.verifiedResidentCount,
          lastCheckedAt: new Date().toISOString(),
        });
        if (verified.manifest) {
          setExpansionManifest(verified.manifest);
        }
        setAdminActionNotice(
          `Imported & server-verified ${result.verifiedResidentCount.toLocaleString()} followers across ${result.verifiedShardCount} Firestore shards.`,
        );
        return true;
      } catch (err) {
        console.error('Follower ZIP import failed:', err);
        const message = err instanceof Error ? err.message : 'Follower ZIP import failed.';
        setAdminActionNotice(`Import failed: ${message}`);
        return false;
      }
    },
    [userRole, currentUserUid],
  );

  const handleImportBundledZip = useCallback(
    async (onProgress: (msg: string) => void): Promise<boolean> => {
      try {
        onProgress('Downloading & extracting bundled Instagram ZIP archive...');
        const dataset = await parseFollowersFromZipUrl(BUNDLED_ARCHIVE_PATH);
        return await handleImportDatasetToFirestore(dataset, onProgress);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not parse bundled ZIP archive.';
        setAdminActionNotice(`ZIP parse error: ${message}`);
        onProgress(`Error: ${message}`);
        return false;
      }
    },
    [handleImportDatasetToFirestore],
  );

  const handleImportUploadedZip = useCallback(
    async (file: File, onProgress: (msg: string) => void): Promise<boolean> => {
      try {
        onProgress(`Extracting followers from ${file.name}...`);
        const dataset = await parseFollowersFromUploadedFile(file);
        return await handleImportDatasetToFirestore(dataset, onProgress);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not parse uploaded file.';
        setAdminActionNotice(`Upload parse error: ${message}`);
        onProgress(`Error: ${message}`);
        return false;
      }
    },
    [handleImportDatasetToFirestore],
  );

  const handleVerifyExpansionInFirestore = useCallback(async (): Promise<void> => {
    try {
      const verified = await verifyExpansionPersistenceInFirestore();
      setFirestoreVerifiedInfo({
        exists: verified.exists,
        verifiedShardCount: verified.verifiedShardCount,
        verifiedResidentCount: verified.verifiedResidentCount,
        lastCheckedAt: new Date().toISOString(),
      });
      if (verified.manifest) {
        setExpansionManifest(verified.manifest);
      }
      setAdminActionNotice(
        verified.exists
          ? `Server readback verified: ${verified.verifiedResidentCount.toLocaleString()} residents in ${verified.verifiedShardCount} shards.`
          : 'No persisted follower directory found in Firestore yet.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Firestore readback failed.';
      setAdminActionNotice(`Verification error: ${msg}`);
    }
  }, []);

  const handleClaimBusinessPlot = useCallback(
    (plotId: string, username: string) => {
      if (userRole !== 'super-admin' || !currentUserUid) {
        setAuthError('Super Admin authorization required to assign business leases.');
        return;
      }
      const prevSnapshot = registry.getPlotById(plotId);
      const updated = registry.claimOrOpenBusiness(plotId, username);
      if (!updated) return;
      setPlots(registry.getAllPlots());
      setSelectedPlot(updated);
      void adminSavePlotToFirestore(updated, currentUserUid).catch((err) => {
        console.error('Admin business lease failed:', err);
        if (prevSnapshot) {
          registry.restorePlot(prevSnapshot);
          setPlots(registry.getAllPlots());
          setSelectedPlot((cur) => (cur?.id === prevSnapshot.id ? prevSnapshot : cur));
        }
        setAuthError('Could not save business lease to Cloud Firestore.');
      });
    },
    [registry, userRole, currentUserUid],
  );

  const handleUpgradePlot = useCallback(
    (plotId: string) => {
      if (userRole !== 'super-admin' || !currentUserUid) {
        setAuthError('Super Admin authorization required to upgrade properties.');
        return;
      }
      const prevSnapshot = registry.getPlotById(plotId);
      const updated = registry.upgradePlot(plotId);
      if (!updated) return;
      setPlots(registry.getAllPlots());
      setSelectedPlot(updated);
      void adminSavePlotToFirestore(updated, currentUserUid).catch((err) => {
        console.error('Admin plot upgrade failed:', err);
        if (prevSnapshot) {
          registry.restorePlot(prevSnapshot);
          setPlots(registry.getAllPlots());
          setSelectedPlot((cur) => (cur?.id === prevSnapshot.id ? prevSnapshot : cur));
        }
        setAuthError('Plot upgrade could not be saved to Cloud Firestore.');
      });
    },
    [registry, currentUserUid, userRole],
  );

  const handleCollectDailyRevenue = useCallback(() => {
    if (userRole !== 'super-admin' || !currentUserUid) {
      setAuthError('Super Admin authorization required to collect town treasury taxes.');
      return;
    }
    const prevBalance = stats.townTreasury;
    const nextBalance = registry.collectDailyBusinessRevenue();
    setTreasuryVersion((v) => v + 1);
    void adminSaveTreasuryToFirestore(nextBalance, currentUserUid).catch((err) => {
      console.error('Treasury save failed:', err);
      registry.setTreasuryBalance(prevBalance);
      setTreasuryVersion((v) => v + 1);
      setAuthError('Could not persist treasury balance to Cloud Firestore.');
    });
  }, [registry, userRole, currentUserUid, stats.townTreasury]);

  const handleUpdateDraft = useCallback(
    (patch: Partial<ConstructionDraft>) => {
      if (userRole !== 'super-admin') return;
      setEditorFeedback(null);
      setConstructionDraft((prev) => ({ ...prev, ...patch }));
    },
    [userRole],
  );

  const handleConfirmConstruction = useCallback(() => {
    if (userRole !== 'super-admin' || !currentUserUid) {
      setEditorFeedback('Super Admin role required for construction edits.');
      return;
    }
    if (!constructionDraft.targetPlotId) return;

    if (constructionDraft.mode === 'place') {
      const prevTarget = registry.getPlotById(constructionDraft.targetPlotId);
      const res = registry.placeBuildingOnEmptyPlot(constructionDraft.targetPlotId, {
        buildingType: constructionDraft.buildingType,
        houseArchetype: constructionDraft.houseArchetype,
        businessCategory: constructionDraft.businessCategory,
        rotationQuarterTurns: constructionDraft.rotationQuarterTurns,
      });
      if (!res.ok || !res.plot) {
        setEditorFeedback(res.error ?? 'Could not place building.');
        return;
      }
      setPlots(registry.getAllPlots());
      setSelectedPlot(res.plot);
      setConstructionDraft(INITIAL_DRAFT);
      setEditorFeedback(null);
      void adminSavePlotToFirestore(res.plot, currentUserUid).catch((err) => {
        console.error('Admin place building failed:', err);
        if (prevTarget) {
          registry.restorePlot(prevTarget);
          setPlots(registry.getAllPlots());
          setSelectedPlot((cur) => (cur?.id === prevTarget.id ? prevTarget : cur));
        }
        setAuthError('Could not save new building to Cloud Firestore.');
      });
    } else if (constructionDraft.mode === 'move' && constructionDraft.sourcePlotId) {
      const prevSrc = registry.getPlotById(constructionDraft.sourcePlotId);
      const prevDst = registry.getPlotById(constructionDraft.targetPlotId);
      const res = registry.moveBuildingBetweenPlots(
        constructionDraft.sourcePlotId,
        constructionDraft.targetPlotId,
      );
      if (!res.ok || !res.dstPlot || !res.srcPlot) {
        setEditorFeedback(res.error ?? 'Could not relocate building.');
        return;
      }
      setPlots(registry.getAllPlots());
      setSelectedPlot(res.dstPlot);
      setConstructionDraft(INITIAL_DRAFT);
      setEditorFeedback(null);
      void adminMovePlotsInFirestore(res.dstPlot, res.srcPlot, currentUserUid).catch((err) => {
        console.error('Admin move building failed:', err);
        if (prevSrc) registry.restorePlot(prevSrc);
        if (prevDst) registry.restorePlot(prevDst);
        setPlots(registry.getAllPlots());
        if (prevDst) {
          setSelectedPlot((cur) => (cur?.id === prevDst.id ? prevDst : cur));
        }
        setAuthError('Could not save relocated building to Cloud Firestore.');
      });
    }
  }, [userRole, currentUserUid, constructionDraft, registry]);

  const handleToggleMusic = useCallback(() => {
    const next = cozyMusicEngine.toggle();
    setMusicPlaying(next);
  }, []);

  const handleChangeMusicVolume = useCallback((v: number) => {
    cozyMusicEngine.setVolume(v);
    setMusicVolume(v);
  }, []);

  const handleToggleBirdAudio = useCallback(() => {
    const next = spatialBirdAudio.toggle();
    setBirdAudioEnabled(next);
  }, []);

  if (contextLost) {
    return (
      <div className="w-screen h-screen bg-[#11161d] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-semibold">3D Viewport Suspended</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          WebGL rendering context was interrupted by the browser. Reload to restore Lindenhof.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold cursor-pointer"
        >
          Restore Town
        </button>
      </div>
    );
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#c6dff2]">
      <Suspense
        fallback={
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#141920] text-slate-100">
            <div className="text-lg font-semibold tracking-tight">Lindenhof Town Simulator</div>
            <div className="text-xs text-slate-400 mt-1">Loading 6 districts &amp; simulation…</div>
          </div>
        }
      >
        <CityScene
          plots={plots}
          masterPlan={masterCityPlan}
          expansionWorld={expansionWorld}
          cameraMode={cameraMode}
          cinematicTour={cinematicTour}
          timeOfDay={timeOfDay}
          weather={weather}
          selectedPlotId={selectedPlot?.id ?? null}
          selectedExpansionPlotId={selectedExpansionPlot?.plotId ?? null}
          constructionDraft={constructionDraft}
          playerProfile={playerProfile}
          sittingBenchId={sittingBenchId}
          openDoors={openDoors}
          playerPoseRef={playerPoseRef}
          mobileInputRef={mobileInputRef}
          vehicleStatesRef={vehicleStatesRef}
          focusTargetRef={focusTargetRef}
          birdAudioEnabled={birdAudioEnabled}
          onSelectPlot={handleSelectPlot}
          onSelectExpansionPlot={handleSelectExpansionPlot}
          onOpenMonumentModal={() => setOgMonumentOpen(true)}
          onSelectBench={handleSelectBenchFromScene}
          onActiveInteractionChange={handleActiveInteractionChange}
          onTriggerPrimaryAction={handleTriggerPrimaryAction}
          onWebGLContextError={() => setContextLost(true)}
        />
      </Suspense>

      {reelsFrameEnabled && (
        <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div
            className="h-[92vh] border-2 border-amber-400/75 rounded-2xl shadow-[0_0_0_9999px_rgba(8,12,18,0.45)]"
            style={{ aspectRatio: '9 / 16' }}
          />
        </div>
      )}

      {cameraMode === 'walking' && !sittingBenchId && !uiHidden && (
        <MobileJoystick mobileInputRef={mobileInputRef} />
      )}

      <CityHUD
        plots={plots}
        stats={stats}
        cameraMode={cameraMode}
        cinematicTour={cinematicTour}
        timeOfDay={timeOfDay}
        weather={weather}
        userRole={userRole}
        isSignedIn={Boolean(currentUserUid)}
        authLoading={authLoading}
        authError={authError}
        adminRouteRequested={adminRouteRequested}
        adminPanelOpen={adminPanelOpen}
        adminPanelTab={adminPanelTab}
        focusedAdminPlotId={focusedAdminPlotId}
        currentUserUid={currentUserUid}
        adminEntries={adminEntries}
        residentRecords={residentRecords}
        townSettings={townSettings}
        welcomeOpen={welcomeOpen}
        selectedPlot={selectedPlot}
        selectedExpansionPlot={selectedExpansionPlot}
        masterPlan={masterCityPlan}
        expansionWorld={expansionWorld}
        followerDataset={followerDataset}
        expansionManifest={expansionManifest}
        firestoreVerifiedInfo={firestoreVerifiedInfo}
        openDoors={openDoors}
        cityMapOpen={cityMapOpen}
        ogMonumentOpen={ogMonumentOpen}
        constructionDraft={constructionDraft}
        editorFeedback={editorFeedback}
        adminActionNotice={adminActionNotice}
        musicPlaying={musicPlaying}
        musicVolume={musicVolume}
        birdAudioEnabled={birdAudioEnabled}
        reelsFrameEnabled={reelsFrameEnabled}
        uiHidden={uiHidden}
        playerProfile={playerProfile}
        playerCoords={playerCoords}
        activeInteraction={activeInteraction}
        sittingBenchId={sittingBenchId}
        playerPanelOpen={playerPanelOpen}
        inspectedVehicle={inspectedVehicle}
        inspectedPark={inspectedPark}
        ownerSpotlightPlot={ownerSpotlightPlot}
        onTogglePlayerPanel={handleTogglePlayerPanel}
        onUpdateProfile={handleUpdateProfile}
        onTriggerInteraction={handleTriggerInteraction}
        onToggleDoor={(pid) => setOpenDoors((prev) => ({ ...prev, [pid]: !prev[pid] }))}
        onCloseVehicleInspector={() => setInspectedVehicle(null)}
        onCloseParkInspector={() => setInspectedPark(null)}
        onCloseOwnerSpotlight={() => setOwnerSpotlightPlot(null)}
        onChangeCameraMode={handleChangeCameraMode}
        onChangeCinematicTour={setCinematicTour}
        onChangeTimeOfDay={setTimeOfDay}
        onChangeWeather={setWeather}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onDismissAdminGate={handleDismissAdminGate}
        onDismissAuthError={() => setAuthError(null)}
        onOpenWelcome={() => setWelcomeOpen(true)}
        onCloseWelcome={() => setWelcomeOpen(false)}
        onToggleAdminPanel={handleToggleAdminPanel}
        onChangeAdminTab={setAdminPanelTab}
        onClearFocusedAdminPlot={() => setFocusedAdminPlotId(null)}
        onManagePlotOwnership={handleManagePlotOwnership}
        onApproveResident={handleApproveResident}
        onReassignResident={handleReassignResident}
        onRevokeResident={handleRevokeResident}
        onDemolishPlot={handleDemolishPlot}
        onSaveTownSettings={handleSaveTownSettings}
        onGrantAdmin={handleGrantAdmin}
        onRevokeAdmin={handleRevokeAdmin}
        onSeedTownDefaults={handleSeedTownDefaults}
        onSelectPlot={setSelectedPlot}
        onSelectExpansionPlot={handleSelectExpansionPlot}
        onToggleCityMap={(next) => setCityMapOpen((prev) => (typeof next === 'boolean' ? next : !prev))}
        onToggleOgMonument={(next) =>
          setOgMonumentOpen((prev) => (typeof next === 'boolean' ? next : !prev))
        }
        onFocusLocation={handleFocusLocation}
        onWalkToLocation={handleWalkToLocation}
        onImportBundledZip={handleImportBundledZip}
        onImportUploadedZip={handleImportUploadedZip}
        onVerifyExpansionInFirestore={handleVerifyExpansionInFirestore}
        onClaimBusinessPlot={handleClaimBusinessPlot}
        onUpgradePlot={handleUpgradePlot}
        onCollectDailyRevenue={handleCollectDailyRevenue}
        onUpdateConstructionDraft={handleUpdateDraft}
        onConfirmConstruction={handleConfirmConstruction}
        onToggleMusic={handleToggleMusic}
        onChangeMusicVolume={handleChangeMusicVolume}
        onToggleBirdAudio={handleToggleBirdAudio}
        onToggleReelsFrame={() => setReelsFrameEnabled((v) => !v)}
        onToggleHideUI={() => setUiHidden((v) => !v)}
        onUpdatePlanConfig={handleUpdatePlanConfig}
        onRegenerateBlock={handleRegenerateBlock}
        onExpandCityBlock={handleExpandCityBlock}
        onResetMasterPlan={handleResetMasterPlan}
      />
    </main>
  );
}
