import { NearbyInteractable, TownPlot } from '../types';
import { PARKED_CARS, TOWN_BENCHES } from '../world/MasterTownBlueprint';
import { DynamicVehicleObstacle } from '../simulation/WorldCollision';
import { townMultiplayerService } from '../services/TownServices';

export interface InteractionQueryContext {
  playerX: number;
  playerZ: number;
  sittingBenchId: string | null;
  plots: TownPlot[];
  openDoors: Record<string, boolean>;
  dynamicVehicles: DynamicVehicleObstacle[];
}

const PARK_LANDMARKS: Array<{
  id: string;
  title: string;
  subtitle: string;
  x: number;
  z: number;
  radius: number;
}> = [
  {
    id: 'park-central-lake',
    title: 'Lindenhof Park Lake',
    subtitle: 'Scenic lake, stone shoreline & arched timber footbridge',
    x: 58.0,
    z: -8.5,
    radius: 10.5,
  },
  {
    id: 'park-playground',
    title: "Children's Playground",
    subtitle: 'Swings, climbing slide tower & seesaw pad',
    x: 42.2,
    z: 10.5,
    radius: 7.5,
  },
  {
    id: 'park-tennis',
    title: 'Community Tennis Court',
    subtitle: 'Outdoor court in District 3 Central Park',
    x: 41.2,
    z: -11.5,
    radius: 7.5,
  },
  {
    id: 'park-fountain',
    title: 'Central Square Fountain',
    subtitle: 'Historic public gathering plaza in front of Town Hall',
    x: 0,
    z: 8.8,
    radius: 6.5,
  },
];

/**
 * Reusable single proximity-based world interaction resolver.
 * Returns ONLY the single highest-priority nearby interactable (preventing overlapping prompts)
 * plus a clean distance-sorted Nearby Places list for the Player Panel.
 */
