import React, { useMemo, useState } from 'react';
import { Award, Crown, Footprints, Navigation, Search, X } from 'lucide-react';
import { ExpansionPlotSpec } from '../expansion/types';
import { VIP_DISPLAY_LABEL } from '../expansion/zipFollowerParser';

interface OGMonumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  vipPlot: ExpansionPlotSpec | null;
  ogPlots: ExpansionPlotSpec[];
  onVisitPlot: (plot: ExpansionPlotSpec, mode: 'fly' | 'walk') => void;
}

export const OGMonumentModal: React.FC<OGMonumentModalProps> = ({
  isOpen,
  onClose,
  vipPlot,
  ogPlots,
  onVisitPlot,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    const list = [...ogPlots].sort(
      (a, b) => (a.resident?.ogRank ?? 99) - (b.resident?.ogRank ?? 99),
    );
    if (!q) return list;
    return list.filter((p) => {
      const r = p.resident;
      if (!r) return false;
      return (
        r.usernameKey.includes(q) ||
        r.residentId.toLowerCase().includes(q) ||
        p.plotCode.toLowerCase().includes(q)
      );
    });
  }, [ogPlots, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-3">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-950/80 via-slate-950 to-slate-950 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-400/40">
              <Award className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Lindenhof 50 OG Founders Recognition Monument
              </h2>
              <p className="text-xs text-amber-200/80">
                Verified Oldest 49 Followers + Special #1 Royal Sovereign Honoree
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero Special Number One Card */}
        {vipPlot && vipPlot.resident && (
          <div className="p-4 bg-gradient-to-br from-amber-500/15 via-yellow-900/15 to-slate-900 border-b border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-300">
                  Special Number One Honoree · Central Royal VIP Estate
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-2.5">
                <h3 className="text-xl font-extrabold text-white">{VIP_DISPLAY_LABEL}</h3>
                <span className="text-xs font-mono text-amber-300">
                  @{vipPlot.resident.username} · {vipPlot.plotCode} · {vipPlot.resident.residentId}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Verified Join Date: <span className="text-white font-semibold">{vipPlot.resident.joinedAt}</span>
                {' · '}Chronological Oldest Rank #{vipPlot.resident.oldestRank}
                {' · '}1 Royal Crown Plaza
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  onVisitPlot(vipPlot, 'fly');
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                Fly to Palace
              </button>
              <button
                onClick={() => {
                  onVisitPlot(vipPlot, 'walk');
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-amber-400/50 text-amber-200 text-xs font-semibold cursor-pointer"
              >
                <Footprints className="w-3.5 h-3.5" />
                Walk to Palace
              </button>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter OG 50 members by username or plot code..."
              className="w-full pl-8 pr-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <span className="text-xs font-mono text-slate-400">
            Showing {filtered.length} / {ogPlots.length} OG Members
          </span>
        </div>

        {/* Scrollable 50 OG Roster Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filtered.map((p) => {
            const r = p.resident;
            if (!r) return null;
            const isVip = p.status === 'vip';
            return (
              <div
                key={p.plotId}
                className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                  isVip
                    ? 'bg-amber-950/40 border-yellow-500/60'
                    : 'bg-slate-950/70 border-slate-800 hover:border-amber-500/40'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isVip ? 'bg-yellow-400 text-slate-950' : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      #{String(r.ogRank ?? 0).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-bold text-white truncate">
                      {isVip ? VIP_DISPLAY_LABEL : `@${r.username}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {r.residentId} · {p.plotCode} · Joined {r.joinedAt}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{p.address}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      onVisitPlot(p, 'fly');
                      onClose();
                    }}
                    className="p-1.5 rounded bg-sky-600/80 hover:bg-sky-500 text-white cursor-pointer"
                    title="Fly to Mansion"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      onVisitPlot(p, 'walk');
                      onClose();
                    }}
                    className="p-1.5 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white cursor-pointer"
                    title="Walk to Mansion"
                  >
                    <Footprints className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
