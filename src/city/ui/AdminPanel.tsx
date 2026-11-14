import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CloudUpload,
  Crown,
  FileArchive,
  Hammer,
  Home,
  MapPin,
  RefreshCw,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  ShieldPlus,
  Trash2,
  Upload,
  UserCheck,
  UserPen,
  X,
} from 'lucide-react';
import {
  BusinessCategory,
  ConstructionDraft,
  HouseArchetype,
  PrivateResidentRecord,
  TownPlot,
  TownPublicSettings,
} from '../types';
import { ARCHETYPE_LABELS, BUSINESS_LABELS } from '../registry/CityRegistry';
import type { AdminRosterEntry } from '../firebase/firebaseClient';
import type { ExpansionCityWorld } from '../expansion/ExpansionMasterPlan';
import type { ExpansionManifest, ParsedFollowerDataset } from '../expansion/types';
import { VIP_DISPLAY_LABEL } from '../expansion/zipFollowerParser';

export type AdminPanelTab = 'residents' | 'followers' | 'builder' | 'settings';

export interface FirestoreExpansionVerificationState {
  exists: boolean;
  verifiedShardCount: number;
  verifiedResidentCount: number;
  lastCheckedAt?: string;
}

interface AdminPanelProps {
  open: boolean;
  activeTab: AdminPanelTab;
  plots: TownPlot[];
  selectedPlot: TownPlot | null;
  focusedPlotId: string | null;
  currentUserUid: string | null;
  adminEntries: AdminRosterEntry[];
  residentRecords: Record<string, PrivateResidentRecord>;
  townSettings: TownPublicSettings;
  constructionDraft: ConstructionDraft;
  editorFeedback: string | null;
  adminActionNotice: string | null;
  followerDataset?: ParsedFollowerDataset | null;
  expansionWorld?: ExpansionCityWorld | null;
  expansionManifest?: ExpansionManifest | null;
  firestoreVerifiedInfo?: FirestoreExpansionVerificationState | null;
  onChangeTab: (tab: AdminPanelTab) => void;
  onClose: () => void;
  onClearFocusedPlot: () => void;
  onFocusLocation: (x: number, z: number, zoom?: number) => void;
  onSelectPlot: (plot: TownPlot | null) => void;
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
  onUpdateConstructionDraft: (patch: Partial<ConstructionDraft>) => void;
  onConfirmConstruction: () => void;
  onImportBundledZip?: (onProgress: (msg: string) => void) => Promise<boolean>;
  onImportUploadedZip?: (file: File, onProgress: (msg: string) => void) => Promise<boolean>;
  onVerifyExpansionInFirestore?: () => Promise<void>;
}

const HOUSE_ARCHETYPE_OPTIONS: HouseArchetype[] = [
  'cottage',
  'tudor',
  'townhouse',
  'nordic',
  'modern-villa',
  'mediterranean',
  'luxury-mansion',
  'luxury-modern',
];

