import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Hammer,
  Home,
  MapPin,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
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

export type AdminPanelTab = 'residents' | 'builder' | 'settings';

interface AdminPanelProps {
  open: boolean;
  activeTab: AdminPanelTab;
  plots: TownPlot[];
  residentRecords: Record<string, PrivateResidentRecord>;
  townSettings: TownPublicSettings;
  constructionDraft: ConstructionDraft;
  editorFeedback: string | null;
  adminActionNotice: string | null;
  onChangeTab: (tab: AdminPanelTab) => void;
  onClose: () => void;
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
  onSaveTownSettings: (settings: TownPublicSettings) => Promise<boolean>;
  onUpdateConstructionDraft: (patch: Partial<ConstructionDraft>) => void;
  onConfirmConstruction: () => void;
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
  residentRecords,
  townSettings,
  constructionDraft,
  editorFeedback,
  adminActionNotice,
  onChangeTab,
  onClose,
  onFocusLocation,
  onSelectPlot,
  onApproveResident,
  onReassignResident,
  onRevokeResident,
  onSaveTownSettings,
  onUpdateConstructionDraft,
  onConfirmConstruction,
}) => {
  // Resident approval form state
  const [assignPlotId, setAssignPlotId] = useState<string>('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [inGameUsername, setInGameUsername] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignArchetype, setAssignArchetype] = useState<HouseArchetype>('cottage');
  const [residentSearch, setResidentSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline edit / revoke state for existing residents
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [confirmRevokePlotId, setConfirmRevokePlotId] = useState<string | null>(null);

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
        (rec?.instagramHandle ?? '').toLowerCase().includes(q)
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
      <div className="grid grid-cols-3 gap-1 p-1.5 bg-[#161c24] border-b border-white/10">
        {(
          [
            { id: 'residents', label: 'Residents', Icon: UserCheck },
            { id: 'builder', label: 'Builder', Icon: Hammer },
            { id: 'settings', label: 'Settings', Icon: Settings },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChangeTab(id)}
            className={`min-h-[38px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === id
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
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
                        maxLength={24}
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
                  value={residentSearch}
                  onChange={(e) => setResidentSearch(e.target.value)}
                  placeholder="Filter by plot, username, or @instagram"
                  className="w-full min-h-[38px] pl-8 pr-2.5 py-1.5 rounded-lg bg-[#1a2029] border border-white/15 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                {occupiedResidentialPlots.map((plot) => {
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
                            maxLength={24}
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
                })}
              </div>
            </div>
          </>
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
          </div>
        )}

        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettingsSubmit} className="space-y-3">
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
        )}
      </div>
    </aside>
  );
};
