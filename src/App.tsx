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
import { AdminPanelTab } from './city/ui/AdminPanel';
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
  DEFAULT_TOWN_SETTINGS,
  adminAssignResidentInFirestore,
  adminMovePlotsInFirestore,
  adminRevokeResidentInFirestore,
  adminSavePlotToFirestore,
  adminSaveTownSettingsToFirestore,
  adminSaveTreasuryToFirestore,
  resolveBackendUserRole,
  sanitizeInstagramUrl,
  signInWithGoogle,
  signOutUser,
  subscribeAdminResidentRecords,
  subscribeAuthState,
  subscribeTownEconomy,
  subscribeTownPlots,
  subscribeTownSettings,
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
};

export default function App() {
  const registry = useMemo(() => new CityRegistry(), []);
  const [plots, setPlots] = useState<TownPlot[]>(() => registry.getAllPlots());
  const [treasuryVersion, setTreasuryVersion] = useState(0);

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
  const [residentRecords, setResidentRecords] = useState<Record<string, PrivateResidentRecord>>(
    {},
  );
  const [adminActionNotice, setAdminActionNotice] = useState<string | null>(null);

  const [selectedPlot, setSelectedPlot] = useState<TownPlot | null>(null);
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

  const stats = useMemo(
    () => registry.getTownStats(TOTAL_TOWN_VEHICLE_COUNT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registry, plots, treasuryVersion],
  );

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

  // Subscribe to private resident records strictly when Super Admin is verified
  useEffect(() => {
    if (userRole !== 'super-admin') {
      setResidentRecords({});
      return;
    }
    const unsubRecords = subscribeAdminResidentRecords(
      (records) => setResidentRecords(records),
      (err) => {
        console.warn('Admin resident records listener:', err.message);
      },
    );
    return () => unsubRecords();
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

      if (actionId === 'toggle-door' && activeInteraction.plotId) {
        const pid = activeInteraction.plotId;
        setOpenDoors((prev) => ({ ...prev, [pid]: !prev[pid] }));
        return;
      }

      if (
        (actionId === 'view-house' || actionId === 'view-shop' || actionId === 'view-town-info') &&
        activeInteraction.plotId
      ) {
        const plot = plots.find((p) => p.id === activeInteraction.plotId) ?? null;
        if (plot) {
          setSelectedPlot(plot);
          setInspectedVehicle(null);
          setInspectedPark(null);
          setOwnerSpotlightPlot(null);
        }
        return;
      }

      if (actionId === 'view-owner' && activeInteraction.plotId) {
        const plot = plots.find((p) => p.id === activeInteraction.plotId) ?? null;
        if (plot) {
          setOwnerSpotlightPlot(plot);
          setSelectedPlot(null);
          setInspectedVehicle(null);
          setInspectedPark(null);
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
        } else {
          focusTargetRef.current = { x: 41.2, z: -6.5, zoom: 38 };
        }
      }
    },
    [activeInteraction, plots, sittingBenchId],
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
        setAdminActionNotice('Could not revoke ownership in Cloud Firestore.');
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

  const handleClaimBusinessPlot = useCallback(
    (plotId: string, username: string) => {
      if (userRole !== 'super-admin' || !currentUserUid) {
        setAuthError('Super Admin authorization required to assign business leases.');
        return;
      }
      const updated = registry.claimOrOpenBusiness(plotId, username);
      if (!updated) return;
      setPlots(registry.getAllPlots());
      setSelectedPlot(updated);
      void adminSavePlotToFirestore(updated, currentUserUid).catch((err) => {
        console.error('Admin business lease failed:', err);
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
      const updated = registry.upgradePlot(plotId);
      if (!updated) return;
      setPlots(registry.getAllPlots());
      setSelectedPlot(updated);
      void adminSavePlotToFirestore(updated, currentUserUid).catch((err) => {
        console.error('Admin plot upgrade failed:', err);
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
    const nextBalance = registry.collectDailyBusinessRevenue();
    setTreasuryVersion((v) => v + 1);
    void adminSaveTreasuryToFirestore(nextBalance, currentUserUid).catch((err) => {
      console.error('Treasury save failed:', err);
      setAuthError('Could not persist treasury balance to Cloud Firestore.');
    });
  }, [registry, userRole, currentUserUid]);

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
        setAuthError('Could not save new building to Cloud Firestore.');
      });
    } else if (constructionDraft.mode === 'move' && constructionDraft.sourcePlotId) {
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
          cameraMode={cameraMode}
          cinematicTour={cinematicTour}
          timeOfDay={timeOfDay}
          weather={weather}
          selectedPlotId={selectedPlot?.id ?? null}
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
        residentRecords={residentRecords}
        townSettings={townSettings}
        welcomeOpen={welcomeOpen}
        selectedPlot={selectedPlot}
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
        onApproveResident={handleApproveResident}
        onReassignResident={handleReassignResident}
        onRevokeResident={handleRevokeResident}
        onSaveTownSettings={handleSaveTownSettings}
        onSelectPlot={setSelectedPlot}
        onFocusLocation={handleFocusLocation}
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
      />
    </main>
  );
}
