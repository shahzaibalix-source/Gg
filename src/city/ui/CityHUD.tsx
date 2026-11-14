import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  Bird,
  Building2,
  Car,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudFog,
  CloudRain,
  Coins,
  Compass,
  Crown,
  DoorOpen,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  Footprints,
  Globe,
  Hammer,
  Home,
  Info,
  LogIn,
  LogOut,
  Map as MapIcon,
  MapPin,
  Moon,
  Move,
  Music,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  Trees,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  CameraMode,
  CinematicTourId,
  ConstructionDraft,
  HouseArchetype,
  InteractionActionId,
  NearbyInteractable,
  PlayerProfile,
  PrivateResidentRecord,
  TimeOfDay,
  TownFinancialStats,
  TownPlot,
  TownPublicSettings,
  UserRole,
  WeatherMode,
} from '../types';
import { ARCHETYPE_LABELS, BUSINESS_LABELS } from '../registry/CityRegistry';
import { DISTRICTS } from '../world/MasterTownBlueprint';
import { townMultiplayerService, townVerificationService } from '../services/TownServices';
import { AdminRosterEntry, sanitizeInstagramUrl } from '../firebase/firebaseClient';
import { PlayerPanel } from './PlayerPanel';
import {
  AdminPanel,
  AdminPanelTab,
  FirestoreExpansionVerificationState,
} from './AdminPanel';
import { FullCityMapModal } from './FullCityMapModal';
import { OGMonumentModal } from './OGMonumentModal';
import type { ExpansionCityWorld } from '../expansion/ExpansionMasterPlan';
import type {
  ExpansionManifest,
  ExpansionPlotSpec,
  ParsedFollowerDataset,
} from '../expansion/types';

export interface InspectedVehicleInfo {
  id: string;
  title: string;
  style: string;
  color: string;
  status: string;
  speedKmh: number;
}

export interface InspectedParkInfo {
  title: string;
  subtitle: string;
  highlights: string[];
}

interface CityHUDProps {
  plots: TownPlot[];
  stats: TownFinancialStats;
  cameraMode: CameraMode;
  cinematicTour: CinematicTourId;
  timeOfDay: TimeOfDay;
  weather: WeatherMode;
  userRole: UserRole;
  isSignedIn: boolean;
  authLoading: boolean;
  authError: string | null;
  adminRouteRequested: boolean;
  adminPanelOpen: boolean;
  adminPanelTab: AdminPanelTab;
  focusedAdminPlotId: string | null;
  currentUserUid: string | null;
  adminEntries: AdminRosterEntry[];
  residentRecords: Record<string, PrivateResidentRecord>;
  townSettings: TownPublicSettings;
  welcomeOpen: boolean;
  selectedPlot: TownPlot | null;
  selectedExpansionPlot?: ExpansionPlotSpec | null;
  expansionWorld?: ExpansionCityWorld | null;
  followerDataset?: ParsedFollowerDataset | null;
  expansionManifest?: ExpansionManifest | null;
  firestoreVerifiedInfo?: FirestoreExpansionVerificationState | null;
  openDoors?: Record<string, boolean>;
  cityMapOpen?: boolean;
  ogMonumentOpen?: boolean;
  constructionDraft: ConstructionDraft;
  editorFeedback: string | null;
  adminActionNotice: string | null;
  musicPlaying: boolean;
  musicVolume: number;
  birdAudioEnabled: boolean;
  reelsFrameEnabled: boolean;
  uiHidden: boolean;
  playerProfile: PlayerProfile;
  playerCoords: { x: number; z: number };
  activeInteraction: NearbyInteractable | null;
  sittingBenchId: string | null;
  playerPanelOpen: boolean;
  inspectedVehicle: InspectedVehicleInfo | null;
  inspectedPark: InspectedParkInfo | null;
  ownerSpotlightPlot: TownPlot | null;
  onTogglePlayerPanel: () => void;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onTriggerInteraction: (actionId: InteractionActionId) => void;
  onToggleDoor?: (plotId: string) => void;
  onCloseVehicleInspector: () => void;
  onCloseParkInspector: () => void;
  onCloseOwnerSpotlight: () => void;
  onChangeCameraMode: (mode: CameraMode) => void;
  onChangeCinematicTour: (tour: CinematicTourId) => void;
  onChangeTimeOfDay: (time: TimeOfDay) => void;
  onChangeWeather: (weather: WeatherMode) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onDismissAdminGate: () => void;
  onDismissAuthError: () => void;
  onOpenWelcome: () => void;
  onCloseWelcome: () => void;
  onToggleAdminPanel: (tab?: AdminPanelTab) => void;
  onChangeAdminTab: (tab: AdminPanelTab) => void;
  onClearFocusedAdminPlot: () => void;
  onManagePlotOwnership: (plotId: string) => void;
  onApproveResident: (params: {
    plotId: string;
    inGameUsername: string;
    instagramHandle: string;
    notes: string;
    archetype: HouseArchetype;
  }) => Promise<boolean>;
  onReassignResident: (params: {
    plotId: string;
    inGameUsername: string;
    instagramHandle: string;
    notes: string;
  }) => Promise<boolean>;
  onRevokeResident: (plotId: string) => Promise<boolean>;
  onDemolishPlot: (plotId: string) => Promise<boolean>;
  onSaveTownSettings: (settings: TownPublicSettings) => Promise<boolean>;
  onGrantAdmin: (targetUid: string) => Promise<boolean>;
  onRevokeAdmin: (targetUid: string) => Promise<boolean>;
  onSeedTownDefaults: () => Promise<boolean>;
  onSelectPlot: (plot: TownPlot | null) => void;
  onSelectExpansionPlot?: (plot: ExpansionPlotSpec | null) => void;
  onToggleCityMap?: (open?: boolean) => void;
  onToggleOgMonument?: (open?: boolean) => void;
  onFocusLocation: (x: number, z: number, zoom?: number) => void;
  onWalkToLocation?: (
    x: number,
    z: number,
    expansionPlot?: ExpansionPlotSpec,
    corePlot?: TownPlot,
  ) => void;
  onImportBundledZip?: (onProgress: (msg: string) => void) => Promise<boolean>;
  onImportUploadedZip?: (file: File, onProgress: (msg: string) => void) => Promise<boolean>;
  onVerifyExpansionInFirestore?: () => Promise<void>;
  onClaimBusinessPlot: (plotId: string, username: string) => void;
  onUpgradePlot: (plotId: string) => void;
  onCollectDailyRevenue: () => void;
  onUpdateConstructionDraft: (patch: Partial<ConstructionDraft>) => void;
  onConfirmConstruction: () => void;
  onToggleMusic: () => void;
  onChangeMusicVolume: (v: number) => void;
  onToggleBirdAudio: () => void;
  onToggleReelsFrame: () => void;
  onToggleHideUI: () => void;
}

