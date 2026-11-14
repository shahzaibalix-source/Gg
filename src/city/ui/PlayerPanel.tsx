import React, { useMemo, useState } from 'react';
import {
  Compass,
  ExternalLink,
  Eye,
  Footprints,
  Globe,
  Home,
  MapPin,
  Navigation,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import {
  CameraMode,
  InteractionActionId,
  NearbyInteractable,
  PlayerProfile,
  TownPlot,
  TownPublicSettings,
} from '../types';
import { DISTRICTS } from '../world/MasterTownBlueprint';
import { getNearbyPlaces } from '../interaction/WorldInteractions';
import { sanitizeInstagramUrl } from '../firebase/firebaseClient';

export type PlayerPanelTab = 'menu' | 'explore' | 'house' | 'profile' | 'nearby' | 'interactions';

interface PlayerPanelProps {
  open: boolean;
  cameraMode: CameraMode;
  plots: TownPlot[];
  playerProfile: PlayerProfile;
  playerCoords: { x: number; z: number };
  activeInteraction: NearbyInteractable | null;
  sittingBenchId: string | null;
  townSettings: TownPublicSettings;
  onClose: () => void;
  onChangeCameraMode: (mode: CameraMode) => void;
  onFocusLocation: (x: number, z: number, zoom?: number) => void;
  onSelectPlot: (plot: TownPlot | null) => void;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onTriggerInteraction: (actionId: InteractionActionId) => void;
}

const JACKET_COLORS = [
  { label: 'Navy', value: '#2f5a87' },
  { label: 'Forest', value: '#2f6a4f' },
  { label: 'Burgundy', value: '#8d363b' },
  { label: 'Ochre', value: '#b8762d' },
  { label: 'Charcoal', value: '#3b424c' },
];

/**
 * Clean, login-free public visitor panel with zero administrator tools.
 * Houses Explore Town, Walking Mode, Aerial View, Isometric View,
 * Available Houses, Walking Avatar Appearance, Nearby Places, and Interactions.
 */
export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  open,
  cameraMode,
  plots,
  playerProfile,
  playerCoords,
  activeInteraction,
  sittingBenchId,
  townSettings,
  onClose,
  onChangeCameraMode,
  onFocusLocation,
  onSelectPlot,
  onUpdateProfile,
  onTriggerInteraction,
}) => {
  const [activeTab, setActiveTab] = useState<PlayerPanelTab>('menu');

  const nearbyPlaces = useMemo(
    () => getNearbyPlaces(playerCoords.x, playerCoords.z, plots, 10),
    [playerCoords.x, playerCoords.z, plots],
  );

  const openResidentialPlots = useMemo(
    () =>
      plots.filter(
        (p) =>
          p.ownershipStatus !== 'occupied' &&
          !p.ownerUsername &&
          !p.business &&
          !p.publicBuilding &&
          (p.category === 'residential' ||
            p.category === 'luxury-residential' ||
            p.category === 'expansion-residential'),
      ),
    [plots],
  );

  if (!open) return null;

  const visitPoint = (x: number, z: number, plot?: TownPlot) => {
    if (cameraMode === 'walking') {
      const approachDist = plot ? plot.depth / 2 + 2.5 : 0;
      const targetX = plot ? x + Math.sin(plot.facingAngle) * approachDist : x;
      const targetZ = plot ? z + Math.cos(plot.facingAngle) * approachDist : z;
      onFocusLocation(targetX, targetZ, 38);
    } else {
      onFocusLocation(x, z, 46);
    }
    if (plot) onSelectPlot(plot);
  };

  const safeInstagramUrl = sanitizeInstagramUrl(townSettings.instagramUrl);

  return (
    <aside
      aria-label="Town explorer panel"
      className="fixed top-12 inset-x-2 sm:inset-x-auto sm:left-3 z-30 sm:w-[344px] max-h-[68vh] flex flex-col rounded-xl bg-[#10151c]/95 border border-white/14 shadow-2xl text-slate-100 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold text-white truncate">
              {playerProfile.displayName || 'Town Visitor'}
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              {sittingBenchId
                ? 'Sitting on a bench'
                : cameraMode === 'free'
                  ? 'Free View active'
                  : cameraMode === 'walking'
                    ? 'Walking Mode active'
                    : cameraMode === 'aerial'
                      ? 'Aerial View active'
                      : cameraMode === 'isometric'
                        ? 'Isometric View active'
                        : 'Cinematic View active'}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close explorer panel"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-navigation back bar */}
      {activeTab !== 'menu' && (
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#18202b] border-b border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className="text-amber-300 hover:text-amber-200 font-medium py-1 cursor-pointer"
          >
            ← Back to Menu
          </button>
          <span className="text-slate-400 capitalize">
            {activeTab === 'house' ? 'Available Houses' : activeTab}
          </span>
        </div>
      )}

      {/* Body */}
      <div className="p-3 overflow-y-auto space-y-2.5">
        {activeTab === 'menu' && (
          <>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { id: 'free', label: 'Free', Icon: Globe },
                  { id: 'walking', label: 'Walk', Icon: Footprints },
                  { id: 'aerial', label: 'Top', Icon: Eye },
                  { id: 'isometric', label: 'Iso', Icon: Compass },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChangeCameraMode(id)}
                  className={`h-10 flex flex-col items-center justify-center gap-0.5 px-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                    cameraMode === id
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : 'bg-[#19212c] text-slate-100 border-white/10 hover:bg-[#222c3a]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('explore')}
                className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg bg-[#19212c] hover:bg-[#222c3a] border border-white/10 text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-xs font-medium text-white">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Explore Town</span>
                </span>
                <span className="text-[11px] text-slate-400">7 Areas →</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('house')}
                className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg bg-[#19212c] hover:bg-[#222c3a] border border-white/10 text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-xs font-medium text-white">
                  <Home className="w-4 h-4 text-amber-300" />
                  <span>Available Houses</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {openResidentialPlots.length} Open →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg bg-[#19212c] hover:bg-[#222c3a] border border-white/10 text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-xs font-medium text-white">
                  <User className="w-4 h-4 text-sky-400" />
                  <span>Visitor Appearance</span>
                </span>
                <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                  {playerProfile.displayName} →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('nearby')}
                className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg bg-[#19212c] hover:bg-[#222c3a] border border-white/10 text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-xs font-medium text-white">
                  <Navigation className="w-4 h-4 text-emerald-300" />
                  <span>Nearby Places</span>
                </span>
                <span className="text-[11px] text-slate-400">{nearbyPlaces.length} listed →</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('interactions')}
                className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg bg-[#19212c] hover:bg-[#222c3a] border border-white/10 text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-xs font-medium text-white">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Interactions</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {activeInteraction ? activeInteraction.title : 'Walk near objects'} →
                </span>
              </button>
            </div>
          </>
        )}

        {activeTab === 'explore' && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-400">
              Jump straight to any district in Lindenhof:
            </p>
            {DISTRICTS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  const walkDestZ = d.id === 'central-square' ? 16.5 : d.center.z;
                  visitPoint(d.center.x, walkDestZ);
                  onClose();
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#19212c] hover:bg-[#222c3a] border border-white/10 text-left cursor-pointer"
              >
                <div className="text-xs font-semibold text-white">{d.name}</div>
                <div className="text-[11px] text-slate-400">{d.subtitle}</div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'house' && (
          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-lg bg-[#19212c] border border-amber-400/25 space-y-2">
              <p className="text-slate-200 leading-relaxed">{townSettings.instagramInstruction}</p>
              <a
                href={safeInstagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
              >
                <span>GET A HOUSE</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {openResidentialPlots.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-400">
                  Open residential plots ({openResidentialPlots.length}):
                </p>
                {openResidentialPlots.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      visitPoint(p.center.x, p.center.z, p);
                      onClose();
                    }}
                    className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-lg bg-[#19212c] hover:bg-[#222c3a] border border-white/10 cursor-pointer"
                  >
                    <span className="font-medium text-white">{p.plotCode}</span>
                    <span className="text-[11px] text-emerald-300">{p.address}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">All residential plots are currently occupied.</p>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-3 text-xs">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Customize your walking character for this visit. No login or account is required.
            </p>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1" htmlFor="player-name-input">
                Visitor Display Name
              </label>
              <input
                id="player-name-input"
                type="text"
                maxLength={22}
                value={playerProfile.displayName}
                onChange={(e) => onUpdateProfile({ displayName: e.target.value })}
                className="w-full min-h-[40px] px-2.5 py-1.5 rounded-lg bg-[#19212c] border border-white/15 text-white"
              />
            </div>

            <div>
              <div className="text-[11px] text-slate-400 mb-1.5">Jacket Color</div>
              <div className="flex items-center gap-2">
                {JACKET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => onUpdateProfile({ jacketColor: c.value })}
                    style={{ backgroundColor: c.value }}
                    className={`w-9 h-9 rounded-lg border-2 cursor-pointer ${
                      playerProfile.jacketColor === c.value
                        ? 'border-white scale-105'
                        : 'border-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#19212c] border border-white/10 text-[11px] text-slate-300 space-y-1">
              <div>
                Current Position:{' '}
                <span className="font-mono-tabular text-slate-100">
                  ({playerCoords.x.toFixed(1)}m, {playerCoords.z.toFixed(1)}m)
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'nearby' && (
          <div className="space-y-1.5">
            {nearbyPlaces.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => {
                  visitPoint(place.x, place.z, place.plot);
                  onClose();
                }}
                className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#19212c] hover:bg-[#222c3a] border border-white/10 text-left cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">{place.label}</div>
                  <div className="text-[11px] text-slate-400 truncate">{place.category}</div>
                </div>
                <span className="text-[11px] font-mono-tabular text-amber-300 shrink-0">
                  {Math.round(place.distance)}m
                </span>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'interactions' && (
          <div className="space-y-2.5 text-xs">
            {activeInteraction ? (
              <div className="p-3 rounded-lg bg-[#19212c] border border-amber-400/35 space-y-2.5">
                <div>
                  <div className="font-semibold text-white">{activeInteraction.title}</div>
                  <div className="text-[11px] text-slate-400">{activeInteraction.subtitle}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeInteraction.actions.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      disabled={act.disabled}
                      title={act.reason}
                      onClick={() => onTriggerInteraction(act.id)}
                      className="min-h-[44px] flex-1 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 font-semibold cursor-pointer"
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#19212c] border border-white/10 text-slate-300 space-y-1.5">
                <p className="font-medium text-white">No nearby object in reach</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Switch to Walking Mode and approach any park bench to sit, house or shop
                  doorway to open/inspect, parked or street car to inspect, or plaza landmark to
                  view town details.
                </p>
                {cameraMode !== 'walking' && (
                  <button
                    type="button"
                    onClick={() => onChangeCameraMode('walking')}
                    className="mt-1 w-full min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
                  >
                    Switch to Walking Mode
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