const BUSINESS_CATEGORY_OPTIONS: BusinessCategory[] = [
  'restaurant',
  'cafe',
  'supermarket',
  'clothing',
  'dealership',
  'office',
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  open,
  activeTab,
  plots,
  selectedPlot,
  focusedPlotId,
  currentUserUid,
  adminEntries,
  residentRecords,
  townSettings,
  constructionDraft,
  editorFeedback,
  adminActionNotice,
  followerDataset,
  expansionWorld,
  expansionManifest,
  firestoreVerifiedInfo,
  onChangeTab,
  onClose,
  onClearFocusedPlot,
  onFocusLocation,
  onSelectPlot,
  onApproveResident,
  onReassignResident,
  onRevokeResident,
  onDemolishPlot,
  onSaveTownSettings,
  onGrantAdmin,
  onRevokeAdmin,
  onSeedTownDefaults,
  onUpdateConstructionDraft,
  onConfirmConstruction,
  onImportBundledZip,
  onImportUploadedZip,
  onVerifyExpansionInFirestore,
}) => {
  // Resident approval form state
  const [assignPlotId, setAssignPlotId] = useState<string>('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [inGameUsername, setInGameUsername] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignArchetype, setAssignArchetype] = useState<HouseArchetype>('cottage');
  const [residentSearch, setResidentSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Follower ZIP import progress state
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  // Inline edit / revoke state for existing residents
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [confirmRevokePlotId, setConfirmRevokePlotId] = useState<string | null>(null);

  // Builder demolish confirmation & Settings admin/seed state
  const [confirmDemolishPlotId, setConfirmDemolishPlotId] = useState<string | null>(null);
  const [newAdminUid, setNewAdminUid] = useState('');

  // Settings form draft synced with Firestore townSettings
  const [settingsDraft, setSettingsDraft] = useState<TownPublicSettings>(townSettings);

  useEffect(() => {
    setSettingsDraft(townSettings);
  }, [townSettings]);

  const availableResidentialPlots = useMemo(
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

  useEffect(() => {
    if (
      availableResidentialPlots.length > 0 &&
      !availableResidentialPlots.some((p) => p.id === assignPlotId)
    ) {
      setAssignPlotId(availableResidentialPlots[0].id);
    } else if (availableResidentialPlots.length === 0) {
      setAssignPlotId('');
    }
  }, [availableResidentialPlots, assignPlotId]);

  // Pre-select or open inline editor when "Manage Ownership" is triggered for a specific plot
  useEffect(() => {
    if (!open || !focusedPlotId) return;
    const target = plots.find((p) => p.id === focusedPlotId);
    if (!target) {
      onClearFocusedPlot();
      return;
    }
    if (availableResidentialPlots.some((p) => p.id === focusedPlotId)) {
      setAssignPlotId(focusedPlotId);
      setEditingPlotId(null);
      setConfirmRevokePlotId(null);
    } else if (target.ownershipStatus === 'occupied' || target.ownerUsername) {
      const rec = residentRecords[target.id];
      setResidentSearch(target.plotCode);
      setEditingPlotId(target.id);
      setConfirmRevokePlotId(null);
      setEditUsername(target.ownerUsername ?? '');
      setEditInstagram(rec?.instagramHandle ?? '');
      setEditNotes(rec?.notes ?? '');
    }
    onClearFocusedPlot();
  }, [
    open,
    focusedPlotId,
    plots,
    availableResidentialPlots,
    residentRecords,
    onClearFocusedPlot,
  ]);

  const occupiedResidentialPlots = useMemo(() => {
    const q = residentSearch.trim().toLowerCase();
    return plots.filter((p) => {
      if (p.publicBuilding || p.business) return false;
      if (p.ownershipStatus !== 'occupied' && !p.ownerUsername) return false;
      if (!q) return true;
      const rec = residentRecords[p.id];
      return (
        p.plotCode.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        (p.ownerUsername ?? '').toLowerCase().includes(q) ||
        (rec?.instagramHandle ?? '').toLowerCase().includes(q) ||
        (rec?.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [plots, residentRecords, residentSearch]);

  if (!open) return null;

  const selectedAssignPlot =
    availableResidentialPlots.find((p) => p.id === assignPlotId) ?? null;

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignPlotId || !inGameUsername.trim() || !instagramHandle.trim()) return;
    setSubmitting(true);
    const ok = await onApproveResident({
      plotId: assignPlotId,
      inGameUsername: inGameUsername.trim(),
      instagramHandle: instagramHandle.trim(),
      notes: assignNotes.trim(),
      archetype: assignArchetype,
    });
    setSubmitting(false);
    if (ok) {
      setInstagramHandle('');
      setInGameUsername('');
      setAssignNotes('');
    }
  };

  const startEditResident = (plot: TownPlot) => {
    const rec = residentRecords[plot.id];
    setEditingPlotId(plot.id);
    setConfirmRevokePlotId(null);
    setEditUsername(plot.ownerUsername ?? '');
    setEditInstagram(rec?.instagramHandle ?? '');
    setEditNotes(rec?.notes ?? '');
  };

  const handleSaveReassign = async (plotId: string) => {
    if (!editUsername.trim() || !editInstagram.trim()) return;
    setSubmitting(true);
    const ok = await onReassignResident({
      plotId,
      inGameUsername: editUsername.trim(),
      instagramHandle: editInstagram.trim(),
      notes: editNotes.trim(),
    });
    setSubmitting(false);
    if (ok) {
      setEditingPlotId(null);
    }
  };

  const handleConfirmRevoke = async (plotId: string) => {
    setSubmitting(true);
    const ok = await onRevokeResident(plotId);
    setSubmitting(false);
    if (ok) {
      setConfirmRevokePlotId(null);
    }
  };

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSaveTownSettings(settingsDraft);
    setSubmitting(false);
  };

  return (
    <aside
      aria-label="Super Admin Panel"
      className="fixed top-12 inset-x-2 sm:inset-x-auto sm:left-3 z-30 sm:w-[390px] max-h-[72vh] flex flex-col rounded-xl bg-[#10151c]/96 border border-amber-400/35 shadow-2xl text-slate-100 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-white">Super Admin Panel</h2>
            <p className="text-[11px] text-slate-400">Backend-verified town management</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close admin panel"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1.5 bg-[#161c24] border-b border-white/10">
        {(
          [
            { id: 'residents', label: 'Residents', Icon: UserCheck },
            { id: 'followers', label: 'Followers', Icon: FileArchive },
            { id: 'builder', label: 'Builder', Icon: Hammer },
            { id: 'settings', label: 'Settings', Icon: Settings },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChangeTab(id)}
            className={`min-h-[38px] flex items-center justify-center gap-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
              activeTab === id
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* Feedback Banner */}
      {(adminActionNotice || editorFeedback) && (
        <div className="px-3.5 py-2 bg-[#1a222d] border-b border-amber-400/25 text-[11px] text-amber-200">
          {adminActionNotice ?? editorFeedback}
        </div>
      )}

      {/* Body */}
      <div className="p-3.5 overflow-y-auto space-y-4 text-xs">
        {activeTab === 'residents' && (
          <>
            {/* Approve & Assign Form */}
            <form onSubmit={handleAssignSubmit} className="space-y-2.5 pb-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">
                  Approve Instagram Request &amp; Assign House
                </h3>
                <span className="text-[11px] text-emerald-300 font-mono-tabular">
                  {availableResidentialPlots.length} open
                </span>
              </div>

              {availableResidentialPlots.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  All residential plots are currently assigned. Revoke an existing plot below to free
                  a house.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1" htmlFor="assign-plot">
                      Available House / Plot
                    </label>
                    <select
                      id="assign-plot"
                      value={assignPlotId}
                      onChange={(e) => setAssignPlotId(e.target.value)}
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white"
                    >
                      {availableResidentialPlots.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.plotCode} · {p.address} ({p.house ? 'Built House' : 'Open Plot'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1" htmlFor="assign-ig">
                        Instagram Username (Private)
                      </label>
                      <input
                        id="assign-ig"
                        type="text"
                        maxLength={40}
                        value={instagramHandle}
                        onChange={(e) => setInstagramHandle(e.target.value)}
                        placeholder="@instagram_handle"
                        className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1" htmlFor="assign-name">
                        In-Game Username (Public)
                      </label>
                      <input
                        id="assign-name"
                        type="text"
                        maxLength={32}
                        value={inGameUsername}
                        onChange={(e) => setInGameUsername(e.target.value)}
                        placeholder="Displayed on house"
                        className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  {selectedAssignPlot && !selectedAssignPlot.house && (
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1" htmlFor="assign-arch">
                        House Architecture
                      </label>
                      <select
                        id="assign-arch"
                        value={assignArchetype}
                        onChange={(e) => setAssignArchetype(e.target.value as HouseArchetype)}
                        className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white"
                      >
                        {HOUSE_ARCHETYPE_OPTIONS.map((arch) => (
                          <option key={arch} value={arch}>
                            {ARCHETYPE_LABELS[arch]}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1" htmlFor="assign-notes">
                      Private Admin Notes (Optional)
                    </label>
                    <input
                      id="assign-notes"
                      type="text"
                      maxLength={200}
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      placeholder="DM verified date or request note"
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white placeholder:text-slate-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      !assignPlotId ||
                      !instagramHandle.trim() ||
                      !inGameUsername.trim()
                    }
                    className="w-full min-h-[42px] rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-slate-950 font-semibold cursor-pointer"
                  >
                    Approve &amp; Assign House
                  </button>
                </>
              )}
            </form>

            {/* Existing Residents List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">
                  Assigned Houses ({occupiedResidentialPlots.length})
                </h3>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="Filter residents by plot, username, Instagram, or notes"
                  value={residentSearch}
                  onChange={(e) => setResidentSearch(e.target.value)}
                  placeholder="Filter by plot, username, @instagram, or notes"
                  className="w-full min-h-[38px] pl-8 pr-8 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white placeholder:text-slate-500"
                />
                {residentSearch && (
                  <button
                    type="button"
                    aria-label="Clear resident filter"
                    onClick={() => setResidentSearch('')}
                    className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/10 absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {occupiedResidentialPlots.length === 0 ? (
                  <div className="p-3 rounded-lg bg-[#19202a] border border-white/10 text-center space-y-1.5">
                    <p className="text-[11px] text-slate-400">
                      {residentSearch.trim()
                        ? `No matching residents found for "${residentSearch.trim()}".`
                        : 'No houses are currently assigned.'}
                    </p>
                    {residentSearch.trim() && (
                      <button
                        type="button"
                        onClick={() => setResidentSearch('')}
                        className="px-2.5 py-1 rounded-md bg-[#232d3b] hover:bg-[#2c3849] text-[11px] text-slate-200 cursor-pointer"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                ) : (
                  occupiedResidentialPlots.map((plot) => {
                    const rec = residentRecords[plot.id];
                    const isEditing = editingPlotId === plot.id;
                    const isConfirmingRevoke = confirmRevokePlotId === plot.id;
                  return (
                    <div
                      key={plot.id}
                      className="p-2.5 rounded-lg bg-[#19202a] border border-white/10 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">
                            {plot.ownerUsername ?? 'Assigned Resident'}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {plot.plotCode} · {plot.address}
                          </div>
                          <div className="text-[11px] text-amber-300 truncate">
                            IG: {rec?.instagramHandle || 'Founding roster / not recorded'}
                          </div>
                        </div>
                        <button
                          type="button"
                          title="Focus camera on house"
                          onClick={() => {
                            onFocusLocation(plot.center.x, plot.center.z, 36);
                            onSelectPlot(plot);
                          }}
                          className="p-1.5 rounded-md bg-[#232d3b] hover:bg-[#2c3849] text-slate-200 cursor-pointer shrink-0"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {isEditing ? (
                        <div className="pt-2 border-t border-white/10 space-y-2">
                          <input
                            type="text"
                            maxLength={40}
                            value={editInstagram}
                            onChange={(e) => setEditInstagram(e.target.value)}
                            placeholder="Instagram @handle"
                            className="w-full px-2.5 py-1.5 rounded-md bg-[#12171e] border border-white/15 text-white"
                          />
                          <input
                            type="text"
                            maxLength={32}
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            placeholder="In-game username"
                            className="w-full px-2.5 py-1.5 rounded-md bg-[#12171e] border border-white/15 text-white"
                          />
                          <input
                            type="text"
                            maxLength={200}
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Private note (optional)"
                            className="w-full px-2.5 py-1.5 rounded-md bg-[#12171e] border border-white/15 text-white"
                          />
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={submitting || !editUsername.trim() || !editInstagram.trim()}
                              onClick={() => handleSaveReassign(plot.id)}
                              className="flex-1 min-h-[34px] flex items-center justify-center gap-1 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-slate-950 font-semibold cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save Owner</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPlotId(null)}
                              className="px-3 min-h-[34px] rounded-md bg-[#232d3b] text-slate-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : isConfirmingRevoke ? (
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-rose-200">
                            Revoke {plot.plotCode}?
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleConfirmRevoke(plot.id)}
                              className="px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-400 text-slate-950 font-semibold cursor-pointer"
                            >
                              Confirm Revoke
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRevokePlotId(null)}
                              className="px-2.5 py-1 rounded-md bg-[#232d3b] text-slate-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => startEditResident(plot)}
                            className="flex-1 min-h-[34px] flex items-center justify-center gap-1 rounded-md bg-[#232d3b] hover:bg-[#2c3849] text-slate-100 cursor-pointer"
                          >
                            <UserPen className="w-3.5 h-3.5" />
                            <span>Change Owner</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPlotId(null);
                              setConfirmRevokePlotId(plot.id);
                            }}
                            className="flex-1 min-h-[34px] flex items-center justify-center gap-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'followers' && (
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl bg-[#161e29] border border-amber-400/25 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                  <h3 className="text-xs font-semibold text-white truncate">
                    Instagram Follower City Import
                  </h3>
                </div>
                <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 shrink-0">
                  VIP #1: @{followerDataset?.vipRecord?.username ?? VIP_DISPLAY_LABEL}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Source archive:{' '}
                <strong className="text-white">
                  {followerDataset?.sourceName ?? 'Not loaded'}
                </strong>
              </p>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div className="p-2 rounded-lg bg-[#10161e] border border-white/10">
                  <div className="text-[10px] text-slate-400">Raw Followers</div>
                  <div className="text-sm font-semibold font-mono-tabular text-white">
                    {(followerDataset?.totalRawFollowers ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#10161e] border border-white/10">
                  <div className="text-[10px] text-slate-400">Unique Followers</div>
                  <div className="text-sm font-semibold font-mono-tabular text-emerald-300">
                    {(followerDataset?.uniqueFollowers ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#10161e] border border-white/10">
                  <div className="text-[10px] text-slate-400">50 OG Members</div>
                  <div className="text-sm font-semibold font-mono-tabular text-amber-300">
                    {followerDataset?.ogMembers.length ?? 0} (VIP #1 + 49)
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#10161e] border border-white/10">
                  <div className="text-[10px] text-slate-400">Expansion Plots</div>
                  <div className="text-sm font-semibold font-mono-tabular text-sky-300">
                    {(expansionWorld?.counts.openExpansionCount ?? 0).toLocaleString()} open
                  </div>
                </div>
              </div>
            </div>

            {/* Honest Firestore Persistence Verification Card */}
            <div
              className={`p-3 rounded-xl border space-y-2 ${
                firestoreVerifiedInfo?.exists &&
                firestoreVerifiedInfo.verifiedResidentCount > 0 &&
                firestoreVerifiedInfo.verifiedResidentCount ===
                  (expansionManifest?.uniqueFollowers ?? firestoreVerifiedInfo.verifiedResidentCount)
                  ? 'bg-emerald-950/30 border-emerald-400/35'
                  : 'bg-[#19202a] border-amber-400/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {firestoreVerifiedInfo?.exists && firestoreVerifiedInfo.verifiedResidentCount > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {firestoreVerifiedInfo?.exists &&
                      firestoreVerifiedInfo.verifiedResidentCount > 0
                        ? `Verified in Firestore: ${firestoreVerifiedInfo.verifiedResidentCount.toLocaleString()} residents / ${firestoreVerifiedInfo.verifiedShardCount} shards`
                        : 'Not yet persisted to Cloud Firestore'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {firestoreVerifiedInfo?.exists && firestoreVerifiedInfo.verifiedResidentCount > 0
                        ? `Manifest confirmed via server readback${expansionManifest?.importedAt ? ` (${expansionManifest.importedAt.slice(0, 10)})` : ''}.`
                        : 'Currently running from bundled seed JSON. Click Import & Verify below to persist all shards into Firestore.'}
                    </div>
                  </div>
                </div>
              </div>

              {importProgress && (
                <div className="p-2 rounded-lg bg-[#10151c] border border-sky-400/30 text-[11px] text-sky-200">
                  {importProgress}
                </div>
              )}

              <div className="space-y-2 pt-1">
                {onImportBundledZip && (
                  <button
                    type="button"
                    disabled={importBusy}
                    onClick={async () => {
                      setImportBusy(true);
                      setImportProgress('Reading bundled Instagram ZIP archive...');
                      await onImportBundledZip((msg) => setImportProgress(msg));
                      setImportBusy(false);
                    }}
                    className="w-full min-h-[40px] flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold cursor-pointer"
                  >
                    <CloudUpload className="w-4 h-4" />
                    <span>Import Bundled Instagram ZIP &amp; Verify in Firestore</span>
                  </button>
                )}

                {onImportUploadedZip && (
                  <label className="w-full min-h-[38px] flex items-center justify-center gap-2 rounded-lg bg-[#222b38] hover:bg-[#2b3748] border border-white/15 text-slate-100 font-medium cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-sky-300" />
                    <span>Upload Updated Instagram .ZIP or followers_1.html</span>
                    <input
                      type="file"
                      accept=".zip,.html"
                      disabled={importBusy}
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        setImportBusy(true);
                        setImportProgress(`Parsing ${file.name}...`);
                        await onImportUploadedZip(file, (msg) => setImportProgress(msg));
                        setImportBusy(false);
                      }}
                    />
                  </label>
                )}

                {onVerifyExpansionInFirestore && (
                  <button
                    type="button"
                    disabled={importBusy}
                    onClick={async () => {
                      setImportBusy(true);
                      setImportProgress('Querying Cloud Firestore server...');
                      await onVerifyExpansionInFirestore();
                      setImportProgress(null);
                      setImportBusy(false);
                    }}
                    className="w-full min-h-[36px] flex items-center justify-center gap-1.5 rounded-lg bg-[#161c24] hover:bg-[#1f2834] border border-white/12 text-slate-200 font-medium cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${importBusy ? 'animate-spin' : ''}`} />
                    <span>Verify Server Readback</span>
                  </button>
                )}
              </div>
            </div>

            {expansionWorld && (
              <div className="p-2.5 rounded-lg bg-[#161c24] border border-white/10 text-[11px] text-slate-300 space-y-1">
                <div className="font-semibold text-white">Expanded City Summary</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Built Follower Houses</span>
                  <span className="font-mono-tabular text-white">
                    {(
                      expansionWorld.counts.ogCount + expansionWorld.counts.residentHouseCount
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Surveyed Expansion Plots</span>
                  <span className="font-mono-tabular text-white">
                    {expansionWorld.counts.totalExpansionPlots.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duplicates Removed</span>
                  <span className="font-mono-tabular text-emerald-300">
                    {followerDataset?.duplicatesRemoved ?? 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'builder' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#1a2029] border border-white/10">
              <button
                type="button"
                onClick={() =>
                  onUpdateConstructionDraft({
                    mode: 'place',
                    sourcePlotId: null,
                    targetPlotId: null,
                  })
                }
                className={`py-1.5 rounded-md font-medium cursor-pointer ${
                  constructionDraft.mode !== 'move'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300'
                }`}
              >
                Place Building
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateConstructionDraft({
                    mode: 'move',
                    targetPlotId: null,
                  })
                }
                className={`py-1.5 rounded-md font-medium cursor-pointer ${
                  constructionDraft.mode === 'move'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300'
                }`}
              >
                Relocate Building
              </button>
            </div>

            {constructionDraft.mode === 'move' ? (
              <div className="p-2.5 rounded-lg bg-[#19202a] border border-white/10 space-y-2">
                {constructionDraft.sourcePlotId ? (
                  <p className="text-slate-300">
                    Moving from{' '}
                    <strong className="text-sky-300">
                      {plots.find((p) => p.id === constructionDraft.sourcePlotId)?.plotCode}
                    </strong>
                    . Click any empty green plot in the 3D town, then confirm.
                  </p>
                ) : (
                  <p className="text-slate-300">
                    Click an occupied house or business in the 3D town and tap <strong>Move</strong>{' '}
                    in its inspector card, then click an empty green plot.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#1a2029] border border-white/10">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConstructionDraft({ mode: 'place', buildingType: 'house' })
                    }
                    className={`py-1.5 rounded-md font-medium cursor-pointer ${
                      constructionDraft.buildingType === 'house'
                        ? 'bg-slate-100 text-slate-950'
                        : 'text-slate-300'
                    }`}
                  >
                    House
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConstructionDraft({ mode: 'place', buildingType: 'business' })
                    }
                    className={`py-1.5 rounded-md font-medium cursor-pointer ${
                      constructionDraft.buildingType === 'business'
                        ? 'bg-slate-100 text-slate-950'
                        : 'text-slate-300'
                    }`}
                  >
                    Business
                  </button>
                </div>

                {constructionDraft.buildingType === 'house' ? (
                  <select
                    value={constructionDraft.houseArchetype}
                    onChange={(e) =>
                      onUpdateConstructionDraft({
                        mode: 'place',
                        houseArchetype: e.target.value as HouseArchetype,
                      })
                    }
                    className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white"
                  >
                    {HOUSE_ARCHETYPE_OPTIONS.map((arch) => (
                      <option key={arch} value={arch}>
                        {ARCHETYPE_LABELS[arch]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={constructionDraft.businessCategory}
                    onChange={(e) =>
                      onUpdateConstructionDraft({
                        mode: 'place',
                        businessCategory: e.target.value as BusinessCategory,
                      })
                    }
                    className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white"
                  >
                    {BUSINESS_CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {BUSINESS_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">
                    Target:{' '}
                    <strong className="text-slate-100">
                      {constructionDraft.targetPlotId
                        ? plots.find((p) => p.id === constructionDraft.targetPlotId)?.plotCode
                        : 'Click an empty green plot'}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConstructionDraft({
                        mode: 'place',
                        rotationQuarterTurns: ((constructionDraft.rotationQuarterTurns + 1) % 4) as
                          | 0
                          | 1
                          | 2
                          | 3,
                      })
                    }
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#1a2029] border border-white/15 text-slate-200 hover:text-white cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>{constructionDraft.rotationQuarterTurns * 90}°</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!constructionDraft.targetPlotId}
                onClick={onConfirmConstruction}
                className="flex-1 min-h-[40px] rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-semibold cursor-pointer"
              >
                {constructionDraft.mode === 'move' ? 'Confirm Move' : 'Place Building'}
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateConstructionDraft({
                    mode: 'idle',
                    targetPlotId: null,
                    sourcePlotId: null,
                  })
                }
                className="px-3 min-h-[40px] rounded-lg bg-[#1a2029] border border-white/15 text-slate-300 hover:text-white cursor-pointer"
              >
                Clear
              </button>
            </div>

            {selectedPlot &&
              (selectedPlot.house || selectedPlot.business) &&
              !selectedPlot.publicBuilding &&
              selectedPlot.category !== 'public' && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-[11px] text-slate-400">
                    Selected Plot:{' '}
                    <strong className="text-white">{selectedPlot.plotCode}</strong> (
                    {selectedPlot.house ? 'House' : 'Business'})
                  </div>
                  {confirmDemolishPlotId === selectedPlot.id ? (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-400/30">
                      <span className="text-[11px] text-rose-200">
                        Demolish {selectedPlot.plotCode}?
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={async () => {
                            setSubmitting(true);
                            const ok = await onDemolishPlot(selectedPlot.id);
                            setSubmitting(false);
                            if (ok) setConfirmDemolishPlotId(null);
                          }}
                          className="px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-400 text-slate-950 font-semibold cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDemolishPlotId(null)}
                          className="px-2.5 py-1 rounded-md bg-[#232d3b] text-slate-200 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDemolishPlotId(selectedPlot.id)}
                      className="w-full min-h-[36px] flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Demolish Building on {selectedPlot.plotCode}</span>
                    </button>
                  )}
                </div>
              )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <form onSubmit={handleSaveSettingsSubmit} className="space-y-3 pb-4 border-b border-white/10">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Configure the public Welcome Screen and the official Instagram profile link opened by
                the <strong>GET A HOUSE</strong> button.
              </p>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1" htmlFor="set-ig-url">
                  Official Instagram Profile URL (https://)
                </label>
                <input
                  id="set-ig-url"
                  type="url"
                  maxLength={200}
                  required
                  value={settingsDraft.instagramUrl}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, instagramUrl: e.target.value }))
                  }
                  placeholder="https://www.instagram.com/yourpage/"
                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1" htmlFor="set-title">
                  Welcome Screen Title
                </label>
                <input
                  id="set-title"
                  type="text"
                  maxLength={80}
                  required
                  value={settingsDraft.welcomeTitle}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, welcomeTitle: e.target.value }))
                  }
                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1" htmlFor="set-subtitle">
                  Welcome Screen Description
                </label>
                <textarea
                  id="set-subtitle"
                  rows={3}
                  maxLength={260}
                  required
                  value={settingsDraft.welcomeSubtitle}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, welcomeSubtitle: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1" htmlFor="set-instruction">
                  Instagram Follow &amp; DM Instructions
                </label>
                <textarea
                  id="set-instruction"
                  rows={3}
                  maxLength={280}
                  required
                  value={settingsDraft.instagramInstruction}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, instagramInstruction: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[42px] flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 font-semibold cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Save Public Settings</span>
              </button>
            </form>

            {/* Cloud Town Seed / Sync */}
            <div className="space-y-2 pb-4 border-b border-white/10">
              <h3 className="text-xs font-semibold text-white">Cloud Town Sync</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Initialize or sync all {plots.length} town plots, treasury balance, and welcome
                settings into Cloud Firestore.
              </p>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  await onSeedTownDefaults();
                  setSubmitting(false);
                }}
                className="w-full min-h-[38px] flex items-center justify-center gap-1.5 rounded-lg bg-[#1f2937] hover:bg-[#293548] border border-white/15 text-slate-100 font-medium cursor-pointer disabled:opacity-45"
              >
                <CloudUpload className="w-3.5 h-3.5 text-sky-400" />
                <span>Sync Town Roster &amp; Defaults to Cloud</span>
              </button>
            </div>

            {/* Authorized Admin Roster (/admins) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">
                  Authorized Admin UIDs ({adminEntries.length})
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Grant or revoke Super Admin access by Firebase Auth UID in addition to bootstrapped
                admin emails.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newAdminUid.trim()) return;
                  setSubmitting(true);
                  const ok = await onGrantAdmin(newAdminUid.trim());
                  setSubmitting(false);
                  if (ok) setNewAdminUid('');
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  maxLength={128}
                  value={newAdminUid}
                  onChange={(e) => setNewAdminUid(e.target.value)}
                  placeholder="Firebase Auth UID"
                  className="min-w-0 flex-1 min-h-[36px] px-2.5 py-1 rounded-lg bg-[#1a2029] border border-white/15 text-white placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={submitting || !newAdminUid.trim()}
                  className="px-3 min-h-[36px] flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-slate-950 font-semibold cursor-pointer"
                >
                  <ShieldPlus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>

              {adminEntries.length > 0 && (
                <div className="space-y-1.5">
                  {adminEntries.map((entry) => {
                    const isSelf = entry.uid === currentUserUid;
                    return (
                      <div
                        key={entry.uid}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#19202a] border border-white/10"
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-mono-tabular text-slate-100 truncate">
                            {entry.uid}
                            {isSelf && (
                              <span className="ml-1.5 text-[10px] text-amber-300">(you)</span>
                            )}
                          </div>
                          {entry.grantedAt && (
                            <div className="text-[10px] text-slate-400">
                              Granted {entry.grantedAt}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={submitting || isSelf}
                          title={isSelf ? 'Cannot revoke your own UID' : 'Revoke admin UID'}
                          onClick={async () => {
                            setSubmitting(true);
                            await onRevokeAdmin(entry.uid);
                            setSubmitting(false);
                          }}
                          className="p-1.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-35 text-rose-200 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
