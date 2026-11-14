import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Compass,
  Crown,
  Footprints,
  Layers,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sliders,
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
import {
  MasterCityMap,
  PlannedPlotGeometry,
  UrbanPlanConfig,
} from '../planning/types';

interface FullCityMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  corePlots: TownPlot[];
  masterPlan: MasterCityMap;
  expansionWorld?: ExpansionCityWorld | null;
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
  onOpenMonument?: () => void;
  onUpdatePlanConfig: (patch: Partial<UrbanPlanConfig>) => void;
  onRegenerateBlock: (blockId: string) => void;
  onExpandCityBlock: () => void;
  onResetMasterPlan: () => void;
}

type TierFilter = 'all' | 'og' | 'occupied' | 'open';
type MapWorkspaceMode = 'explorer' | 'planner';
type PlannerTab = 'inspect' | 'blocks' | 'pipeline';

interface PlannerLayerState {
  blocks: boolean;
  connections: boolean;
  treesAndLamps: boolean;
  overlaps: boolean;
}

export const FullCityMapModal: React.FC<FullCityMapModalProps> = ({
  isOpen,
  onClose,
  corePlots,
  masterPlan,
  expansionWorld,
  playerPose,
  onFlyTo,
  onWalkTo,
  onOpenMonument,
  onUpdatePlanConfig,
  onRegenerateBlock,
  onExpandCityBlock,
  onResetMasterPlan,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<MapWorkspaceMode>(() =>
    expansionWorld ? 'explorer' : 'planner',
  );
  const [plannerTab, setPlannerTab] = useState<PlannerTab>('inspect');
  const [layers, setLayers] = useState<PlannerLayerState>({
    blocks: true,
    connections: true,
    treesAndLamps: true,
    overlaps: true,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [selectedDistrict, setSelectedDistrict] = useState<ExpansionDistrictId | 'core' | 'all'>(
    'all',
  );
  const [selectedExpansionPlot, setSelectedExpansionPlot] = useState<ExpansionPlotSpec | null>(
    expansionWorld?.vipPlot ?? null,
  );
  const [selectedCorePlotId, setSelectedCorePlotId] = useState<string | null>('res-01');
  const [selectedBlockId, setSelectedBlockId] = useState<string>(
    masterPlan.residentialBlocks[0]?.id ?? 'block-1-belvedere-west',
  );
  const [selectedRoadName, setSelectedRoadName] = useState<string | null>(null);

  const selectedCorePlot = useMemo(
    () => corePlots.find((p) => p.id === selectedCorePlotId) ?? null,
    [corePlots, selectedCorePlotId],
  );
  const selectedPlotGeometry: PlannedPlotGeometry | null = useMemo(
    () => (selectedCorePlotId ? masterPlan.plotGeometryById[selectedCorePlotId] ?? null : null),
    [masterPlan, selectedCorePlotId],
  );

  // View transform in world meters
  const [view, setView] = useState<{ cx: number; cz: number; scale: number }>({
    cx: 0,
    cz: 10,
    scale: 1.9,
  });

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origCx: number;
    origCz: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, origCx: 0, origCz: 10, moved: false });

  const fitMasterPlan = useCallback(() => {
    const el = containerRef.current;
    const b = masterPlan.cityBoundary;
    const spanX = Math.max(200, b.maxX - b.minX + 36);
    const spanZ = Math.max(200, b.maxZ - b.minZ + 36);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    if (!el) {
      setView({ cx, cz, scale: 1.9 });
      return;
    }
    const w = el.clientWidth || 860;
    const h = el.clientHeight || 560;
    const scale = Math.max(0.45, Math.min((w - 32) / spanX, (h - 32) / spanZ));
    setView({ cx, cz, scale });
  }, [masterPlan.cityBoundary]);

  const fitFullCity = useCallback(() => {
    if (!expansionWorld) {
      fitMasterPlan();
      return;
    }
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
  }, [expansionWorld, fitMasterPlan]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      if (workspaceMode === 'planner' || !expansionWorld) {
        fitMasterPlan();
      } else {
        fitFullCity();
      }
    }, 36);
    return () => window.clearTimeout(timer);
  }, [isOpen, isFullscreen, workspaceMode, expansionWorld, fitMasterPlan, fitFullCity]);

  const switchMode = (mode: MapWorkspaceMode) => {
    setWorkspaceMode(mode);
    if (mode === 'planner') {
      fitMasterPlan();
    } else {
      fitFullCity();
    }
  };

  const jumpToDistrict = (id: ExpansionDistrictId | 'core' | 'all') => {
    setSelectedDistrict(id);
    if (id === 'all') {
      fitFullCity();
      return;
    }
    if (id === 'core') {
      fitMasterPlan();
      return;
    }
    const d = expansionWorld?.districts.find((dz) => dz.id === id);
    if (d) {
      setView({
        cx: d.center.x,
        cz: d.center.z,
        scale:
          id === 'og-premium-district'
            ? 1.45
            : id === 'botanical-gardens' || id === 'waterfront-lake-district'
              ? 1.5
              : 0.9,
      });
    }
  };

  // Search results across core planned plots + optional expansion followers
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
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

    if (workspaceMode === 'planner' || !expansionWorld || selectedDistrict === 'core' || selectedDistrict === 'all') {
      for (const cp of corePlots) {
        const geom = masterPlan.plotGeometryById[cp.id];
        const blockLabel = geom
          ? masterPlan.residentialBlocks.find((b) => b.id === geom.blockId)?.name ?? ''
          : '';
        const hay = `${cp.plotCode} ${cp.ownerUsername ?? ''} ${cp.business?.name ?? ''} ${cp.publicBuilding?.name ?? ''} ${cp.address} ${blockLabel}`.toLowerCase();
        if (q && !hay.includes(q)) continue;
        if (workspaceMode === 'planner' && tierFilter === 'occupied' && !cp.house) continue;
        if (workspaceMode === 'planner' && tierFilter === 'open' && cp.house) continue;

        matches.push({
          key: `core-${cp.id}`,
          title:
            cp.publicBuilding?.name ??
            cp.business?.name ??
            (cp.ownerUsername ? `@${cp.ownerUsername}` : cp.plotCode),
          subtitle: `${cp.plotCode} · ${cp.address}`,
          badge: geom ? `BLK ${geom.blockId.split('-')[1]}` : 'CIVIC',
          x: cp.center.x,
          z: cp.center.z,
          corePlot: cp,
        });
        if (matches.length >= 60 && workspaceMode === 'planner') return matches;
      }
    }

    if (workspaceMode === 'explorer' && expansionWorld) {
      if (!q && selectedDistrict === 'all' && tierFilter === 'all') {
        return [
          ...matches.slice(0, 6),
          ...expansionWorld.ogPlots.slice(0, 18).map((ep) => ({
            key: ep.plotId,
            title: ep.resident ? `@${ep.resident.username}` : ep.plotCode,
            subtitle: `${ep.plotCode} · ${ep.resident?.residentId ?? ''} · ${ep.districtName}`,
            badge: ep.status === 'vip' ? 'VIP #1' : `OG #${ep.resident?.ogRank ?? ''}`,
            x: ep.x,
            z: ep.z,
            expPlot: ep as ExpansionPlotSpec | undefined,
            corePlot: undefined as TownPlot | undefined,
          })),
        ];
      }

      for (const ep of expansionWorld.plots) {
        if (
          selectedDistrict !== 'all' &&
          selectedDistrict !== 'core' &&
          ep.districtId !== selectedDistrict
        ) {
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

        if (matches.length >= 60) break;
      }
    }

    return matches;
  }, [
    searchQuery,
    selectedDistrict,
    tierFilter,
    corePlots,
    expansionWorld,
    workspaceMode,
    masterPlan,
  ]);

  // Draw crisp 2D Blueprint & Bird's-Eye Canvas Map
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

    // Background meadow
    ctx.fillStyle = '#0c1816';
    ctx.fillRect(0, 0, w, h);

    // Metric urban grid
    ctx.strokeStyle = 'rgba(148,163,184,0.06)';
    ctx.lineWidth = 1;
    const step = workspaceMode === 'planner' ? 26 : 140;
    const gBound = workspaceMode === 'planner' ? 320 : 1120;
    for (let gx = -gBound; gx <= gBound; gx += step) {
      const p1 = toPx(gx, -gBound);
      const p2 = toPx(gx, gBound);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let gz = -gBound; gz <= gBound; gz += step) {
      const p1 = toPx(-gBound, gz);
      const p2 = toPx(gBound, gz);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Optional Expansion City layers in Explorer mode (or zoomed out)
    if (expansionWorld && (workspaceMode === 'explorer' || view.scale < 0.75)) {
      const riverStart = toPx(1210, -1200);
      ctx.fillStyle = '#0c4a6e';
      ctx.fillRect(riverStart.x, 0, Math.max(6, 56 * view.scale), h);

      for (const d of expansionWorld.districts) {
        const tl = toPx(d.bounds.minX, d.bounds.minZ);
        const br = toPx(d.bounds.maxX, d.bounds.maxZ);
        ctx.fillStyle = `${d.color}16`;
        ctx.strokeStyle = `${d.color}48`;
        ctx.lineWidth = 1.3;
        ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      }

      for (const pk of expansionWorld.districtParks) {
        const tl = toPx(pk.x - pk.width / 2, pk.z - pk.depth / 2);
        const br = toPx(pk.x + pk.width / 2, pk.z + pk.depth / 2);
        ctx.fillStyle = 'rgba(22,163,74,0.38)';
        ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      }

      for (const c of expansionWorld.canals) {
        const p1 = toPx(c.x1, c.z1);
        const p2 = toPx(c.x2, c.z2);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = Math.max(2, c.width * view.scale);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

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

      // Smooth Curved District Roads & Collectors
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const cr of expansionWorld.curvedRoads) {
        const pts = cr.sampledPoints;
        if (pts.length < 2) continue;
        ctx.strokeStyle = cr.tier === 'collector' || cr.tier === 'scenic-curve' ? '#475569' : '#334155';
        ctx.lineWidth = Math.max(1.1, cr.width * view.scale);
        ctx.beginPath();
        const pStart = toPx(pts[0].x, pts[0].z);
        ctx.moveTo(pStart.x, pStart.y);
        for (let i = 1; i < pts.length; i++) {
          const pt = toPx(pts[i].x, pts[i].z);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        if (cr.hasDoubleCenterLine && view.scale >= 0.7) {
          ctx.strokeStyle = 'rgba(250,204,21,0.45)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Neighborhood Roundabouts
      for (const rb of expansionWorld.roundabouts) {
        const cp = toPx(rb.x, rb.z);
        if (cp.x < -60 || cp.x > w + 60 || cp.y < -60 || cp.y > h + 60) continue;
        const outerR = Math.max(3, (rb.innerRadius + rb.roadWidth) * view.scale);
        const innerR = Math.max(1.4, rb.innerRadius * view.scale);
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, outerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rb.hasFountain ? '#38bdf8' : '#16a34a';
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, innerR, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const ep of expansionWorld.plots) {
        if (tierFilter === 'og' && ep.status !== 'vip' && ep.status !== 'og') continue;
        if (tierFilter === 'occupied' && ep.status === 'expansion-open') continue;
        if (tierFilter === 'open' && ep.status !== 'expansion-open') continue;

        const p = toPx(ep.x, ep.z);
        if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;
        const pw = Math.max(2.6, (ep.width - 1.2) * view.scale);
        const pd = Math.max(2.6, (ep.depth - 1.2) * view.scale);

        ctx.fillStyle =
          ep.status === 'vip'
            ? '#facc15'
            : ep.status === 'og'
              ? '#f59e0b'
              : ep.status === 'occupied'
                ? '#2dd4bf'
                : '#4d7c0f';

        if (Math.abs(ep.facingAngle) > 0.02 && view.scale >= 0.35) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(-ep.facingAngle);
          ctx.fillRect(-pw / 2, -pd / 2, pw, pd);
          ctx.restore();
        } else {
          ctx.fillRect(p.x - pw / 2, p.y - pd / 2, pw, pd);
        }
      }
    }

    // =====================================================================
    // MASTER CITY MAP LAYER (BOUNDARY, ROAD HIERARCHY, SIDEWALKS, PARKS, PLOTS)
    // =====================================================================
    {
      const cb = masterPlan.cityBoundary;
      const tl = toPx(cb.minX, cb.minZ);
      const br = toPx(cb.maxX, cb.maxZ);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = 'rgba(245,158,11,0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.restore();
    }

    // Green Belts
    for (const gb of masterPlan.greenBelts) {
      const tl = toPx(gb.bounds.minX, gb.bounds.minZ);
      const br = toPx(gb.bounds.maxX, gb.bounds.maxZ);
      ctx.fillStyle = 'rgba(22,163,74,0.22)';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // Central Park Zone & Features
    {
      const cp = masterPlan.centralPark;
      const tl = toPx(cp.bounds.minX, cp.bounds.minZ);
      const br = toPx(cp.bounds.maxX, cp.bounds.maxZ);
      ctx.fillStyle = 'rgba(34,197,94,0.34)';
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.2;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

      const lkTL = toPx(cp.lakeBounds.minX, cp.lakeBounds.minZ);
      const lkBR = toPx(cp.lakeBounds.maxX, cp.lakeBounds.maxZ);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(lkTL.x, lkTL.y, lkBR.x - lkTL.x, lkBR.y - lkTL.y);

      const ft = toPx(cp.fountain.x, cp.fountain.z);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ft.x, ft.y, Math.max(3, 3.8 * view.scale), 0, Math.PI * 2);
      ctx.fill();

      for (const pg of cp.playgrounds) {
        const pp = toPx(pg.x, pg.z);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(pp.x - 3 * view.scale, pp.y - 2.5 * view.scale, 6 * view.scale, 5 * view.scale);
      }
    }

    // Master Sidewalks
    for (const swPad of masterPlan.sidewalks) {
      const tl = toPx(swPad.x - swPad.width / 2, swPad.z - swPad.depth / 2);
      const br = toPx(swPad.x + swPad.width / 2, swPad.z + swPad.depth / 2);
      ctx.fillStyle = '#475569';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // Master Road Network (Primary vs Secondary)
    for (const seg of masterPlan.roads) {
      const p1 = toPx(seg.start.x, seg.start.z);
      const p2 = toPx(seg.end.x, seg.end.z);
      const isHighlightedRoad = selectedRoadName && seg.name === selectedRoadName;
      ctx.strokeStyle = isHighlightedRoad
        ? '#f59e0b'
        : seg.hasDoubleCenterLine
          ? '#64748b'
          : '#334155';
      ctx.lineWidth = Math.max(1.5, seg.width * view.scale);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      if (seg.hasDoubleCenterLine && view.scale >= 1.1) {
        ctx.strokeStyle = 'rgba(250,204,21,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // Intersections
    for (const inter of masterPlan.intersections) {
      const tl = toPx(inter.center.x - inter.width / 2, inter.center.z - inter.depth / 2);
      const br = toPx(inter.center.x + inter.width / 2, inter.center.z + inter.depth / 2);
      ctx.fillStyle = inter.hasTrafficSignal ? '#475569' : '#334155';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // 5+ Organized Residential Block Boundaries
    if (layers.blocks) {
      const blockPalette = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee'];
      masterPlan.residentialBlocks.forEach((blk, idx) => {
        const col = blockPalette[idx % blockPalette.length];
        const tl = toPx(blk.bounds.minX - 1.1, blk.bounds.minZ - 1.1);
        const br = toPx(blk.bounds.maxX + 1.1, blk.bounds.maxZ + 1.1);
        const isSelBlk = blk.id === selectedBlockId && workspaceMode === 'planner';
        ctx.fillStyle = isSelBlk ? `${col}22` : `${col}0d`;
        ctx.strokeStyle = isSelBlk ? col : `${col}66`;
        ctx.lineWidth = isSelBlk ? 2.2 : 1.2;
        ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

        if (view.scale >= 0.85) {
          ctx.fillStyle = col;
          ctx.font = '700 10px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`B${blk.index}`, tl.x + 4, tl.y + 11);
        }
      });
    }

    // All Planned & Core Plots with Rotated Bounds, House Footprints & Facing Arrows
    for (const cp of corePlots) {
      const geom = masterPlan.plotGeometryById[cp.id];
      const p = toPx(cp.center.x, cp.center.z);
      if (p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) continue;

      const sin = Math.abs(Math.sin(cp.facingAngle));
      const cos = Math.abs(Math.cos(cp.facingAngle));
      const worldW = (cp.width * cos + cp.depth * sin) * view.scale;
      const worldD = (cp.width * sin + cp.depth * cos) * view.scale;
      const isSelected = cp.id === selectedCorePlotId;

      ctx.fillStyle = cp.publicBuilding
        ? '#cbd5e1'
        : cp.business
          ? '#fb923c'
          : cp.house
            ? cp.category === 'luxury-residential'
              ? '#60a5fa'
              : '#34d399'
            : '#64748b';
      ctx.globalAlpha = cp.house ? 0.82 : 0.48;
      ctx.fillRect(p.x - worldW / 2, p.y - worldD / 2, worldW, worldD);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = isSelected ? '#fef08a' : 'rgba(15,23,42,0.85)';
      ctx.lineWidth = isSelected ? 2.4 : 1;
      ctx.strokeRect(p.x - worldW / 2, p.y - worldD / 2, worldW, worldD);

      // House footprint & front-facing directional arrow
      if (geom && cp.house && view.scale >= 1.15) {
        const hp = toPx(geom.houseCoords.x, geom.houseCoords.z);
        const hw = (cp.house.width * cos + cp.house.depth * sin) * view.scale;
        const hd = (cp.house.width * sin + cp.house.depth * cos) * view.scale;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(hp.x - hw / 2, hp.y - hd / 2, hw, hd);

        const fx = Math.sin(cp.facingAngle);
        const fz = Math.cos(cp.facingAngle);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hp.x, hp.y);
        ctx.lineTo(hp.x + fx * 6.5 * view.scale, hp.y + fz * 6.5 * view.scale);
        ctx.stroke();
      }

      // Driveway-to-Road & Walkway-to-Sidewalk connections
      if (geom && layers.connections && view.scale >= 1.25) {
        const ds = toPx(geom.drivewaySegment.startX, geom.drivewaySegment.startZ);
        const de = toPx(geom.drivewaySegment.endX, geom.drivewaySegment.endZ);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = Math.max(1.5, 2.2 * view.scale * 0.45);
        ctx.beginPath();
        ctx.moveTo(ds.x, ds.y);
        ctx.lineTo(de.x, de.y);
        ctx.stroke();

        const ps = toPx(geom.pedestrianPathSegment.startX, geom.pedestrianPathSegment.startZ);
        const pe = toPx(geom.pedestrianPathSegment.endX, geom.pedestrianPathSegment.endZ);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = Math.max(1.2, 1.8 * view.scale * 0.4);
        ctx.beginPath();
        ctx.moveTo(ps.x, ps.y);
        ctx.lineTo(pe.x, pe.y);
        ctx.stroke();
      }

      if (view.scale >= 1.35) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(cp.plotCode, p.x, p.y + 3);
      }
    }

    // Validated Trees & Streetlamps
    if (layers.treesAndLamps && view.scale >= 0.9) {
      for (const t of masterPlan.roadsideTrees) {
        const tp = toPx(t.x, t.z);
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, Math.max(1.8, 1.5 * view.scale), 0, Math.PI * 2);
        ctx.fill();
      }
      if (view.scale >= 1.3) {
        for (const l of masterPlan.streetLamps) {
          const lp = toPx(l.x, l.z);
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(lp.x, lp.y, Math.max(1.5, 0.7 * view.scale), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Overlap Violation Markers
    if (layers.overlaps && masterPlan.validation.violations.length > 0) {
      for (const v of masterPlan.validation.violations) {
        const vp = toPx(v.x, v.z);
        ctx.strokeStyle = v.severity === 'error' ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, Math.max(8, 8 * view.scale), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Selected Marker Ring
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
      ctx.arc(sp.x, sp.y, Math.max(11, 13 * view.scale), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Current Player Marker
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
    workspaceMode,
    layers,
    expansionWorld,
    masterPlan,
    corePlots,
    tierFilter,
    selectedExpansionPlot,
    selectedCorePlot,
    selectedCorePlotId,
    selectedBlockId,
    selectedRoadName,
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

    let bestDistSq = Infinity;
    let hitCore: TownPlot | null = null;
    let hitExp: ExpansionPlotSpec | null = null;

    // Hit-test Core & Planned Plots inside their oriented bounding boxes first
    for (const cp of corePlots) {
      const sin = Math.abs(Math.sin(cp.facingAngle));
      const cos = Math.abs(Math.cos(cp.facingAngle));
      const hx = (cp.width * cos + cp.depth * sin) / 2;
      const hz = (cp.width * sin + cp.depth * cos) / 2;
      if (Math.abs(wx - cp.center.x) <= hx + 1 && Math.abs(wz - cp.center.z) <= hz + 1) {
        const dSq = (cp.center.x - wx) ** 2 + (cp.center.z - wz) ** 2;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          hitCore = cp;
        }
      }
    }

    if (!hitCore && expansionWorld) {
      for (const ep of expansionWorld.plots) {
        const dSq = (ep.x - wx) ** 2 + (ep.z - wz) ** 2;
        if (dSq < bestDistSq && dSq <= Math.max(900, (22 / view.scale) ** 2)) {
          bestDistSq = dSq;
          hitExp = ep;
        }
      }
    }

    if (hitCore) {
      setSelectedCorePlotId(hitCore.id);
      setSelectedExpansionPlot(null);
      setSelectedRoadName(null);
      const geom = masterPlan.plotGeometryById[hitCore.id];
      if (geom) setSelectedBlockId(geom.blockId);
      setPlannerTab('inspect');
      return;
    }

    if (hitExp) {
      setSelectedExpansionPlot(hitExp);
      setSelectedCorePlotId(null);
      setSelectedRoadName(null);
      return;
    }

    // Check if user clicked on a Road Segment to highlight road connections
    for (const seg of masterPlan.roads) {
      const dx = seg.end.x - seg.start.x;
      const dz = seg.end.z - seg.start.z;
      const lenSq = dx * dx + dz * dz;
      if (lenSq <= 0) continue;
      const t = Math.max(0, Math.min(1, ((wx - seg.start.x) * dx + (wz - seg.start.z) * dz) / lenSq));
      const dist = Math.hypot(wx - (seg.start.x + t * dx), wz - (seg.start.z + t * dz));
      if (dist <= seg.width / 2 + 2) {
        setSelectedRoadName(seg.name);
        setPlannerTab('inspect');
        return;
      }
    }
  };

  if (!isOpen) return null;

  const { config, validation, residentialBlocks, stages } = masterPlan;
  const activeBlock =
    residentialBlocks.find((b) => b.id === selectedBlockId) ?? residentialBlocks[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/92 flex items-center justify-center p-2 sm:p-4">
      <div
        className={`bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden transition-all ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-[1420px] h-[92vh] rounded-xl'
        }`}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <Compass className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                Lindenhof Master City Map &amp; Urban Planning Studio
              </h2>
              <p className="text-[11px] text-slate-400 font-mono-tabular truncate">
                {masterPlan.plannedPlotGeometries.length} Planned Residential Plots ·{' '}
                {residentialBlocks.length} Blocks · 12-Stage Pipeline ·{' '}
                {validation.errorCount === 0
                  ? '0 Overlaps'
                  : `${validation.errorCount} Overlap(s)`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {/* Mode Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700">
              <button
                type="button"
                onClick={() => switchMode('planner')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  workspaceMode === 'planner'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Urban Planner
              </button>
              {expansionWorld && (
                <button
                  type="button"
                  onClick={() => switchMode('explorer')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    workspaceMode === 'explorer'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Community City
                </button>
              )}
            </div>

            {onOpenMonument && expansionWorld && (
              <button
                type="button"
                onClick={onOpenMonument}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Award className="w-3.5 h-3.5" />
                OG 50 Monument
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title={isFullscreen ? 'Restore Size' : 'Expand Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-700 cursor-pointer"
              title="Close Map"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Context Ribbon: Layer Toggles (Planner) OR District Jump (Explorer) */}
        {workspaceMode === 'planner' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
                <Layers className="w-3.5 h-3.5" /> Layers:
              </span>
              {(
                [
                  ['blocks', 'Blocks (1–5+)'],
                  ['connections', 'Driveways & Paths'],
                  ['treesAndLamps', 'Trees & Lamps'],
                  ['overlaps', 'Overlap Audit'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer whitespace-nowrap ${
                    layers[key]
                      ? 'bg-emerald-600/25 border-emerald-400/50 text-emerald-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={fitMasterPlan}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
              >
                Fit Blueprint
              </button>
              <span
                className={`px-2 py-1 rounded text-[11px] font-mono-tabular font-semibold whitespace-nowrap ${
                  validation.errorCount === 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {validation.errorCount === 0
                  ? '✓ Valid Geometry'
                  : `⚠ ${validation.errorCount} Overlap Error(s)`}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-900/95 border-b border-slate-800 overflow-x-auto">
            <button
              type="button"
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
              type="button"
              onClick={() => jumpToDistrict('core')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                selectedDistrict === 'core'
                  ? 'bg-slate-100 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Core Planned Neighborhoods
            </button>
            {expansionWorld?.districts.map((d) => (
              <button
                key={d.id}
                type="button"
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
        )}

        {/* Main Split Body */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Interactive Map Canvas */}
          <div ref={containerRef} className="relative flex-1 min-h-[280px] bg-slate-950 overflow-hidden">
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
                  scale: Math.max(0.15, Math.min(6.0, v.scale * factor)),
                }));
              }}
            />

            {/* Floating Map Zoom & Locate Controls */}
            <div className="absolute top-3 right-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setView((v) => ({ ...v, scale: Math.min(6.0, v.scale * 1.35) }))}
                className="p-2 rounded bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setView((v) => ({ ...v, scale: Math.max(0.15, v.scale * 0.74) }))}
                className="p-2 rounded bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setView({ cx: playerPose.x, cz: playerPose.z, scale: 2.2 })}
                className="p-2 rounded bg-slate-900/95 hover:bg-slate-800 text-rose-400 border border-slate-700 cursor-pointer"
                title="Center on Player"
              >
                <LocateFixed className="w-4 h-4" />
              </button>
            </div>

            {/* Map Legend */}
            <div className="hidden sm:flex absolute bottom-3 left-3 flex-wrap items-center gap-3 px-3 py-1.5 rounded bg-slate-950/92 border border-slate-800 text-[11px] text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 inline-block" /> Planned Homes
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" /> Driveways
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 inline-block" /> Sidewalk Paths
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Validated Trees
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white inline-block" /> Player
              </span>
            </div>
          </div>

          {/* Right Sidebar: Urban Planner Inspector OR Community Directory */}
          <div className="w-full lg:w-[390px] border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900 flex flex-col min-h-0 max-h-[46vh] lg:max-h-none">
            {workspaceMode === 'planner' ? (
              <>
                {/* Urban Planner Inspector Tabs */}
                <div className="grid grid-cols-3 gap-1 p-2 border-b border-slate-800 bg-slate-950">
                  {(
                    [
                      ['inspect', 'Inspector'],
                      ['blocks', 'Blocks & Sizes'],
                      ['pipeline', '12 Stages & Audit'],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setPlannerTab(tab)}
                      className={`py-1.5 px-2 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                        plannerTab === tab
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {plannerTab === 'inspect' && (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Selected Plot / Road Coordinates & Connectivity Details */}
                    <div className="p-3 bg-slate-950/75 border-b border-slate-800 space-y-2">
                      {selectedRoadName && !selectedCorePlot ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-amber-300">
                              {selectedRoadName}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedRoadName(null)}
                              className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            Connected Segments:{' '}
                            {masterPlan.roads.filter((r) => r.name === selectedRoadName).length} ·
                            Served Plots:{' '}
                            {
                              masterPlan.plannedPlotGeometries.filter(
                                (g) => g.connectedRoadName === selectedRoadName,
                              ).length
                            }
                          </p>
                        </div>
                      ) : selectedCorePlot ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-mono-tabular text-amber-300">
                                {selectedCorePlot.plotCode} · {selectedCorePlot.address}
                              </div>
                              <div className="text-sm font-bold text-white truncate">
                                {selectedCorePlot.publicBuilding?.name ??
                                  selectedCorePlot.business?.name ??
                                  (selectedCorePlot.ownerUsername
                                    ? `@${selectedCorePlot.ownerUsername}`
                                    : selectedCorePlot.house
                                      ? `Residential Lot (${selectedCorePlot.house.archetype})`
                                      : 'Available Residential Plot')}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono-tabular text-slate-200 shrink-0">
                              {selectedCorePlot.width.toFixed(1)}×{selectedCorePlot.depth.toFixed(1)}m
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                            <div>
                              <span className="text-slate-500">Plot Center:</span>{' '}
                              <span className="font-mono-tabular">
                                ({selectedCorePlot.center.x.toFixed(1)},{' '}
                                {selectedCorePlot.center.z.toFixed(1)})
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Rotation:</span>{' '}
                              <span className="font-mono-tabular">
                                {Math.round((selectedCorePlot.facingAngle * 180) / Math.PI)}°
                              </span>
                            </div>
                            {selectedPlotGeometry && (
                              <>
                                <div>
                                  <span className="text-slate-500">Front Dir:</span>{' '}
                                  <span className="capitalize text-sky-300">
                                    {selectedPlotGeometry.frontDirection}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Yards (F/B):</span>{' '}
                                  <span className="font-mono-tabular">
                                    {selectedPlotGeometry.frontYardDepth}m /{' '}
                                    {selectedPlotGeometry.backYardDepth}m
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">House Coords:</span>{' '}
                                  <span className="font-mono-tabular">
                                    ({selectedPlotGeometry.houseCoords.x},{' '}
                                    {selectedPlotGeometry.houseCoords.z})
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Garage:</span>{' '}
                                  <span className="font-mono-tabular text-emerald-300">
                                    {selectedPlotGeometry.garageCoords
                                      ? `(${selectedPlotGeometry.garageCoords.x}, ${selectedPlotGeometry.garageCoords.z})`
                                      : 'None'}
                                  </span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-slate-500">Road Connection:</span>{' '}
                                  <span className="text-amber-200">
                                    {selectedPlotGeometry.connectedRoadName ?? 'Local Street'} (
                                    {selectedPlotGeometry.drivewaySegment.connectedRoadEdgeDist}m)
                                  </span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-slate-500">Walkway Link:</span>{' '}
                                  <span className="text-sky-200">
                                    Sidewalk ({selectedPlotGeometry.pedestrianPathSegment.connectedSidewalkDist}m gap)
                                  </span>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                onFlyTo(
                                  selectedCorePlot.center.x,
                                  selectedCorePlot.center.z,
                                  undefined,
                                  selectedCorePlot,
                                );
                                onClose();
                              }}
                              className="flex items-center justify-center gap-1.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              Fly Here
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onWalkTo(
                                  selectedCorePlot.center.x,
                                  selectedCorePlot.center.z + 8,
                                  undefined,
                                  selectedCorePlot,
                                );
                                onClose();
                              }}
                              className="flex items-center justify-center gap-1.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                            >
                              <Footprints className="w-3.5 h-3.5" />
                              Walk Here
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Click any plot or road on the map to inspect coordinates, rotation,
                          driveway connection &amp; yard layout.
                        </p>
                      )}
                    </div>

                    {/* Search Plots */}
                    <div className="p-2.5 border-b border-slate-800">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search Plot ID (RES-01..43, LUX-01, EXB-)..."
                          className="w-full pl-8 pr-7 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-2 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
                      {searchResults.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            if (item.corePlot) {
                              setSelectedCorePlotId(item.corePlot.id);
                              setSelectedExpansionPlot(null);
                            }
                            setView((v) => ({
                              cx: item.x,
                              cz: item.z,
                              scale: Math.max(v.scale, 2.2),
                            }));
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{item.subtitle}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                            {item.badge}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {plannerTab === 'blocks' && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {/* Residential Blocks (1–5+) + Per-Block Regeneration */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-white">
                          Residential Blocks ({residentialBlocks.length})
                        </h3>
                        <button
                          type="button"
                          onClick={onExpandCityBlock}
                          disabled={config.expansionBlockCount >= 3}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          Expand (+12 Plots)
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {residentialBlocks.map((blk) => {
                          const isSel = blk.id === activeBlock?.id;
                          return (
                            <div
                              key={blk.id}
                              onClick={() => {
                                setSelectedBlockId(blk.id);
                                setView({ cx: blk.center.x, cz: blk.center.z, scale: 2.3 });
                              }}
                              className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                                isSel
                                  ? 'bg-slate-800 border-amber-400/60'
                                  : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-white truncate">
                                    {blk.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono-tabular">
                                    {blk.plotIds.length} plots · Seed #{blk.seed}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRegenerateBlock(blk.id);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 text-[10px] font-semibold cursor-pointer shrink-0"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Regenerate
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Road & Plot Dimension Modifiers */}
                    <div className="pt-3 border-t border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-sky-400" />
                          Road &amp; Plot Dimensions
                        </h3>
                        <button
                          type="button"
                          onClick={onResetMasterPlan}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      </div>

                      {[
                        {
                          key: 'primaryRoadWidth' as const,
                          label: 'Primary Road Width',
                          min: 8.5,
                          max: 14.0,
                          step: 0.5,
                          value: config.primaryRoadWidth,
                        },
                        {
                          key: 'secondaryRoadWidth' as const,
                          label: 'Secondary Road Width',
                          min: 6.5,
                          max: 12.0,
                          step: 0.5,
                          value: config.secondaryRoadWidth,
                        },
                        {
                          key: 'sidewalkWidth' as const,
                          label: 'Sidewalk Width',
                          min: 1.8,
                          max: 4.2,
                          step: 0.2,
                          value: config.sidewalkWidth,
                        },
                        {
                          key: 'plannedPlotWidth' as const,
                          label: 'Planned Plot Width',
                          min: 14.5,
                          max: 22.0,
                          step: 0.5,
                          value: config.plannedPlotWidth,
                        },
                        {
                          key: 'plannedPlotDepth' as const,
                          label: 'Planned Plot Depth',
                          min: 14.5,
                          max: 22.0,
                          step: 0.5,
                          value: config.plannedPlotDepth,
                        },
                      ].map((ctrl) => (
                        <div key={ctrl.key} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-300">{ctrl.label}</span>
                            <span className="font-mono-tabular text-amber-300">
                              {ctrl.value.toFixed(1)}m
                            </span>
                          </div>
                          <input
                            type="range"
                            min={ctrl.min}
                            max={ctrl.max}
                            step={ctrl.step}
                            value={ctrl.value}
                            onChange={(e) =>
                              onUpdatePlanConfig({ [ctrl.key]: Number(e.target.value) })
                            }
                            className="w-full accent-amber-400 cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {plannerTab === 'pipeline' && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {/* Overlap Validator Results */}
                    <div
                      className={`p-2.5 rounded-lg border ${
                        validation.errorCount === 0
                          ? 'bg-emerald-950/40 border-emerald-500/40'
                          : 'bg-rose-950/40 border-rose-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        {validation.errorCount === 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>
                          {validation.errorCount === 0
                            ? '0 Geometry Overlaps Detected'
                            : `${validation.errorCount} Overlap Error(s) · ${validation.warningCount} Warning(s)`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1 font-mono-tabular">
                        {validation.stats.totalObjectsChecked} entities checked ·{' '}
                        {validation.stats.disconnectedDriveways} disconnected driveways ·{' '}
                        {validation.stats.treesCleared} validated trees
                      </p>

                      {validation.violations.length > 0 && (
                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                          {validation.violations.slice(0, 20).map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setView({ cx: v.x, cz: v.z, scale: 2.8 })}
                              className="w-full text-left p-1.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-rose-500/30 text-[10px] text-rose-200 cursor-pointer"
                            >
                              {v.message}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 12-Stage Deterministic Generation Pipeline */}
                    <div>
                      <h3 className="text-xs font-bold text-white mb-2">
                        12-Stage City Generation Sequence
                      </h3>
                      <div className="space-y-1.5">
                        {stages.map((st) => (
                          <div
                            key={st.key}
                            className="p-2 rounded-lg bg-slate-950/75 border border-slate-800"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-white">
                                {st.stage}. {st.title}
                              </span>
                              <span
                                className={`text-[10px] font-mono-tabular ${
                                  st.status === 'complete' ? 'text-emerald-400' : 'text-amber-300'
                                }`}
                              >
                                {st.summary}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{st.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Community Explorer Sidebar */
              <>
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
                        type="button"
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
                        type="button"
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
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
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
                        type="button"
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
                        {selectedCorePlot.plotCode}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{selectedCorePlot.address}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onFlyTo(
                            selectedCorePlot.center.x,
                            selectedCorePlot.center.z,
                            undefined,
                            selectedCorePlot,
                          );
                          onClose();
                        }}
                        className="flex items-center justify-center gap-1.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Fly Here
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onWalkTo(
                            selectedCorePlot.center.x,
                            selectedCorePlot.center.z + 8,
                            undefined,
                            selectedCorePlot,
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

                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
                  {!searchQuery && expansionWorld && (
                    <div className="p-2 bg-slate-950/40 flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setView({ cx: 236, cz: 0, scale: 1.6 })}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-200 text-[10px] font-semibold cursor-pointer"
                      >
                        <Trees className="w-3 h-3" /> Botanical Park
                      </button>
                      <button
                        type="button"
                        onClick={() => setView({ cx: 430, cz: 0, scale: 1.4 })}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-sky-900/50 hover:bg-sky-800/60 text-sky-200 text-[10px] font-semibold cursor-pointer"
                      >
                        <Waves className="w-3 h-3" /> Waterfront Lake
                      </button>
                      {expansionWorld.vipPlot && (
                        <button
                          type="button"
                          onClick={() => {
                            if (expansionWorld.vipPlot) {
                              setSelectedExpansionPlot(expansionWorld.vipPlot);
                              setSelectedCorePlotId(null);
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
                      )}
                    </div>
                  )}

                  {searchResults.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if (item.expPlot) {
                          setSelectedExpansionPlot(item.expPlot);
                          setSelectedCorePlotId(null);
                        } else if (item.corePlot) {
                          setSelectedCorePlotId(item.corePlot.id);
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
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
