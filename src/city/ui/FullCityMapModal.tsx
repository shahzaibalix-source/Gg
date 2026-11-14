import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Compass,
  Crown,
  Footprints,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Search,
  Sparkles,
  Trees,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { TownPlot } from '../types';
import { ExpansionCityWorld } from '../expansion/ExpansionMasterPlan';
import { ExpansionDistrictId, ExpansionPlotSpec } from '../expansion/types';

interface FullCityMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  corePlots: TownPlot[];
  expansionWorld: ExpansionCityWorld;
  playerPose: { x: number; z: number };
  onFlyTo: (
    x: number,
    z: number,
    expansionPlot?: ExpansionPlotSpec,
    corePlot?: TownPlot,
  ) => void;
  onWalkTo: (
    x: number,
    z: number,
    expansionPlot?: ExpansionPlotSpec,
    corePlot?: TownPlot,
  ) => void;
  onOpenMonument: () => void;
}

type TierFilter = 'all' | 'og' | 'occupied' | 'open';

export const FullCityMapModal: React.FC<FullCityMapModalProps> = ({
  isOpen,
  onClose,
  corePlots,
  expansionWorld,
  playerPose,
  onFlyTo,
  onWalkTo,
  onOpenMonument,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<ExpansionDistrictId | 'core' | 'all'>(
    'all',
  );
  const [selectedExpansionPlot, setSelectedExpansionPlot] = useState<ExpansionPlotSpec | null>(
    expansionWorld.vipPlot,
  );
  const [selectedCorePlot, setSelectedCorePlot] = useState<TownPlot | null>(null);

  // View transform in world meters
  const [view, setView] = useState<{ cx: number; cz: number; scale: number }>({
    cx: 20,
    cz: 0,
    scale: 0.34, // px per meter
  });

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origCx: number;
    origCz: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, origCx: 20, origCz: 0, moved: false });

  const fitFullCity = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      setView({ cx: 20, cz: 0, scale: 0.34 });
      return;
    }
    const w = el.clientWidth || 900;
    const h = el.clientHeight || 600;
    const scaleX = (w - 40) / 2280;
    const scaleY = (h - 40) / 1720;
    setView({ cx: 20, cz: 0, scale: Math.max(0.15, Math.min(scaleX, scaleY)) });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(fitFullCity, 40);
    return () => window.clearTimeout(timer);
  }, [isOpen, isFullscreen, fitFullCity]);

  const jumpToDistrict = (id: ExpansionDistrictId | 'core' | 'all') => {
    setSelectedDistrict(id);
    if (id === 'all') {
      fitFullCity();
      return;
    }
    if (id === 'core') {
      setView({ cx: 0, cz: 0, scale: 2.1 });
      return;
    }
    const d = expansionWorld.districts.find((dz) => dz.id === id);
    if (d) {
      setView({
        cx: d.center.x,
        cz: d.center.z,
        scale: id === 'og-premium-district' ? 1.45 : id === 'botanical-gardens' || id === 'waterfront-lake-district' ? 1.5 : 0.9,
      });
    }
  };

  // Search results across all 3,447+ followers + 795 expansion plots + core plots
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q && selectedDistrict === 'all' && tierFilter === 'all') {
      return expansionWorld.ogPlots.slice(0, 18).map((ep) => ({
        key: ep.plotId,
        title: ep.resident ? `@${ep.resident.username}` : ep.plotCode,
        subtitle: `${ep.plotCode} · ${ep.resident?.residentId ?? ''} · ${ep.districtName}`,
        badge: ep.status === 'vip' ? 'VIP #1' : `OG #${ep.resident?.ogRank ?? ''}`,
        x: ep.x,
        z: ep.z,
        expPlot: ep as ExpansionPlotSpec | undefined,
        corePlot: undefined as TownPlot | undefined,
      }));
    }

    const matches: Array<{
      key: string;
      title: string;
      subtitle: string;
      badge: string;
      x: number;
      z: number;
      expPlot?: ExpansionPlotSpec;
      corePlot?: TownPlot;
    }> = [];

    // Core plots search
    if (selectedDistrict === 'all' || selectedDistrict === 'core') {
      if (tierFilter === 'all' || tierFilter === 'occupied') {
        for (const cp of corePlots) {
          const hay = `${cp.plotCode} ${cp.ownerUsername ?? ''} ${cp.business?.name ?? ''} ${cp.publicBuilding?.name ?? ''} ${cp.address}`.toLowerCase();
          if (q && !hay.includes(q)) continue;
          matches.push({
            key: `core-${cp.id}`,
            title: cp.publicBuilding?.name ?? cp.business?.name ?? (cp.ownerUsername ? `@${cp.ownerUsername}` : cp.plotCode),
            subtitle: `${cp.plotCode} · ${cp.address}`,
            badge: 'CORE TOWN',
            x: cp.center.x,
            z: cp.center.z,
            corePlot: cp,
          });
          if (matches.length >= 45) return matches;
        }
      }
    }

    // Expansion plots search
    for (const ep of expansionWorld.plots) {
      if (selectedDistrict !== 'all' && selectedDistrict !== 'core' && ep.districtId !== selectedDistrict) {
        continue;
      }
      if (tierFilter === 'og' && ep.status !== 'vip' && ep.status !== 'og') continue;
      if (tierFilter === 'occupied' && ep.status === 'expansion-open') continue;
      if (tierFilter === 'open' && ep.status !== 'expansion-open') continue;

      if (q) {
        const hay = `${ep.resident?.username ?? ''} ${ep.resident?.residentId ?? ''} ${ep.plotCode} ${ep.districtName}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      matches.push({
        key: ep.plotId,
        title: ep.resident ? `@${ep.resident.username}` : `Open Parcel ${ep.plotCode}`,
        subtitle: `${ep.plotCode} · ${ep.resident?.residentId ?? 'Future Reserve'} · ${ep.districtName}`,
        badge:
          ep.status === 'vip'
            ? 'VIP #1'
            : ep.status === 'og'
              ? `OG #${ep.resident?.ogRank ?? ''}`
              : ep.status === 'occupied'
                ? 'RESIDENT'
                : 'OPEN',
        x: ep.x,
        z: ep.z,
        expPlot: ep,
      });

      if (matches.length >= 45) break;
    }

    return matches;
  }, [searchQuery, selectedDistrict, tierFilter, corePlots, expansionWorld]);

  // Draw crisp 2D Bird's-Eye Canvas Map
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = container.clientWidth || 900;
    const h = container.clientHeight || 600;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const toPx = (wx: number, wz: number) => ({
      x: w / 2 + (wx - view.cx) * view.scale,
      y: h / 2 + (wz - view.cz) * view.scale,
    });

    // Background countryside meadow
    ctx.fillStyle = '#0c1816';
    ctx.fillRect(0, 0, w, h);

    // Subtle metric grid when zoomed out
    ctx.strokeStyle = 'rgba(148,163,184,0.06)';
    ctx.lineWidth = 1;
    const step = 140;
    for (let gx = -1120; gx <= 1120; gx += step) {
      const p1 = toPx(gx, -840);
      const p2 = toPx(gx, 840);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let gz = -840; gz <= 840; gz += step) {
      const p1 = toPx(-1120, gz);
      const p2 = toPx(1120, gz);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Eastern scenic river along countryside border (X = 1235)
    const riverStart = toPx(1210, -1200);
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(riverStart.x, 0, Math.max(6, 56 * view.scale), h);

    // 8 Expansion District Backdrops
    for (const d of expansionWorld.districts) {
      const tl = toPx(d.bounds.minX, d.bounds.minZ);
      const br = toPx(d.bounds.maxX, d.bounds.maxZ);
      ctx.fillStyle = `${d.color}18`;
      ctx.strokeStyle = `${d.color}55`;
      ctx.lineWidth = 1.5;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // Historic Original Lindenhof Core Footprint
    {
      const tl = toPx(-140, -130);
      const br = toPx(140, 130);
      ctx.fillStyle = 'rgba(248,250,252,0.1)';
      ctx.strokeStyle = 'rgba(248,250,252,0.45)';
      ctx.lineWidth = 1.8;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // Royal Crescent Gardens Behind Sweet_thedevil VIP Palace
    {
      const tl = toPx(-28, -320);
      const br = toPx(28, -248);
      ctx.fillStyle = '#15803d88';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // 6 Unique District Parks
    for (const pk of expansionWorld.districtParks) {
      const tl = toPx(pk.x - pk.width / 2, pk.z - pk.depth / 2);
      const br = toPx(pk.x + pk.width / 2, pk.z + pk.depth / 2);
      ctx.fillStyle = 'rgba(22,163,74,0.42)';
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.2;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      if (view.scale >= 0.45) {
        const c = toPx(pk.x, pk.z);
        ctx.fillStyle = '#bbf7d0';
        ctx.font = '600 9.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pk.name.replace(' Park', ''), c.x, c.y + 3);
      }
    }

    // Grand Central Botanical Conservatory & Grand Waterfront Lake + Scenic Garden Island
    {
      const bot = toPx(236, 0);
      ctx.fillStyle = 'rgba(16,185,129,0.28)';
      ctx.beginPath();
      ctx.arc(bot.x, bot.y, 24 * view.scale, 0, Math.PI * 2);
      ctx.fill();

      const lakeTL = toPx(367, -120);
      const lakeBR = toPx(541, 120);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(lakeTL.x, lakeTL.y, lakeBR.x - lakeTL.x, lakeBR.y - lakeTL.y);

      // Dual Island Footbridge + Central Garden Island (X=468, Z=0)
      const brTL = toPx(366, -2.8);
      const brBR = toPx(542, 2.8);
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(brTL.x, brTL.y, brBR.x - brTL.x, Math.max(2, brBR.y - brTL.y));

      const islTL = toPx(446, -29);
      const islBR = toPx(490, 29);
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#e7e5e4';
      ctx.lineWidth = 1.2;
      ctx.fillRect(islTL.x, islTL.y, islBR.x - islTL.x, islBR.y - islTL.y);
      ctx.strokeRect(islTL.x, islTL.y, islBR.x - islTL.x, islBR.y - islTL.y);
    }

    // 4 Venice Waterways with Stone Embankments
    ctx.lineCap = 'butt';
    for (const c of expansionWorld.canals) {
      const p1 = toPx(c.x1, c.z1);
      const p2 = toPx(c.x2, c.z2);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(3, (c.width + 3) * view.scale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = Math.max(2, c.width * view.scale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Road Network (including Curved Grand Panoramic Ring Boulevard)
    for (const r of expansionWorld.roads) {
      const p1 = toPx(r.x1, r.z1);
      const p2 = toPx(r.x2, r.z2);
      if (Math.max(p1.x, p2.x) < 0 || Math.min(p1.x, p2.x) > w) continue;
      if (Math.max(p1.y, p2.y) < 0 || Math.min(p1.y, p2.y) > h) continue;
      ctx.strokeStyle = r.isMainAvenue ? '#64748b' : '#334155';
      ctx.lineWidth = Math.max(1, r.width * view.scale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 35 Venetian Canal Bridges Drawn Over Canals
    for (const b of expansionWorld.bridges) {
      const isNSRot = Math.abs(b.rotY) < 0.4;
      const hx = isNSRot ? b.length / 2 : b.width / 2;
      const hz = isNSRot ? b.width / 2 : b.length / 2;
      const tl = toPx(b.x - hx, b.z - hz);
      const br = toPx(b.x + hx, b.z + hz);
      ctx.fillStyle = b.kind === 'pedestrian' ? '#eab308' : '#94a3b8';
      ctx.fillRect(tl.x, tl.y, Math.max(2, br.x - tl.x), Math.max(2, br.y - tl.y));
    }

    // All 4,242 Expansion Plots
    for (const ep of expansionWorld.plots) {
      if (tierFilter === 'og' && ep.status !== 'vip' && ep.status !== 'og') continue;
      if (tierFilter === 'occupied' && ep.status === 'expansion-open') continue;
      if (tierFilter === 'open' && ep.status !== 'expansion-open') continue;

      const p = toPx(ep.x, ep.z);
      if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;

      const pw = Math.max(2.6, (ep.width - 1.4) * view.scale);
      const pd = Math.max(2.6, (ep.depth - 1.4) * view.scale);

      ctx.fillStyle =
        ep.status === 'vip'
          ? '#facc15'
          : ep.status === 'og'
            ? '#f59e0b'
            : ep.status === 'occupied'
              ? '#2dd4bf'
              : '#4d7c0f';
      ctx.fillRect(p.x - pw / 2, p.y - pd / 2, pw, pd);

      // Show Instagram username directly on map when zoomed in!
      if ((view.scale >= 1.75 || ep.status === 'vip') && (ep.resident || view.scale >= 2.2)) {
        const label = ep.resident ? `@${ep.resident.username}` : ep.plotCode;
        ctx.fillStyle = ep.status === 'vip' ? '#fef08a' : '#f8fafc';
        ctx.font = ep.status === 'vip' ? '700 11px sans-serif' : '600 9.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, p.x, p.y + pd / 2 + 10);
      }
    }

    // Core Lindenhof 36 Plots
    for (const cp of corePlots) {
      const p = toPx(cp.center.x, cp.center.z);
      if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;
      const pw = Math.max(3, cp.width * view.scale);
      const pd = Math.max(3, cp.depth * view.scale);
      ctx.fillStyle = cp.publicBuilding
        ? '#e2e8f0'
        : cp.business
          ? '#fb923c'
          : cp.ownerUsername
            ? '#60a5fa'
            : '#475569';
      ctx.fillRect(p.x - pw / 2, p.y - pd / 2, pw, pd);
      if (view.scale >= 1.9) {
        const label = cp.publicBuilding?.name ?? cp.business?.name ?? cp.ownerUsername ?? cp.plotCode;
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 9.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, p.x, p.y + 3);
      }
    }

    // District Titles overlay
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'center';
    for (const d of expansionWorld.districts) {
      const c = toPx(d.center.x, d.center.z);
      if (c.x < -120 || c.x > w + 120 || c.y < -60 || c.y > h + 60) continue;
      ctx.fillStyle = 'rgba(15,23,42,0.78)';
      const tw = ctx.measureText(d.name).width + 14;
      ctx.fillRect(c.x - tw / 2, c.y - 11, tw, 18);
      ctx.fillStyle = d.color;
      ctx.fillText(d.name, c.x, c.y + 2);
    }
    {
      const c = toPx(0, 0);
      ctx.fillStyle = 'rgba(15,23,42,0.82)';
      ctx.fillRect(c.x - 62, c.y - 11, 124, 18);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('Historic Core City', c.x, c.y + 2);
    }

    // Selected Highlight Marker
    const selCoord = selectedExpansionPlot
      ? { x: selectedExpansionPlot.x, z: selectedExpansionPlot.z }
      : selectedCorePlot
        ? selectedCorePlot.center
        : null;
    if (selCoord) {
      const sp = toPx(selCoord.x, selCoord.z);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, Math.max(10, 13 * view.scale), 0, Math.PI * 2);
      ctx.stroke();
    }

    // 10 Covered Bus Stop Transit Shelters
    for (const bs of expansionWorld.busStops) {
      const bp = toPx(bs.x, bs.z);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, Math.max(3.5, 4.5 * view.scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Current Player Location Marker
    {
      const pp = toPx(playerPose.x, playerPose.z);
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [
    isOpen,
    view,
    expansionWorld,
    corePlots,
    tierFilter,
    selectedExpansionPlot,
    selectedCorePlot,
    playerPose,
  ]);

  const handleCanvasClick = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const wx = view.cx + (px - rect.width / 2) / view.scale;
    const wz = view.cz + (py - rect.height / 2) / view.scale;

    // Check Core Plots first if near core
    let bestDistSq = Infinity;
    let hitCore: TownPlot | null = null;
    let hitExp: ExpansionPlotSpec | null = null;

    if (Math.abs(wx) <= 145 && Math.abs(wz) <= 135) {
      for (const cp of corePlots) {
        const dSq = (cp.center.x - wx) ** 2 + (cp.center.z - wz) ** 2;
        if (dSq < bestDistSq && dSq <= 450) {
          bestDistSq = dSq;
          hitCore = cp;
        }
      }
    }

    for (const ep of expansionWorld.plots) {
      const dSq = (ep.x - wx) ** 2 + (ep.z - wz) ** 2;
      if (dSq < bestDistSq && dSq <= Math.max(900, (22 / view.scale) ** 2)) {
        bestDistSq = dSq;
        hitExp = ep;
        hitCore = null;
      }
    }

    if (hitExp) {
      setSelectedExpansionPlot(hitExp);
      setSelectedCorePlot(null);
    } else if (hitCore) {
      setSelectedCorePlot(hitCore);
      setSelectedExpansionPlot(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-2 sm:p-4">
      <div
        className={`bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden transition-all ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-[1380px] h-[92vh] rounded-xl'
        }`}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                Lindenhof Complete City Master Map
              </h2>
              <p className="text-[11px] text-slate-400">
                {expansionWorld.counts.residentHouseCount + expansionWorld.counts.ogCount} Follower Houses
                {' · '}50 OG Luxury Villas{' · '}Sweet_thedevil VIP #1{' · '}
                {expansionWorld.counts.openExpansionCount} Expansion Reserve Plots
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenMonument}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              OG 50 Monument
            </button>
            <button
              onClick={() => setIsFullscreen((f) => !f)}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title={isFullscreen ? 'Restore Size' : 'Expand Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-700 cursor-pointer"
              title="Close Map"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* District Navigation Ribbon */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-900/95 border-b border-slate-800 overflow-x-auto">
          <button
            onClick={() => jumpToDistrict('all')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
              selectedDistrict === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Full City View
          </button>
          <button
            onClick={() => jumpToDistrict('core')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
              selectedDistrict === 'core'
                ? 'bg-slate-100 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Town Square & Shops
          </button>
          {expansionWorld.districts.map((d) => (
            <button
              key={d.id}
              onClick={() => jumpToDistrict(d.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap border cursor-pointer ${
                selectedDistrict === d.id
                  ? 'bg-slate-800 text-white border-amber-400'
                  : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {d.name.replace(' District', '').replace(' European Quarter', '')}
            </button>
          ))}
        </div>

        {/* Main Split Body */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Interactive Map Canvas */}
          <div ref={containerRef} className="relative flex-1 min-h-[300px] bg-slate-950 overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-full block cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => {
                dragRef.current = {
                  active: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  origCx: view.cx,
                  origCz: view.cz,
                  moved: false,
                };
              }}
              onMouseMove={(e) => {
                if (!dragRef.current.active) return;
                const dx = e.clientX - dragRef.current.startX;
                const dy = e.clientY - dragRef.current.startY;
                if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true;
                setView((v) => ({
                  ...v,
                  cx: dragRef.current.origCx - dx / v.scale,
                  cz: dragRef.current.origCz - dy / v.scale,
                }));
              }}
              onMouseUp={(e) => {
                const wasClick = dragRef.current.active && !dragRef.current.moved;
                dragRef.current.active = false;
                if (wasClick) handleCanvasClick(e.clientX, e.clientY);
              }}
              onMouseLeave={() => {
                dragRef.current.active = false;
              }}
              onWheel={(e) => {
                e.preventDefault();
                const factor = e.deltaY < 0 ? 1.18 : 0.85;
                setView((v) => ({
                  ...v,
                  scale: Math.max(0.15, Math.min(5.0, v.scale * factor)),
                }));
              }}
            />

            {/* Floating Map Zoom & Locate Controls */}
            <div className="absolute top-3 right-3 flex flex-col gap-1.5">
              <button
                onClick={() => setView((v) => ({ ...v, scale: Math.min(5.0, v.scale * 1.35) }))}
                className="p-2 rounded bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView((v) => ({ ...v, scale: Math.max(0.15, v.scale * 0.74) }))}
                className="p-2 rounded bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView((v) => ({ ...v, cx: playerPose.x, cz: playerPose.z, scale: 1.8 }))}
                className="p-2 rounded bg-slate-900/95 hover:bg-slate-800 text-rose-400 border border-slate-700 cursor-pointer"
                title="Center on My Character"
              >
                <LocateFixed className="w-4 h-4" />
              </button>
            </div>

            {/* Map Legend */}
            <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 px-3 py-1.5 rounded bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-yellow-400 inline-block" /> Sweet_thedevil VIP #1
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" /> 50 OG Villas
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-teal-400 inline-block" /> Follower Houses (3,397)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 inline-block" /> Venice Canals & Bridges
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> 6 District Parks
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white inline-block" /> You
              </span>
            </div>
          </div>

          {/* Right Directory Search & Selected Plot Inspector */}
          <div className="w-full lg:w-[370px] border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900 flex flex-col min-h-0 max-h-[45vh] lg:max-h-none">
            {/* Search & Tier Tabs */}
            <div className="p-3 border-b border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find your house (@username, RES-xxxx, OG-01)..."
                  className="w-full pl-8 pr-7 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {(
                  [
                    ['all', 'All'],
                    ['og', 'VIP & OG'],
                    ['occupied', 'Houses'],
                    ['open', 'Reserve'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTierFilter(key)}
                    className={`py-1 rounded font-semibold cursor-pointer ${
                      tierFilter === key
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Plot Inspector */}
            {selectedExpansionPlot && (
              <div className="p-3 bg-slate-950/75 border-b border-slate-800 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {selectedExpansionPlot.status === 'vip' && (
                        <Crown className="w-4 h-4 text-yellow-400 shrink-0" />
                      )}
                      {selectedExpansionPlot.status === 'og' && (
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="text-sm font-bold text-white">
                        {selectedExpansionPlot.resident
                          ? `@${selectedExpansionPlot.resident.username}`
                          : `Open Plot ${selectedExpansionPlot.plotCode}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-300/90 font-mono">
                      {selectedExpansionPlot.plotCode}
                      {selectedExpansionPlot.resident
                        ? ` · ${selectedExpansionPlot.resident.residentId}`
                        : ''}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-200 border border-slate-700">
                    {selectedExpansionPlot.status === 'vip'
                      ? 'VIP #1'
                      : selectedExpansionPlot.status === 'og'
                        ? `OG #${selectedExpansionPlot.resident?.ogRank ?? ''}`
                        : selectedExpansionPlot.status === 'occupied'
                          ? 'Resident'
                          : 'Open'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 space-y-0.5">
                  <p>{selectedExpansionPlot.districtName}</p>
                  <p className="text-slate-400">{selectedExpansionPlot.address}</p>
                  {selectedExpansionPlot.resident && (
                    <p className="text-emerald-300">
                      Joined {selectedExpansionPlot.resident.joinedAt} (Oldest Rank #
                      {selectedExpansionPlot.resident.oldestRank})
                    </p>
                  )}
                  {selectedExpansionPlot.houseStyle && (
                    <p className="text-slate-400 capitalize">
                      Style: {selectedExpansionPlot.houseStyle.archetype.replace('-', ' ')} ·{' '}
                      {selectedExpansionPlot.houseStyle.floors} floors
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      onFlyTo(
                        selectedExpansionPlot.x,
                        selectedExpansionPlot.z,
                        selectedExpansionPlot,
                      );
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Fly Here
                  </button>
                  <button
                    onClick={() => {
                      onWalkTo(
                        selectedExpansionPlot.x,
                        selectedExpansionPlot.z + (selectedExpansionPlot.depth / 2 + 2.5),
                        selectedExpansionPlot,
                      );
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Footprints className="w-3.5 h-3.5" />
                    Walk Here
                  </button>
                </div>
              </div>
            )}

            {selectedCorePlot && (
              <div className="p-3 bg-slate-950/75 border-b border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    {selectedCorePlot.publicBuilding?.name ??
                      selectedCorePlot.business?.name ??
                      (selectedCorePlot.ownerUsername
                        ? `@${selectedCorePlot.ownerUsername}`
                        : `Plot ${selectedCorePlot.plotCode}`)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-200">
                    CORE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{selectedCorePlot.address}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      onFlyTo(selectedCorePlot.center.x, selectedCorePlot.center.z, undefined, selectedCorePlot);
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Fly Here
                  </button>
                  <button
                    onClick={() => {
                      onWalkTo(selectedCorePlot.center.x, selectedCorePlot.center.z + 8, undefined, selectedCorePlot);
                      onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Footprints className="w-3.5 h-3.5" />
                    Walk Here
                  </button>
                </div>
              </div>
            )}

            {/* Quick Landmarks & Search Matches List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
              {!searchQuery && (
                <div className="p-2 bg-slate-950/40 flex flex-wrap gap-1">
                  <button
                    onClick={() => {
                      setView({ cx: 236, cz: 0, scale: 1.6 });
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-200 text-[10px] font-semibold cursor-pointer"
                  >
                    <Trees className="w-3 h-3" /> Botanical Park
                  </button>
                  <button
                    onClick={() => {
                      setView({ cx: 430, cz: 0, scale: 1.4 });
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-sky-900/50 hover:bg-sky-800/60 text-sky-200 text-[10px] font-semibold cursor-pointer"
                  >
                    <Waves className="w-3 h-3" /> Waterfront Lake
                  </button>
                  <button
                    onClick={() => {
                      if (expansionWorld.vipPlot) {
                        setSelectedExpansionPlot(expansionWorld.vipPlot);
                        setSelectedCorePlot(null);
                        setView({
                          cx: expansionWorld.vipPlot.x,
                          cz: expansionWorld.vipPlot.z,
                          scale: 2.0,
                        });
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-amber-900/50 hover:bg-amber-800/60 text-amber-200 text-[10px] font-semibold cursor-pointer"
                  >
                    <Crown className="w-3 h-3" /> Sweet_thedevil
                  </button>
                </div>
              )}

              {searchResults.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.expPlot) {
                      setSelectedExpansionPlot(item.expPlot);
                      setSelectedCorePlot(null);
                    } else if (item.corePlot) {
                      setSelectedCorePlot(item.corePlot);
                      setSelectedExpansionPlot(null);
                    }
                    setView((v) => ({
                      cx: item.x,
                      cz: item.z,
                      scale: Math.max(v.scale, 1.85),
                    }));
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.subtitle}</p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                    <MapPin className="w-2.5 h-2.5" />
                    {item.badge}
                  </span>
                </button>
              ))}

              {searchResults.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500">
                  No follower username or plot code matched "{searchQuery}".
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
