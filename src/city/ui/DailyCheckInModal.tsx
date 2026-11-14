import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Flame,
  Footprints,
  Home,
  Lock,
  LogIn,
  Navigation,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { PlotCustomization, PlotUpgradeId, ResidentWallet } from '../types';
import { ExpansionCityWorld } from '../expansion/ExpansionMasterPlan';
import { ExpansionPlotSpec } from '../expansion/types';
import {
  PLOT_UPGRADE_CATALOG,
  computeDailyCheckInReward,
  getPreviousUtcDayString,
  getUtcDayString,
} from '../firebase/firebaseClient';

interface DailyCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSignedIn: boolean;
  currentUserUid: string | null;
  onSignIn: () => void;
  expansionWorld?: ExpansionCityWorld | null;
  selectedExpansionPlot?: ExpansionPlotSpec | null;
  wallet: ResidentWallet | null;
  plotCustomizations: Record<string, PlotCustomization>;
  actionBusy: boolean;
  notice: string | null;
  onClearNotice: () => void;
  onLinkPlot: (plot: ExpansionPlotSpec) => Promise<void>;
  onDailyCheckIn: (plot: ExpansionPlotSpec) => Promise<void>;
  onPurchaseUpgrade: (plot: ExpansionPlotSpec, upgradeId: PlotUpgradeId, cost: number) => Promise<void>;
  onSaveBio: (plot: ExpansionPlotSpec, bio: string) => Promise<void>;
  onFlyToPlot: (plot: ExpansionPlotSpec) => void;
  onWalkToPlot: (plot: ExpansionPlotSpec) => void;
}

