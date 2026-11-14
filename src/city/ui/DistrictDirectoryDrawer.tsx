import React, { useMemo } from 'react';
import { Film, Navigation, Trees, X } from 'lucide-react';
import { ExpansionCityWorld } from '../expansion/ExpansionMasterPlan';
import { ExpansionDistrictId } from '../expansion/types';
import { ARCHETYPE_LABELS } from '../registry/CityRegistry';
import { HouseArchetype } from '../types';

interface DistrictDirectoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  expansionWorld?: ExpansionCityWorld | null;
  onFlyToDistrict: (x: number, z: number, zoom?: number) => void;
  onStartGrandTour: () => void;
}

interface DistrictMeta {
  id: ExpansionDistrictId;
  name: string;
  theme: string;
  dotColor: string;
  focusX: number;
  focusZ: number;
}

const SEVEN_DISTRICTS: DistrictMeta[] = [
  {
    id: 'oakwood-district',
    name: 'Oakwood District',
    theme: 'Woodland Ridges & Timber Terraces',
    dotColor: '#a78bfa',
    focusX: -580,
    focusZ: -450,
  },
  {
    id: 'highland-district',
    name: 'Highland District',
    theme: 'Alpine Pines & Elevated Villas',
    dotColor: '#34d399',
    focusX: 185,
    focusZ: -560,
  },
  {
    id: 'lakeside-district',
    name: 'Lakeside District',
    theme: 'Waterfront Promenades & Lagoons',
    dotColor: '#38bdf8',
    focusX: 790,
    focusZ: -140,
  },
  {
    id: 'greenfield-district',
    name: 'Greenfield District',
    theme: 'Meadow Crescents & Family Homes',
    dotColor: '#84cc16',
    focusX: 520,
    focusZ: 580,
  },
  {
    id: 'central-gardens',
    name: 'Central Gardens',
    theme: 'Botanical Rotunda & Floral Courtyards',
    dotColor: '#f472b6',
    focusX: 160,
    focusZ: 332,
  },
  {
    id: 'maplewood-district',
    name: 'Maplewood District',
    theme: 'Autumn Maples & Heritage Cottages',
    dotColor: '#fb923c',
    focusX: -580,
    focusZ: 500,
  },
  {
    id: 'riverside-district',
    name: 'Riverside District',
    theme: 'Canal Walks & Waterside Townhouses',
    dotColor: '#22d3ee',
    focusX: -735,
    focusZ: 0,
  },
];

export const DistrictDirectoryDrawer: React.FC<DistrictDirectoryDrawerProps> = ({
  isOpen,
  onClose,
  expansionWorld,
  onFlyToDistrict,
  onStartGrandTour,
}) => {
  const districtStats = useMemo(() => {
    const map = new Map<
      ExpansionDistrictId,
      {
        total: number;
        occupied: number;
        openReserve: number;
        styles: Map<HouseArchetype, number>;
      }
    >();
    for (const d of SEVEN_DISTRICTS) {
      map.set(d.id, { total: 0, occupied: 0, openReserve: 0, styles: new Map() });
    }
    if (!expansionWorld) return map;

    for (const p of expansionWorld.plots) {
      const entry = map.get(p.districtId);
      if (!entry) continue;
      entry.total += 1;
      if (p.status === 'expansion-open') {
        entry.openReserve += 1;
      } else {
        entry.occupied += 1;
      }
      if (p.houseStyle) {
        entry.styles.set(
          p.houseStyle.archetype,
          (entry.styles.get(p.houseStyle.archetype) ?? 0) + 1,
        );
      }
    }
    return map;
  }, [expansionWorld]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="district-directory-title"
      className="fixed inset-y-12 right-2 sm:right-3 z-35 w-[calc(100vw-16px)] sm:w-[400px] flex flex-col rounded-xl bg-[#10151c]/96 border border-white/15 shadow-2xl text-slate-100 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <Trees className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <h2 id="district-directory-title" className="text-xs sm:text-sm font-semibold text-white truncate">
              7 Residential Districts Directory
            </h2>
            <p className="text-[10px] text-slate-400 truncate">
              Curved-street neighborhoods outside OG &amp; Historic Core
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close 7-District Directory"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3.5 py-2.5 border-b border-white/10 bg-[#151c25]">
        <button
          type="button"
          onClick={() => {
            onStartGrandTour();
            onClose();
          }}
          className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer"
        >
          <Film className="w-3.5 h-3.5" />
          <span>Launch Grand 7-District Drone Tour</span>
        </button>
      </div>

      <div className="p-3 overflow-y-auto space-y-2.5">
        {SEVEN_DISTRICTS.map((dist) => {
          const st = districtStats.get(dist.id);
          const total = st?.total ?? 0;
          const occupied = st?.occupied ?? 0;
          const openReserve = st?.openReserve ?? 0;
          const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
          const topStyles = st
            ? Array.from(st.styles.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
            : [];

          return (
            <div
              key={dist.id}
              className="p-3 rounded-xl bg-[#161d27] border border-white/10 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dist.dotColor }}
                    />
                    <h3 className="text-xs font-semibold text-white truncate">{dist.name}</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{dist.theme}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onFlyToDistrict(dist.focusX, dist.focusZ, 130);
                    onClose();
                  }}
                  className="h-7 px-2.5 rounded-md bg-[#1f2836] hover:bg-[#2a3649] border border-white/12 text-[11px] font-medium text-sky-200 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Fly</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-300">
                <span>
                  {occupied.toLocaleString()} occupied · {openReserve.toLocaleString()} open
                </span>
                <span className="text-amber-300">{total.toLocaleString()} plots ({pct}%)</span>
              </div>

              <div className="h-1.5 rounded-full bg-[#0e131a] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: dist.dotColor }}
                />
              </div>

              {topStyles.length > 0 && (
                <div className="text-[10px] text-slate-400 truncate">
                  Styles:{' '}
                  {topStyles
                    .map(([arch, count]) => `${ARCHETYPE_LABELS[arch]} (${count})`)
                    .join(' · ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