const TOUR_LABELS: Array<{ id: CinematicTourId; label: string }> = [
  { id: 'town-hall-reveal', label: 'Town Hall Reveal' },
  { id: 'residential-flyover', label: 'Residential Neighbourhood' },
  { id: 'luxury-flyover', label: 'Luxury Villas' },
  { id: 'commercial-park-tour', label: 'Market & Park' },
  { id: 'full-town-loop', label: 'Full Town Flyover' },
];

const WEATHER_ORDER: WeatherMode[] = ['sunny', 'cloudy', 'rainy', 'foggy'];
const WEATHER_META: Record<WeatherMode, { label: string; Icon: typeof Sun }> = {
  sunny: { label: 'Clear', Icon: Sun },
  cloudy: { label: 'Cloud', Icon: Cloud },
  rainy: { label: 'Rain', Icon: CloudRain },
  foggy: { label: 'Fog', Icon: CloudFog },
};

export const CityHUD: React.FC<CityHUDProps> = ({
  plots,
  stats,
  cameraMode,
  cinematicTour,
  timeOfDay,
  weather,
  userRole,
  isSignedIn,
  authLoading,
  authError,
  adminRouteRequested,
  adminPanelOpen,
  adminPanelTab,
  focusedAdminPlotId,
  currentUserUid,
  adminEntries,
  residentRecords,
  townSettings,
  welcomeOpen,
  selectedPlot,
  selectedExpansionPlot,
  expansionWorld,
  followerDataset,
  expansionManifest,
  firestoreVerifiedInfo,
  openDoors,
  cityMapOpen = false,
  ogMonumentOpen = false,
  constructionDraft,
  editorFeedback,
  adminActionNotice,
  musicPlaying,
  musicVolume,
  birdAudioEnabled,
  reelsFrameEnabled,
  uiHidden,
  playerProfile,
  playerCoords,
  activeInteraction,
  sittingBenchId,
  playerPanelOpen,
  inspectedVehicle,
  inspectedPark,
  ownerSpotlightPlot,
  onTogglePlayerPanel,
  onUpdateProfile,
  onTriggerInteraction,
  onToggleDoor,
  onCloseVehicleInspector,
  onCloseParkInspector,
  onCloseOwnerSpotlight,
  onChangeCameraMode,
  onChangeCinematicTour,
  onChangeTimeOfDay,
  onChangeWeather,
  onSignIn,
  onSignOut,
  onDismissAdminGate,
  onDismissAuthError,
  onOpenWelcome,
  onCloseWelcome,
  onToggleAdminPanel,
  onChangeAdminTab,
  onClearFocusedAdminPlot,
  onManagePlotOwnership,
  onApproveResident,
  onReassignResident,
  onRevokeResident,
  onDemolishPlot,
  onSaveTownSettings,
  onGrantAdmin,
  onRevokeAdmin,
  onSeedTownDefaults,
  onSelectPlot,
  onSelectExpansionPlot,
  onToggleCityMap,
  onToggleOgMonument,
  onFocusLocation,
  onWalkToLocation,
  onImportBundledZip,
  onImportUploadedZip,
  onVerifyExpansionInFirestore,
  onClaimBusinessPlot,
  onUpgradePlot,
  onCollectDailyRevenue,
  onUpdateConstructionDraft,
  onConfirmConstruction,
  onToggleMusic,
  onChangeMusicVolume,
  onToggleBirdAudio,
  onToggleReelsFrame,
  onToggleHideUI,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'districts' | 'stats' | 'services'>(
    'none',
  );
  const [bizOwnerInput, setBizOwnerInput] = useState('');
  const [confirmInspectorDemolishId, setConfirmInspectorDemolishId] = useState<string | null>(null);

  if (uiHidden) {
    return (
      <div className="fixed top-2 right-2 z-30">
        <button
          type="button"
          onClick={onToggleHideUI}
          className="h-7 px-2.5 rounded-lg bg-[#10151c]/88 border border-white/14 text-[11px] font-medium text-slate-100 hover:bg-[#1a222d] cursor-pointer"
        >
          Show UI
        </button>
      </div>
    );
  }

  const isSuperAdmin = userRole === 'super-admin';
  const safeInstagramUrl = sanitizeInstagramUrl(townSettings.instagramUrl);
  const canUpgradeSelectedPlot = Boolean(
    isSuperAdmin &&
      selectedPlot &&
      selectedPlot.upgradeLevel < 3 &&
      (selectedPlot.house || selectedPlot.business),
  );
  const isSelectedResidentialOpen = Boolean(
    selectedPlot &&
      !selectedPlot.ownerUsername &&
      !selectedPlot.business &&
      !selectedPlot.publicBuilding &&
      (selectedPlot.category === 'residential' ||
        selectedPlot.category === 'luxury-residential' ||
        selectedPlot.category === 'expansion-residential'),
  );

  const cycleWeather = () => {
    const idx = WEATHER_ORDER.indexOf(weather);
    onChangeWeather(WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length]);
  };
  const ActiveWeatherIcon = WEATHER_META[weather].Icon;

  return (
    <>
      {/* Minimal Top Bar — Guaranteed Single Row Inside Mobile Preview */}
      <header className="fixed top-2 inset-x-2 z-20 flex items-center justify-between gap-1.5 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#10151c]/90 border border-white/12 shadow-md min-w-0">
          <h1 className="text-xs sm:text-sm font-semibold tracking-tight text-white truncate">
            Lindenhof
          </h1>
          <span className="hidden sm:inline text-[11px] text-slate-300 font-mono-tabular whitespace-nowrap">
            <span aria-hidden="true">·</span> {stats.totalPopulation.toLocaleString()} pop{' '}
            <span aria-hidden="true">·</span> €{stats.townTreasury.toLocaleString()}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 shrink-0">
          {onToggleCityMap && expansionWorld && (
            <button
              type="button"
              onClick={() => onToggleCityMap(true)}
              title="Complete City Map & House Finder"
              className={`h-7 sm:h-8 flex items-center gap-1 px-1.5 sm:px-2 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
                cityMapOpen
                  ? 'bg-sky-500 text-slate-950 border-sky-300'
                  : 'bg-[#10151c]/90 text-sky-200 border-sky-400/35 hover:bg-[#1c2430]'
              }`}
            >
              <MapIcon className="w-3 h-3" />
              <span className="hidden sm:inline">City Map</span>
              <span className="sm:hidden">Map</span>
            </button>
          )}

          {onToggleOgMonument && expansionWorld && (
            <button
              type="button"
              onClick={() => onToggleOgMonument(true)}
              title="50 OG Founders Recognition Monument"
              className={`h-7 sm:h-8 flex items-center gap-1 px-1.5 sm:px-2 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
                ogMonumentOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : 'bg-[#10151c]/90 text-amber-200 border-amber-400/35 hover:bg-[#1c2430]'
              }`}
            >
              <Award className="w-3 h-3" />
              <span className="hidden md:inline">OG 50</span>
            </button>
          )}

          <button
            type="button"
            onClick={onTogglePlayerPanel}
            className={`h-7 sm:h-8 flex items-center gap-1 px-2 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
              playerPanelOpen
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-[#10151c]/90 text-slate-100 border-white/14 hover:bg-[#1c2430]'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>Explore</span>
          </button>

          <button
            type="button"
            onClick={onOpenWelcome}
            className="h-7 sm:h-8 flex items-center gap-1 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
          >
            <Home className="w-3 h-3" />
            <span className="sm:hidden">House</span>
            <span className="hidden sm:inline">Get a House</span>
          </button>

          {isSuperAdmin && (
            <>
              <button
                type="button"
                onClick={() => onToggleAdminPanel()}
                title="Admin Panel"
                className={`h-7 sm:h-8 flex items-center gap-1 px-2 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
                  adminPanelOpen
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                    : 'bg-[#10151c]/90 text-amber-300 border-amber-400/35 hover:bg-[#1c2430]'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                <span className="hidden sm:inline">Admin</span>
              </button>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out of Super Admin"
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-[#10151c]/90 hover:bg-[#1c2430] border border-white/12 text-slate-200 cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onToggleHideUI}
            title="Hide UI"
            aria-label="Hide UI"
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-[#10151c]/90 hover:bg-[#1c2430] border border-white/12 text-slate-300 hover:text-white cursor-pointer"
          >
            <EyeOff className="w-3 h-3" />
          </button>
        </div>
      </header>

      {authError && (
        <div
          role="alert"
          className="fixed top-11 inset-x-2 sm:inset-x-auto sm:left-3 sm:max-w-sm z-30 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#2a1518]/95 border border-rose-400/45 text-[11px] text-rose-100 shadow-lg"
        >
          <span className="truncate">{authError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={onDismissAuthError}
            className="p-1 rounded text-rose-200 hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Welcome Screen Overlay with Prominent "GET A HOUSE" Button */}
      {welcomeOpen && !adminRouteRequested && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-town-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#090d14]/60 p-3"
        >
          <div className="w-full max-w-md max-h-[86vh] overflow-y-auto rounded-xl bg-[#10151c]/96 border border-white/15 p-4 sm:p-5 shadow-2xl text-slate-100">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-amber-300">
                  Community 3D Town · Open Access
                </p>
                <h2
                  id="welcome-town-title"
                  className="text-lg sm:text-xl font-semibold text-white mt-0.5 text-balance"
                >
                  {townSettings.welcomeTitle}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close welcome screen"
                onClick={onCloseWelcome}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              {townSettings.welcomeSubtitle}
            </p>

            <div className="mt-4 p-3.5 rounded-xl bg-[#18202a] border border-amber-400/25 space-y-2.5">
              <a
                href={safeInstagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold tracking-wide transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>GET A HOUSE</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                {townSettings.instagramInstruction}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 font-mono-tabular">
                {stats.availablePlots} open plots <span aria-hidden="true">·</span>{' '}
                {stats.occupiedPlots} active
              </span>
              <button
                type="button"
                onClick={onCloseWelcome}
                className="h-9 px-3.5 rounded-lg bg-[#1e2734] hover:bg-[#273344] border border-white/15 text-xs font-semibold text-white cursor-pointer"
              >
                Explore Town
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin-Only Route Gate (/admin or #/admin) */}
      {adminRouteRequested && !isSuperAdmin && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="admin-gate-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#090c11]/75 p-3"
        >
          <div className="w-full max-w-sm rounded-xl bg-[#10151c] border border-white/15 p-4 sm:p-5 shadow-2xl text-slate-100">
            {authLoading ? (
              <p className="text-xs sm:text-sm text-slate-300">
                Verifying administrator authorization…
              </p>
            ) : !isSignedIn ? (
              <>
                <div className="flex items-center gap-2 text-amber-300">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <h2 id="admin-gate-title" className="text-sm sm:text-base font-semibold text-white">
                    Administrator Sign In
                  </h2>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  Public visitors do not need an account. Only an authorized Super Admin may sign in
                  to manage residents and town settings.
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={onDismissAdminGate}
                    className="h-9 px-3 rounded-lg bg-[#1a222d] hover:bg-[#243040] border border-white/15 text-xs font-semibold text-white cursor-pointer"
                  >
                    Return to Town
                  </button>
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In with Google</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-rose-300">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <h2 id="admin-gate-title" className="text-sm sm:text-base font-semibold text-white">
                    Admin Access Denied
                  </h2>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  This Google account does not have Super Admin authorization on the backend.
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-semibold text-rose-100 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDismissAdminGate}
                    className="h-9 px-3 rounded-lg bg-[#1a222d] hover:bg-[#243040] border border-white/15 text-xs font-semibold text-white cursor-pointer"
                  >
                    Return to Town
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Login-Free Visitor Explorer Panel */}
      <PlayerPanel
        open={playerPanelOpen}
        cameraMode={cameraMode}
        plots={plots}
        expansionWorld={expansionWorld}
        playerProfile={playerProfile}
        playerCoords={playerCoords}
        activeInteraction={activeInteraction}
        sittingBenchId={sittingBenchId}
        townSettings={townSettings}
        onClose={onTogglePlayerPanel}
        onChangeCameraMode={onChangeCameraMode}
        onFocusLocation={onFocusLocation}
        onSelectPlot={onSelectPlot}
        onSelectExpansionPlot={onSelectExpansionPlot}
        onOpenCityMap={onToggleCityMap ? () => onToggleCityMap(true) : undefined}
        onOpenMonumentModal={onToggleOgMonument ? () => onToggleOgMonument(true) : undefined}
        onUpdateProfile={onUpdateProfile}
        onTriggerInteraction={onTriggerInteraction}
      />

      {/* Super Admin Panel (Strictly Backend-Verified) */}
      {isSuperAdmin && (
        <AdminPanel
          open={adminPanelOpen}
          activeTab={adminPanelTab}
          plots={plots}
          selectedPlot={selectedPlot}
          focusedPlotId={focusedAdminPlotId}
          currentUserUid={currentUserUid}
          adminEntries={adminEntries}
          residentRecords={residentRecords}
          townSettings={townSettings}
          constructionDraft={constructionDraft}
          editorFeedback={editorFeedback}
          adminActionNotice={adminActionNotice}
          followerDataset={followerDataset}
          expansionWorld={expansionWorld}
          expansionManifest={expansionManifest}
          firestoreVerifiedInfo={firestoreVerifiedInfo}
          onChangeTab={onChangeAdminTab}
          onClose={() => onToggleAdminPanel()}
          onClearFocusedPlot={onClearFocusedAdminPlot}
          onFocusLocation={onFocusLocation}
          onSelectPlot={onSelectPlot}
          onApproveResident={onApproveResident}
          onReassignResident={onReassignResident}
          onRevokeResident={onRevokeResident}
          onDemolishPlot={onDemolishPlot}
          onSaveTownSettings={onSaveTownSettings}
          onGrantAdmin={onGrantAdmin}
          onRevokeAdmin={onRevokeAdmin}
          onSeedTownDefaults={onSeedTownDefaults}
          onUpdateConstructionDraft={onUpdateConstructionDraft}
          onConfirmConstruction={onConfirmConstruction}
          onImportBundledZip={onImportBundledZip}
          onImportUploadedZip={onImportUploadedZip}
          onVerifyExpansionInFirestore={onVerifyExpansionInFirestore}
        />
      )}

      {/* Responsive Inspector Stack — Cleanly Below Top Bar on Mobile & Top-Right on Desktop */}
      {(selectedPlot ||
        selectedExpansionPlot ||
        inspectedVehicle ||
        inspectedPark ||
        ownerSpotlightPlot) && (
        <div className="fixed top-11 inset-x-2 sm:inset-x-auto sm:right-3 sm:w-80 z-25 flex flex-col gap-2 items-stretch sm:items-end max-h-[54vh] overflow-y-auto pointer-events-none">
          {selectedExpansionPlot && (
            <aside className="pointer-events-auto w-full rounded-xl bg-[#10151c]/95 border border-amber-400/35 p-3 shadow-2xl text-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-amber-300 font-mono-tabular">
                      {selectedExpansionPlot.plotCode}
                    </span>
                    {selectedExpansionPlot.resident && (
                      <span className="text-[10px] text-slate-400 font-mono-tabular">
                        · {selectedExpansionPlot.resident.residentId}
                      </span>
                    )}
                    {selectedExpansionPlot.status === 'vip' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-bold uppercase tracking-wider">
                        ★ VIP #1
                      </span>
                    )}
                    {selectedExpansionPlot.status === 'og' && selectedExpansionPlot.resident && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[9px] font-semibold">
                        OG #{selectedExpansionPlot.resident.ogRank}
                      </span>
                    )}
                    {selectedExpansionPlot.status === 'occupied' && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/35 text-emerald-200 text-[9px] font-semibold">
                        Resident
                      </span>
                    )}
                    {selectedExpansionPlot.status === 'expansion-open' && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/35 text-sky-200 text-[9px] font-semibold">
                        Open Survey
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-semibold text-white mt-0.5 truncate flex items-center gap-1.5">
                    {selectedExpansionPlot.status === 'vip' && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="truncate">
                      {selectedExpansionPlot.resident
                        ? `@${selectedExpansionPlot.resident.username}`
                        : 'Future Expansion Plot'}
                    </span>
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close expansion house inspector"
                  onClick={() => onSelectExpansionPlot?.(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-slate-300 space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">District</span>
                  <span className="text-slate-100 font-medium truncate">
                    {selectedExpansionPlot.districtName}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Address</span>
                  <span className="text-slate-200 truncate">{selectedExpansionPlot.address}</span>
                </div>
                {selectedExpansionPlot.resident && (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Followed</span>
                      <span className="font-mono-tabular text-amber-200 truncate">
                        {selectedExpansionPlot.resident.joinedAt || 'Verified archive'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Chronological Rank</span>
                      <span className="font-mono-tabular text-emerald-300">
                        #{selectedExpansionPlot.resident.oldestRank.toLocaleString()} oldest
                      </span>
                    </div>
                  </>
                )}
                {selectedExpansionPlot.houseStyle && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Architecture</span>
                    <span className="text-sky-200 truncate">
                      {ARCHETYPE_LABELS[selectedExpansionPlot.houseStyle.archetype]} ·{' '}
                      {selectedExpansionPlot.houseStyle.floors}F
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onFocusLocation(selectedExpansionPlot.x, selectedExpansionPlot.z, 36)
                  }
                  className="flex-1 min-h-[32px] flex items-center justify-center gap-1 px-2 rounded-md bg-[#1c2430] hover:bg-[#263142] border border-white/12 text-[11px] font-medium text-white cursor-pointer"
                >
                  <Navigation className="w-3 h-3 text-sky-300" />
                  <span>Fly</span>
                </button>
                {onWalkToLocation && (
                  <button
                    type="button"
                    onClick={() =>
                      onWalkToLocation(
                        selectedExpansionPlot.x,
                        selectedExpansionPlot.z,
                        selectedExpansionPlot,
                      )
                    }
                    className="flex-1 min-h-[32px] flex items-center justify-center gap-1 px-2 rounded-md bg-amber-500 hover:bg-amber-400 text-[11px] font-semibold text-slate-950 cursor-pointer"
                  >
                    <Footprints className="w-3 h-3" />
                    <span>Walk Here</span>
                  </button>
                )}
                {(selectedExpansionPlot.houseStyle || selectedExpansionPlot.status === 'vip') &&
                  onToggleDoor && (
                    <button
                      type="button"
                      onClick={() => onToggleDoor(selectedExpansionPlot.plotId)}
                      className="min-h-[32px] flex items-center justify-center gap-1 px-2 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-[11px] font-medium text-emerald-200 cursor-pointer"
                    >
                      <DoorOpen className="w-3 h-3" />
                      <span>
                        {openDoors?.[selectedExpansionPlot.plotId] ? 'Close Door' : 'Open Door'}
                      </span>
                    </button>
                  )}
                {(selectedExpansionPlot.status === 'vip' || selectedExpansionPlot.status === 'og') &&
                  onToggleOgMonument && (
                    <button
                      type="button"
                      onClick={() => onToggleOgMonument(true)}
                      className="w-full min-h-[30px] flex items-center justify-center gap-1 px-2 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-[11px] font-medium text-amber-200 cursor-pointer"
                    >
                      <Award className="w-3 h-3" />
                      <span>Open OG 50 Monument</span>
                    </button>
                  )}
              </div>
            </aside>
          )}
          {selectedPlot && (
            <aside className="pointer-events-auto w-full rounded-xl bg-[#10151c]/94 border border-white/14 p-3 shadow-2xl text-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-amber-300 font-mono-tabular truncate">
                    {selectedPlot.plotCode} <span aria-hidden="true">·</span> {selectedPlot.address}
                  </div>
                  <h2 className="text-sm font-semibold text-white mt-0.5 truncate">
                    {selectedPlot.publicBuilding
                      ? selectedPlot.publicBuilding.name
                      : selectedPlot.business
                        ? selectedPlot.business.name
                        : selectedPlot.ownerUsername
                          ? selectedPlot.ownerUsername
                          : selectedPlot.house
                            ? 'Available House'
                            : 'Available Town Plot'}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close inspector"
                  onClick={() => onSelectPlot(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-slate-300 space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Type</span>
                  <span className="text-slate-100 font-medium capitalize truncate">
                    {selectedPlot.category.replace('-', ' ')}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Parcel</span>
                  <span className="font-mono-tabular text-slate-100">
                    {selectedPlot.width.toFixed(0)}m × {selectedPlot.depth.toFixed(0)}m
                  </span>
                </div>
                {selectedPlot.house && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Style &amp; Tier</span>
                    <span className="text-amber-300 truncate">
                      {ARCHETYPE_LABELS[selectedPlot.house.archetype]} · Lv{' '}
                      {selectedPlot.upgradeLevel}/3
                    </span>
                  </div>
                )}
                {selectedPlot.business && (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Business</span>
                      <span className="text-slate-100 truncate">
                        {BUSINESS_LABELS[selectedPlot.business.category]}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Income</span>
                      <span className="font-mono-tabular text-emerald-300">
                        {selectedPlot.business.status.toUpperCase()} · €
                        {selectedPlot.business.dailyRevenue}/d
                      </span>
                    </div>
                  </>
                )}
                {selectedPlot.publicBuilding && (
                  <p className="text-slate-300 leading-snug pt-0.5">
                    {selectedPlot.publicBuilding.description}
                  </p>
                )}
              </div>

              {selectedPlot.ownerUsername && !selectedPlot.publicBuilding && (
                <div className="mt-2 p-2 rounded-lg bg-[#19202a] border border-white/10 text-[11px] text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Resident: {selectedPlot.ownerUsername}</span>
                </div>
              )}

              {isSelectedResidentialOpen && !isSuperAdmin && (
                <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5">
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {townSettings.instagramInstruction}
                  </p>
                  <a
                    href={safeInstagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-semibold"
                  >
                    <span>GET A HOUSE</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {isSuperAdmin && (
                <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {canUpgradeSelectedPlot && (
                      <button
                        type="button"
                        onClick={() => onUpgradePlot(selectedPlot.id)}
                        className="flex-1 h-7 px-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-semibold cursor-pointer"
                      >
                        Upgrade Lv {selectedPlot.upgradeLevel + 1}
                      </button>
                    )}
                    {(selectedPlot.house || selectedPlot.business) && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleAdminPanel('builder');
                          onUpdateConstructionDraft({
                            mode: 'move',
                            sourcePlotId: selectedPlot.id,
                            targetPlotId: null,
                          });
                        }}
                        className="h-7 flex items-center gap-1 px-2 rounded-md bg-[#1a222d] hover:bg-[#232d3c] border border-white/15 text-[11px] text-slate-100 cursor-pointer"
                      >
                        <Move className="w-3 h-3" />
                        <span>Move</span>
                      </button>
                    )}
                    {(selectedPlot.house || selectedPlot.business) &&
                      !selectedPlot.publicBuilding &&
                      selectedPlot.category !== 'public' &&
                      (confirmInspectorDemolishId === selectedPlot.id ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await onDemolishPlot(selectedPlot.id);
                            setConfirmInspectorDemolishId(null);
                          }}
                          className="h-7 px-2 rounded-md bg-rose-500 hover:bg-rose-400 text-slate-950 text-[11px] font-semibold cursor-pointer"
                        >
                          Confirm Demolish
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmInspectorDemolishId(selectedPlot.id)}
                          className="h-7 flex items-center gap-1 px-2 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-[11px] text-rose-200 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Demolish</span>
                        </button>
                      ))}
                  </div>

                  {!selectedPlot.publicBuilding && !selectedPlot.business && (
                    <button
                      type="button"
                      onClick={() => onManagePlotOwnership(selectedPlot.id)}
                      className="w-full h-7 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-semibold cursor-pointer"
                    >
                      Manage Ownership
                    </button>
                  )}

                  {selectedPlot.business && selectedPlot.business.status === 'available' && (
                    <form
                      className="flex gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!bizOwnerInput.trim()) return;
                        onClaimBusinessPlot(selectedPlot.id, bizOwnerInput);
                        setBizOwnerInput('');
                      }}
                    >
                      <input
                        type="text"
                        maxLength={32}
                        value={bizOwnerInput}
                        onChange={(e) => setBizOwnerInput(e.target.value)}
                        placeholder="Owner @handle"
                        className="min-w-0 flex-1 h-7 px-2 text-[11px] rounded-md bg-[#1a2029] border border-white/15 text-white placeholder:text-slate-500"
                      />
                      <button
                        type="submit"
                        disabled={!bizOwnerInput.trim()}
                        className="h-7 px-2.5 rounded-md bg-sky-500 hover:bg-sky-400 disabled:opacity-45 text-slate-950 text-[11px] font-semibold cursor-pointer"
                      >
                        Lease
                      </button>
                    </form>
                  )}
                </div>
              )}
            </aside>
          )}

          {inspectedVehicle && (
            <aside className="pointer-events-auto w-full rounded-xl bg-[#10151c]/95 border border-sky-400/35 p-3 shadow-2xl text-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Car className="w-4 h-4 text-sky-400 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-semibold text-white truncate">
                    {inspectedVehicle.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onCloseVehicleInspector}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Style</span>
                  <span className="text-white capitalize">{inspectedVehicle.style}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="text-emerald-300">{inspectedVehicle.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Speed</span>
                  <span className="font-mono-tabular text-white">{inspectedVehicle.speedKmh} km/h</span>
                </div>
              </div>
            </aside>
          )}

          {inspectedPark && (
            <aside className="pointer-events-auto w-full rounded-xl bg-[#10151c]/95 border border-emerald-400/35 p-3 shadow-2xl text-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Trees className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-semibold text-white truncate">
                    {inspectedPark.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onCloseParkInspector}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-300 leading-snug">{inspectedPark.subtitle}</p>
              <ul className="mt-2 pt-2 border-t border-white/10 space-y-0.5 text-[11px] text-slate-300">
                {inspectedPark.highlights.map((h) => (
                  <li key={h}>· {h}</li>
                ))}
              </ul>
            </aside>
          )}

          {ownerSpotlightPlot && (
            <aside className="pointer-events-auto w-full rounded-xl bg-[#10151c]/95 border border-amber-400/35 p-3 shadow-2xl text-slate-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-4 h-4 text-amber-400 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-semibold text-white truncate">
                    Resident Spotlight
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onCloseOwnerSpotlight}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Resident</span>
                  <span className="text-white font-semibold">
                    {ownerSpotlightPlot.ownerUsername ?? 'Available House'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Address</span>
                  <span className="text-slate-200">{ownerSpotlightPlot.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Plot</span>
                  <span className="font-mono-tabular text-amber-300">
                    {ownerSpotlightPlot.plotCode} · Lv {ownerSpotlightPlot.upgradeLevel}/3
                  </span>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Districts Directory Modal */}
      {activeModal === 'districts' && (
        <div className="fixed bottom-24 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-30 sm:w-[580px] max-h-[58vh] flex flex-col rounded-xl bg-[#10151c]/96 border border-white/15 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10">
            <h2 className="text-xs sm:text-sm font-semibold text-white">Districts &amp; Directory</h2>
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-2.5 overflow-y-auto space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DISTRICTS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    onFocusLocation(d.center.x, d.center.z, 65);
                    setActiveModal('none');
                  }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#19212b] hover:bg-[#222c3a] border border-white/10 text-left cursor-pointer"
                >
                  <Trees className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{d.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{d.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>

            <div>
              <h3 className="text-[11px] font-semibold text-slate-400 mb-1.5">
                All Landmarks &amp; Plots ({plots.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {plots.map((plot) => (
                  <button
                    key={plot.id}
                    type="button"
                    onClick={() => {
                      onFocusLocation(plot.center.x, plot.center.z, 36);
                      onSelectPlot(plot);
                      setActiveModal('none');
                    }}
                    className="flex items-center gap-2 p-2 rounded-lg bg-[#161c24] hover:bg-[#1f2833] border border-white/10 text-left cursor-pointer"
                  >
                    {plot.business ? (
                      <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    ) : plot.publicBuilding ? (
                      <Compass className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    ) : (
                      <Home
                        className={`w-3.5 h-3.5 shrink-0 ${
                          plot.ownerUsername ? 'text-amber-300' : 'text-emerald-400'
                        }`}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {plot.plotCode} ·{' '}
                        {plot.publicBuilding?.name ??
                          plot.business?.name ??
                          plot.ownerUsername ??
                          'Open Plot'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{plot.address}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Town Statistics Modal */}
      {activeModal === 'stats' && (
        <div className="fixed bottom-24 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-30 sm:w-[480px] max-h-[60vh] overflow-y-auto rounded-xl bg-[#10151c]/96 border border-white/15 shadow-2xl p-3.5 text-slate-100">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs sm:text-sm font-semibold text-white">Lindenhof Statistics</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5">
            {[
              { label: 'Population', value: stats.totalPopulation },
              { label: 'Houses', value: stats.totalHouses },
              { label: 'Occupied', value: stats.occupiedPlots },
              { label: 'Open Plots', value: stats.availablePlots },
              { label: 'Businesses', value: stats.businessCount },
              { label: 'Vehicles', value: stats.vehicleCount },
              { label: 'Landmarks', value: stats.publicBuildingCount },
              { label: 'Income/day', value: `€${stats.dailyBusinessIncome.toLocaleString()}` },
            ].map((item) => (
              <div key={item.label} className="p-2 rounded-lg bg-[#19202a] border border-white/10">
                <div className="text-[10px] text-slate-400">{item.label}</div>
                <div className="text-sm font-semibold text-white font-mono-tabular mt-0.5">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] text-slate-400">Town Treasury</div>
              <div className="text-base font-semibold text-amber-300 font-mono-tabular">
                €{stats.townTreasury.toLocaleString()}
              </div>
            </div>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={onCollectDailyRevenue}
                className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-semibold cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Collect €{stats.dailyBusinessIncome.toLocaleString()}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Architecture & Cloud Sync Info Modal */}
      {activeModal === 'services' && (
        <div className="fixed bottom-24 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-30 sm:w-[440px] max-h-[60vh] overflow-y-auto rounded-xl bg-[#10151c]/96 border border-white/15 shadow-2xl p-3.5 text-slate-100">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <h2 className="text-xs sm:text-sm font-semibold text-white">
                Access &amp; Residency Info
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2.5 space-y-2 text-[11px] text-slate-300">
            <div className="p-2.5 rounded-lg bg-[#19202a] border border-white/10">
              <div className="font-semibold text-white">Visitor Session Mode</div>
              <div className="text-amber-300 mt-0.5">{townMultiplayerService.transportLabel}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#19202a] border border-white/10">
              <div className="font-semibold text-white">House Assignments</div>
              <div className="text-amber-300 mt-0.5">{townVerificationService.providerName}</div>
              <p className="text-slate-400 mt-0.5">
                Use GET A HOUSE to follow on Instagram and DM your username.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#19202a] border border-white/10">
              <div className="font-semibold text-white">Cloud Persistence</div>
              <div className="text-emerald-300 mt-0.5">
                Cloud Firestore · Read-Only Public Access
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contextual World Interaction Bar (Walking / Seated) */}
      {cameraMode === 'walking' && activeInteraction && (
        <div
          role="region"
          aria-label="Nearby world interaction"
          className={`fixed z-20 rounded-xl bg-[#10151c]/94 border border-amber-400/45 shadow-2xl px-2.5 py-2 text-slate-100 ${
            sittingBenchId
              ? 'bottom-[94px] inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[300px]'
              : 'bottom-[94px] right-2.5 w-[min(52vw,230px)]'
          }`}
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-white truncate">
                {activeInteraction.title}
              </div>
              <div className="text-[10px] text-slate-300 truncate">{activeInteraction.subtitle}</div>
            </div>
            {!sittingBenchId && (
              <span className="hidden sm:inline text-[10px] font-mono-tabular text-amber-300 shrink-0">
                [E]
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {activeInteraction.actions.map((act, idx) => (
              <button
                key={act.id}
                type="button"
                disabled={act.disabled}
                title={act.reason}
                onClick={() => onTriggerInteraction(act.id)}
                className={`h-8 flex-1 px-2 rounded-md text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-45 truncate ${
                  idx === 0
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-[#1a222d] hover:bg-[#243040] text-slate-100 border border-white/15'
                }`}
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Minimal Collapsible Bottom Control Dock — Guaranteed Mobile Containment */}
      <div
        className={`fixed bottom-2 inset-x-2 z-20 flex flex-col items-center pointer-events-none transition-transform duration-200 ease-out ${
          dockCollapsed ? 'translate-y-[calc(100%-22px)]' : 'translate-y-0'
        }`}
      >
        {/* Optional Popover Tray (Tools & Cinematic Tour Selector) */}
        {!dockCollapsed && toolsOpen && (
          <div className="pointer-events-auto mb-1.5 p-2 rounded-xl bg-[#10151c]/95 border border-white/14 shadow-2xl flex flex-wrap items-center justify-center gap-1.5 max-w-[calc(100vw-16px)]">
            <button
              type="button"
              onClick={onToggleBirdAudio}
              title="Toggle 3D spatial bird sounds near trees and parks"
              className={`h-7 flex items-center gap-1 px-2 rounded-lg border text-[11px] font-medium cursor-pointer ${
                birdAudioEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                  : 'bg-[#18202a] border-white/10 text-slate-400'
              }`}
            >
              <Bird className="w-3.5 h-3.5" />
              <span>{birdAudioEnabled ? 'Birds' : 'Muted'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleMusic}
              className={`h-7 flex items-center gap-1 px-2 rounded-lg border text-[11px] font-medium cursor-pointer ${
                musicPlaying
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                  : 'bg-[#18202a] border-white/10 text-slate-200'
              }`}
            >
              {musicPlaying ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <Music className="w-3 h-3" />
              <span>{musicPlaying ? 'On' : 'Music'}</span>
            </button>

            {musicPlaying && (
              <input
                type="range"
                aria-label="Music volume"
                min={0}
                max={1}
                step={0.05}
                value={musicVolume}
                onChange={(e) => onChangeMusicVolume(Number(e.target.value))}
                className="w-16 accent-emerald-400 cursor-pointer"
              />
            )}

            <button
              type="button"
              onClick={onToggleReelsFrame}
              className={`h-7 flex items-center gap-1 px-2 rounded-lg border text-[11px] font-medium cursor-pointer ${
                reelsFrameEnabled
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-[#18202a] text-slate-200 border-white/10'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              <span>9:16</span>
            </button>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  onToggleAdminPanel('builder');
                  setToolsOpen(false);
                }}
                className="h-7 flex items-center gap-1 px-2 rounded-lg bg-[#18202a] text-emerald-300 border border-emerald-400/30 text-[11px] font-medium cursor-pointer"
              >
                <Hammer className="w-3 h-3" />
                <span>Build</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveModal((m) => (m === 'services' ? 'none' : 'services'));
                setToolsOpen(false);
              }}
              className={`h-7 flex items-center gap-1 px-2 rounded-lg border text-[11px] font-medium cursor-pointer ${
                activeModal === 'services'
                  ? 'bg-white text-slate-950 border-white'
                  : 'bg-[#18202a] text-slate-200 border-white/10'
              }`}
            >
              <Info className="w-3 h-3" />
              <span>Info</span>
            </button>
          </div>
        )}

        {!dockCollapsed && cameraMode === 'cinematic' && (
          <div className="pointer-events-auto mb-1">
            <select
              aria-label="Cinematic camera tour"
              value={cinematicTour}
              onChange={(e) => onChangeCinematicTour(e.target.value as CinematicTourId)}
              className="h-7 px-2 rounded-lg bg-[#10151c]/95 border border-amber-400/40 text-[11px] text-amber-200"
            >
              {TOUR_LABELS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Slim Collapse Handle */}
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className="pointer-events-auto h-5 flex items-center gap-1 px-2.5 rounded-t-lg bg-[#10151c]/92 border border-b-0 border-white/14 text-[10px] font-medium text-slate-300 hover:text-white cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3 h-3" />
              <span>Controls</span>
            </>
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {/* Compact Dual-Strip Control Dock (Fits 320px+ Phones Without Overflow) */}
        <nav
          aria-label="Town simulator controls"
          className="pointer-events-auto w-fit max-w-full rounded-xl bg-[#10151c]/92 border border-white/14 shadow-2xl p-1 flex flex-col items-center gap-1"
        >
          {/* Strip 1: Camera Mode Selector (Free View, Iso, Top, Walk, Tour) */}
          <div className="flex items-center justify-center gap-0.5 p-0.5 rounded-lg bg-[#18202a] border border-white/8 max-w-full overflow-x-auto">
            {(
              [
                { id: 'free', label: 'Free', title: 'Free 360° Full-City & Land View', Icon: Globe },
                { id: 'isometric', label: 'Iso', title: 'Isometric 3D View', Icon: Compass },
                { id: 'aerial', label: 'Top', title: 'Top-Down Aerial View', Icon: Eye },
                { id: 'walking', label: 'Walk', title: 'Third-Person Walking Mode', Icon: Footprints },
                { id: 'cinematic', label: 'Tour', title: 'Cinematic Town Flyover', Icon: Film },
              ] as const
            ).map(({ id, label, title, Icon }) => (
              <button
                key={id}
                type="button"
                title={title}
                onClick={() => onChangeCameraMode(id)}
                className={`h-7 flex items-center gap-1 px-2 sm:px-2.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraMode === id
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Strip 2: Compact Time of Day, Weather Cycle & Quick Utility Buttons */}
          <div className="flex items-center justify-center gap-1 max-w-full">
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#18202a] border border-white/8">
              {(
                [
                  { id: 'morning', label: 'Morning', Icon: Sunrise },
                  { id: 'afternoon', label: 'Day', Icon: Sun },
                  { id: 'sunset', label: 'Sunset', Icon: Sunset },
                  { id: 'night', label: 'Night (Moonlight + Mist)', Icon: Moon },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => onChangeTimeOfDay(id)}
                  className={`w-6 h-6 sm:w-7 sm:h-6 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                    timeOfDay === id
                      ? 'bg-slate-100 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={cycleWeather}
              title={`Weather: ${WEATHER_META[weather].label} (tap to change)`}
              className="h-7 flex items-center gap-1 px-2 rounded-lg bg-[#18202a] hover:bg-[#222c3a] border border-white/8 text-[11px] font-medium text-sky-300 cursor-pointer whitespace-nowrap"
            >
              <ActiveWeatherIcon className="w-3 h-3" />
              <span>{WEATHER_META[weather].label}</span>
            </button>

            <button
              type="button"
              title="Districts & Directory"
              aria-label="Districts Directory"
              onClick={() => setActiveModal((m) => (m === 'districts' ? 'none' : 'districts'))}
              className={`w-7 h-7 flex items-center justify-center rounded-lg border cursor-pointer ${
                activeModal === 'districts'
                  ? 'bg-white text-slate-950 border-white'
                  : 'bg-[#18202a] text-slate-200 border-white/8 hover:bg-[#222c3a]'
              }`}
            >
              <MapPin className="w-3 h-3" />
            </button>

            <button
              type="button"
              title="Town Statistics"
              aria-label="Town Statistics"
              onClick={() => setActiveModal((m) => (m === 'stats' ? 'none' : 'stats'))}
              className={`w-7 h-7 flex items-center justify-center rounded-lg border cursor-pointer ${
                activeModal === 'stats'
                  ? 'bg-white text-slate-950 border-white'
                  : 'bg-[#18202a] text-slate-200 border-white/8 hover:bg-[#222c3a]'
              }`}
            >
              <BarChart3 className="w-3 h-3" />
            </button>

            <button
              type="button"
              title="More Tools (Music, 9:16, Info)"
              aria-label="More Tools"
              onClick={() => setToolsOpen((o) => !o)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg border cursor-pointer ${
                toolsOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-[#18202a] text-slate-200 border-white/8 hover:bg-[#222c3a]'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
            </button>
          </div>
        </nav>
      </div>

      {/* Interactive Bird's-Eye Complete City Map Modal */}
      {expansionWorld && onToggleCityMap && (
        <FullCityMapModal
          isOpen={cityMapOpen}
          onClose={() => onToggleCityMap(false)}
          corePlots={plots}
          expansionWorld={expansionWorld}
          playerPose={playerCoords}
          onFlyTo={(x, z, expPlot, corePlot) => {
            if (expPlot) {
              onSelectPlot(null);
              onSelectExpansionPlot?.(expPlot);
            } else if (corePlot) {
              onSelectExpansionPlot?.(null);
              onSelectPlot(corePlot);
            }
            onFocusLocation(x, z, 42);
            onToggleCityMap(false);
          }}
          onWalkTo={(x, z, expPlot, corePlot) => {
            onWalkToLocation?.(x, z, expPlot, corePlot);
            onToggleCityMap(false);
          }}
          onOpenMonument={() => {
            onToggleCityMap(false);
            onToggleOgMonument?.(true);
          }}
        />
      )}

      {/* 50 OG Founders & Sweet_thedevil Royal Recognition Monument Modal */}
      {expansionWorld && onToggleOgMonument && (
        <OGMonumentModal
          isOpen={ogMonumentOpen}
          onClose={() => onToggleOgMonument(false)}
          vipPlot={expansionWorld.vipPlot}
          ogPlots={expansionWorld.ogPlots}
          onVisitPlot={(plot, mode) => {
            onSelectPlot(null);
            onSelectExpansionPlot?.(plot);
            if (mode === 'walk' && onWalkToLocation) {
              onWalkToLocation(plot.x, plot.z, plot);
            } else {
              onFocusLocation(plot.x, plot.z, 38);
            }
            onToggleOgMonument(false);
          }}
        />
      )}
    </>
  );
};