export const DailyCheckInModal: React.FC<DailyCheckInModalProps> = ({
  isOpen,
  onClose,
  isSignedIn,
  currentUserUid,
  onSignIn,
  expansionWorld,
  selectedExpansionPlot,
  wallet,
  plotCustomizations,
  actionBusy,
  notice,
  onClearNotice,
  onLinkPlot,
  onDailyCheckIn,
  onPurchaseUpgrade,
  onSaveBio,
  onFlyToPlot,
  onWalkToPlot,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bioDraft, setBioDraft] = useState('');

  const linkedPlot = useMemo<ExpansionPlotSpec | null>(() => {
    if (!expansionWorld) return null;
    if (wallet?.linkedPlotId) {
      const found = expansionWorld.plotById.get(wallet.linkedPlotId);
      if (found) return found;
    }
    if (
      selectedExpansionPlot &&
      selectedExpansionPlot.status !== 'vip' &&
      selectedExpansionPlot.status !== 'expansion-open'
    ) {
      return selectedExpansionPlot;
    }
    return null;
  }, [expansionWorld, wallet?.linkedPlotId, selectedExpansionPlot]);

  const activeCustomization = linkedPlot ? plotCustomizations[linkedPlot.plotId] ?? null : null;

  useEffect(() => {
    setBioDraft(activeCustomization?.bio ?? '');
  }, [linkedPlot?.plotId, activeCustomization?.bio]);

  const searchResults = useMemo(() => {
    if (!expansionWorld || !pickerOpen) return [];
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    const pool = expansionWorld.plots.filter(
      (p) => p.status !== 'vip' && p.status !== 'expansion-open' && p.resident,
    );
    if (!q) return pool.slice(0, 12);
    const out: ExpansionPlotSpec[] = [];
    for (const p of pool) {
      const uname = p.resident?.usernameKey ?? '';
      const code = p.plotCode.toLowerCase();
      if (uname.includes(q) || code.includes(q) || p.districtName.toLowerCase().includes(q)) {
        out.push(p);
        if (out.length >= 16) break;
      }
    }
    return out;
  }, [expansionWorld, pickerOpen, searchQuery]);

  if (!isOpen) return null;

  const todayUtc = getUtcDayString();
  const yesterdayUtc = getPreviousUtcDayString(todayUtc);
  const checkedInToday = wallet?.lastCheckInDay === todayUtc;
  const effectiveStreak =
    wallet?.lastCheckInDay === todayUtc
      ? wallet.streakDays
      : wallet?.lastCheckInDay === yesterdayUtc
        ? wallet.streakDays
        : 0;
  const nextStreak = checkedInToday ? effectiveStreak : effectiveStreak + 1;
  const nextReward = computeDailyCheckInReward(nextStreak);

  const isLockedByOtherOwner = Boolean(
    activeCustomization &&
      currentUserUid &&
      activeCustomization.ownerUid &&
      activeCustomization.ownerUid !== currentUserUid,
  );

  const isUpgradeOwned = (id: PlotUpgradeId): boolean => {
    if (!activeCustomization) return false;
    if (id === 'driveway-lights') return activeCustomization.hasDrivewayLights;
    if (id === 'flower-planters') return activeCustomization.hasFlowerPlanters;
    if (id === 'garden-fountain') return activeCustomization.hasGardenFountain;
    return activeCustomization.hasFestiveGarland;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-checkin-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#090d14]/70 p-3"
    >
      <div className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-xl bg-[#10151c]/96 border border-white/15 shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 id="daily-checkin-title" className="text-sm sm:text-base font-semibold text-white truncate">
                Resident Daily Check-In &amp; Plot Upgrades
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Sign in at your house plot daily to earn LDF Coins for 3D upgrades
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Daily Check-In"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {notice && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#19222d] border border-amber-400/35 text-xs text-amber-200">
              <span>{notice}</span>
              <button
                type="button"
                onClick={onClearNotice}
                className="p-0.5 text-amber-300 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {!isSignedIn ? (
            <div className="p-4 rounded-xl bg-[#161d27] border border-amber-400/30 space-y-3">
              <div className="flex items-start gap-2.5">
                <Home className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-white">
                    Sign In to Track Your Resident Wallet
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Google Sign-In secures your LDF Coin balance, daily UTC check-in streak, and 3D plot customizations across sessions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onSignIn}
                className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In with Google</span>
              </button>
            </div>
          ) : (
            <>
              {/* Wallet & Streak Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-[#161d27] border border-white/10">
                  <div className="text-[10px] text-slate-400">LDF Balance</div>
                  <div className="text-base sm:text-lg font-semibold text-amber-300 font-mono-tabular mt-0.5">
                    {(wallet?.balance ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#161d27] border border-white/10">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span>Streak</span>
                  </div>
                  <div className="text-base sm:text-lg font-semibold text-white font-mono-tabular mt-0.5">
                    {effectiveStreak}d
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#161d27] border border-white/10">
                  <div className="text-[10px] text-slate-400">Total Check-Ins</div>
                  <div className="text-base sm:text-lg font-semibold text-emerald-300 font-mono-tabular mt-0.5">
                    {wallet?.totalCheckIns ?? 0}
                  </div>
                </div>
              </div>

              {/* 7-Day Streak Ladder */}
              <div className="p-3 rounded-xl bg-[#161d27] border border-white/10">
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className="font-medium text-slate-200">7-Day Check-In Bonus Ladder</span>
                  <span className="text-slate-400 font-mono-tabular">UTC {todayUtc}</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                    const rewardVal = computeDailyCheckInReward(dayNum);
                    const completed = effectiveStreak >= dayNum;
                    const isNext = !checkedInToday && Math.min(7, nextStreak) === dayNum;
                    return (
                      <div
                        key={dayNum}
                        className={`py-1.5 px-1 rounded-md border text-center ${
                          completed
                            ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-200'
                            : isNext
                              ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                              : 'bg-[#10151c] border-white/10 text-slate-400'
                        }`}
                      >
                        <div className="text-[9px] font-medium">D{dayNum}</div>
                        <div className="text-[10px] font-mono-tabular font-semibold">+{rewardVal}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Linked Plot Selector */}
              <div className="p-3 rounded-xl bg-[#161d27] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-white">Your Linked House Plot</div>
                  <button
                    type="button"
                    onClick={() => setPickerOpen((v) => !v)}
                    className="text-[11px] font-medium text-sky-300 hover:text-sky-200 cursor-pointer"
                  >
                    {pickerOpen ? 'Hide Search' : linkedPlot ? 'Change Plot' : 'Select Your @username'}
                  </button>
                </div>

                {linkedPlot ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-[#10151c] border border-white/10">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {linkedPlot.resident ? `@${linkedPlot.resident.username}` : linkedPlot.plotCode}
                        <span className="text-slate-400 font-normal"> · {linkedPlot.plotCode}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {linkedPlot.districtName} · {linkedPlot.address}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onFlyToPlot(linkedPlot);
                          onClose();
                        }}
                        className="h-7 px-2 rounded-md bg-[#1a222d] hover:bg-[#243040] border border-white/12 text-[11px] text-slate-100 flex items-center gap-1 cursor-pointer"
                      >
                        <Navigation className="w-3 h-3 text-sky-300" />
                        <span>Fly</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onWalkToPlot(linkedPlot);
                          onClose();
                        }}
                        className="h-7 px-2 rounded-md bg-amber-500 hover:bg-amber-400 text-[11px] font-semibold text-slate-950 flex items-center gap-1 cursor-pointer"
                      >
                        <Footprints className="w-3 h-3" />
                        <span>Walk</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-300">
                    Search your Instagram <span className="text-amber-300">@username</span> or{' '}
                    <span className="text-amber-300">LDF-xxxx</span> plot code below to link your house.
                  </p>
                )}

                {selectedExpansionPlot &&
                  selectedExpansionPlot.status !== 'vip' &&
                  selectedExpansionPlot.status !== 'expansion-open' &&
                  selectedExpansionPlot.plotId !== linkedPlot?.plotId && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void onLinkPlot(selectedExpansionPlot)}
                      className="w-full h-8 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-[11px] font-semibold text-sky-200 cursor-pointer disabled:opacity-50"
                    >
                      Link Currently Selected Plot ({selectedExpansionPlot.plotCode} · @
                      {selectedExpansionPlot.resident?.username ?? 'Resident'})
                    </button>
                  )}

                {(pickerOpen || !linkedPlot) && (
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onFocus={() => setPickerOpen(true)}
                        onChange={(e) => {
                          setPickerOpen(true);
                          setSearchQuery(e.target.value);
                        }}
                        placeholder="Search @username, LDF-0142, or district..."
                        className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#10151c] border border-white/15 text-xs text-white placeholder:text-slate-500"
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div className="max-h-36 overflow-y-auto divide-y divide-white/8 rounded-lg border border-white/10 bg-[#10151c]">
                        {searchResults.map((p) => (
                          <button
                            key={p.plotId}
                            type="button"
                            disabled={actionBusy}
                            onClick={async () => {
                              await onLinkPlot(p);
                              setPickerOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-white/6 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-white truncate">
                                @{p.resident?.username}{' '}
                                <span className="text-amber-300 font-mono-tabular">· {p.plotCode}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {p.districtName} · {p.address}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-sky-300 shrink-0">Link</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {linkedPlot && (
                  <button
                    type="button"
                    disabled={actionBusy || checkedInToday}
                    onClick={() => void onDailyCheckIn(linkedPlot)}
                    className={`w-full h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                      checkedInToday
                        ? 'bg-emerald-500/18 border border-emerald-400/35 text-emerald-200 cursor-default'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer disabled:opacity-50'
                    }`}
                  >
                    {checkedInToday ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Checked In Today · Next Reward Resets 00:00 UTC</span>
                      </>
                    ) : (
                      <>
                        <Coins className="w-4 h-4" />
                        <span>Check In at {linkedPlot.plotCode} Today (+{nextReward} LDF)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Plot Upgrades & Bio (only when plot is linked) */}
              {linkedPlot && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>3D Residential Plot Upgrades</span>
                      </h3>
                      {isLockedByOtherOwner && (
                        <span className="text-[10px] text-amber-300 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Claimed by another account</span>
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PLOT_UPGRADE_CATALOG.map((item) => {
                        const owned = isUpgradeOwned(item.id);
                        const canAfford = (wallet?.balance ?? 0) >= item.cost;
                        return (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-lg bg-[#161d27] border border-white/10 flex flex-col justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-white">{item.name}</span>
                                <span className="text-[11px] font-mono-tabular text-amber-300 shrink-0">
                                  {item.cost} LDF
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                {item.description}
                              </p>
                            </div>
                            {owned ? (
                              <div className="h-7 rounded-md bg-emerald-500/18 border border-emerald-400/35 text-[11px] font-semibold text-emerald-200 flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Installed in 3D</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={actionBusy || !canAfford || isLockedByOtherOwner}
                                onClick={() => void onPurchaseUpgrade(linkedPlot, item.id, item.cost)}
                                className="h-7 rounded-md bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 text-[11px] font-semibold cursor-pointer"
                              >
                                {canAfford ? `Unlock (${item.cost} LDF)` : `Need ${item.cost} LDF`}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Greeting Bio Editor */}
                  <form
                    className="p-3 rounded-xl bg-[#161d27] border border-white/10 space-y-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await onSaveBio(linkedPlot, bioDraft);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <label htmlFor="plot-bio-input" className="text-xs font-semibold text-white">
                        House Greeting Card (Visible to Visitors)
                      </label>
                      <span className="text-[10px] font-mono-tabular text-slate-400">
                        {bioDraft.length}/160
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        id="plot-bio-input"
                        type="text"
                        maxLength={160}
                        disabled={isLockedByOtherOwner || actionBusy}
                        value={bioDraft}
                        onChange={(e) => setBioDraft(e.target.value)}
                        placeholder="Welcome to my Lindenhof home! Sign the guestbook below."
                        className="min-w-0 flex-1 h-8 px-2.5 rounded-lg bg-[#10151c] border border-white/15 text-xs text-white placeholder:text-slate-500 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={isLockedByOtherOwner || actionBusy}
                        className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-slate-950 text-xs font-semibold cursor-pointer shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