export function resolveActiveWorldInteraction(
  ctx: InteractionQueryContext,
): NearbyInteractable | null {
  const { playerX, playerZ, sittingBenchId, plots, openDoors, dynamicVehicles } = ctx;

  // When seated on a bench, return only the active seated Stand Up prompt
  if (sittingBenchId) {
    const bench = TOWN_BENCHES.find((b) => b.id === sittingBenchId);
    return {
      uid: `bench:${sittingBenchId}`,
      kind: 'bench',
      title: bench?.label ?? 'Town Bench',
      subtitle: 'Seated · Look around or stand up anytime',
      distance: 0,
      benchId: sittingBenchId,
      actions: [{ id: 'stand-up', label: 'Stand Up' }],
    };
  }

  const candidates: Array<{ score: number; item: NearbyInteractable }> = [];
  const localUserId = townMultiplayerService.getSessionUserId();

  // 1. Benches (within 2.7m)
  for (const bench of TOWN_BENCHES) {
    const d = Math.hypot(playerX - bench.x, playerZ - bench.z);
    if (d <= 2.7) {
      const occupant = townMultiplayerService.getBenchOccupant(bench.id);
      const occupiedByOther = Boolean(occupant && occupant !== localUserId);
      candidates.push({
        score: d * 0.72, // Slight priority when standing right beside a bench
        item: {
          uid: `bench:${bench.id}`,
          kind: 'bench',
          title: bench.label,
          subtitle: occupiedByOther ? 'Occupied by another resident' : 'Park bench · Ready to sit',
          distance: d,
          benchId: bench.id,
          actions: [
            {
              id: 'sit',
              label: occupiedByOther ? 'Occupied' : 'Sit',
              disabled: occupiedByOther,
              reason: occupiedByOther ? 'Bench is occupied by another player.' : undefined,
            },
          ],
        },
      });
    }
  }

  // 2. Vehicles (parked + slow/stopped traffic within 3.8m)
  for (const car of PARKED_CARS) {
    const d = Math.hypot(playerX - car.x, playerZ - car.z);
    if (d <= 3.8) {
      candidates.push({
        score: d * 0.9,
        item: {
          uid: `vehicle:${car.id}`,
          kind: 'vehicle',
          title: `Parked ${car.style.charAt(0).toUpperCase() + car.style.slice(1)}`,
          subtitle: 'European city vehicle · Public parking bay',
          distance: d,
          vehicleId: car.id,
          actions: [{ id: 'inspect-vehicle', label: 'Inspect Vehicle' }],
        },
      });
    }
  }
  for (const veh of dynamicVehicles) {
    const d = Math.hypot(playerX - veh.x, playerZ - veh.z);
    if (d <= 4.0) {
      candidates.push({
        score: d * 0.95,
        item: {
          uid: `vehicle:${veh.id}`,
          kind: 'vehicle',
          title: `${veh.style.charAt(0).toUpperCase() + veh.style.slice(1)} (${Math.round(veh.speed * 3.6)} km/h)`,
          subtitle: veh.speed < 0.8 ? 'Stopped at traffic signal' : 'Active road traffic',
          distance: d,
          vehicleId: veh.id,
          actions: [{ id: 'inspect-vehicle', label: 'Inspect Vehicle' }],
        },
      });
    }
  }

  // 3. Houses, Commercial Shops, Civic & Public Buildings (approach doorway or front yard)
  for (const plot of plots) {
    const sin = Math.sin(plot.facingAngle);
    const cos = Math.cos(plot.facingAngle);
    // Compute world position of the front doorway/entrance
    const doorLocalZ = plot.house
      ? plot.house.depth / 2 - 1.0
      : plot.business
        ? plot.business.depth / 2 - 0.5
        : plot.depth / 2 - 1.5;
    const doorX = plot.center.x + doorLocalZ * sin;
    const doorZ = plot.center.z + doorLocalZ * cos;

    const dDoor = Math.hypot(playerX - doorX, playerZ - doorZ);
    const dCenter = Math.hypot(playerX - plot.center.x, playerZ - plot.center.z);
    const d = Math.min(dDoor, dCenter);

    if (plot.house && dDoor <= 6.2) {
      const isOpen = Boolean(openDoors[plot.id]);
      candidates.push({
        score: dDoor,
        item: {
          uid: `house:${plot.id}`,
          kind: 'house',
          title: plot.ownerUsername ? `${plot.ownerUsername}'s Residence` : `Plot ${plot.plotCode}`,
          subtitle: plot.address,
          distance: dDoor,
          plotId: plot.id,
          actions: [
            { id: 'view-house', label: 'View House' },
            { id: 'view-owner', label: 'View Owner' },
            { id: 'toggle-door', label: isOpen ? 'Close Door' : 'Open Door' },
          ],
        },
      });
    } else if (plot.business && dDoor <= 6.2) {
      const isOpen = Boolean(openDoors[plot.id]);
      candidates.push({
        score: dDoor,
        item: {
          uid: `shop:${plot.id}`,
          kind: 'shop',
          title: plot.business.name,
          subtitle: `${plot.business.category.toUpperCase()} · €${plot.business.dailyRevenue}/day`,
          distance: dDoor,
          plotId: plot.id,
          actions: [
            { id: 'view-shop', label: 'View Shop' },
            { id: 'toggle-door', label: isOpen ? 'Close Door' : 'Open Door' },
          ],
        },
      });
    } else if (plot.publicBuilding && d <= Math.max(plot.width, plot.depth) * 0.55 + 3.0) {
      candidates.push({
        score: Math.max(1.2, d - 2.5),
        item: {
          uid: `civic:${plot.id}`,
          kind: 'civic',
          title: plot.publicBuilding.name,
          subtitle: plot.address,
          distance: d,
          plotId: plot.id,
          actions: [{ id: 'view-town-info', label: 'View Town Information' }],
        },
      });
    } else if (!plot.house && !plot.business && !plot.publicBuilding && dCenter <= 6.5) {
      candidates.push({
        score: dCenter,
        item: {
          uid: `plot:${plot.id}`,
          kind: 'house',
          title: `Available Plot ${plot.plotCode}`,
          subtitle: plot.address,
          distance: dCenter,
          plotId: plot.id,
          actions: [{ id: 'view-house', label: 'View Plot' }],
        },
      });
    }
  }

  // 4. Park Landmarks & Plazas
  for (const lm of PARK_LANDMARKS) {
    const d = Math.hypot(playerX - lm.x, playerZ - lm.z);
    if (d <= lm.radius) {
      candidates.push({
        score: Math.max(2.0, d - 1.5),
        item: {
          uid: `park:${lm.id}`,
          kind: 'park',
          title: lm.title,
          subtitle: lm.subtitle,
          distance: d,
          actions: [
            { id: 'explore-park', label: 'Explore' },
            { id: 'view-park-info', label: 'View Information' },
          ],
        },
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0].item;
}

export interface NearbyPlaceSummary {
  id: string;
  label: string;
  category: string;
  distance: number;
  x: number;
  z: number;
  plot?: TownPlot;
}

/**
 * Returns top nearby locations sorted by distance from the player or camera target
 * for the "Nearby Places" section in the Player Panel.
 */
export function getNearbyPlaces(
  refX: number,
  refZ: number,
  plots: TownPlot[],
  limit = 10,
): NearbyPlaceSummary[] {
  const list: NearbyPlaceSummary[] = [];

  for (const p of plots) {
    const d = Math.hypot(refX - p.center.x, refZ - p.center.z);
    const label = p.publicBuilding
      ? p.publicBuilding.name
      : p.business
        ? p.business.name
        : p.ownerUsername
          ? `${p.ownerUsername} (${p.plotCode})`
          : `Open Plot ${p.plotCode}`;
    const category = p.publicBuilding
      ? 'Civic / Landmark'
      : p.business
        ? 'Shop / Business'
        : p.house
          ? 'Residence'
          : 'Open Land';
    list.push({
      id: p.id,
      label,
      category,
      distance: d,
      x: p.center.x,
      z: p.center.z,
      plot: p,
    });
  }

  for (const lm of PARK_LANDMARKS) {
    list.push({
      id: lm.id,
      label: lm.title,
      category: 'Park & Recreation',
      distance: Math.hypot(refX - lm.x, refZ - lm.z),
      x: lm.x,
      z: lm.z,
    });
  }

  list.sort((a, b) => a.distance - b.distance);
  return list.slice(0, limit);
}
