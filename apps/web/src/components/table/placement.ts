/**
 * Where each chit rests in each round, in stack terms: tray, position, weight and
 * height above the tray floor in chit units (a thinned chit or a sliver is shorter,
 * so the chits above it sit lower).
 */
import type { CountScene } from "@/lib/countScene";
import type { TrayHeights } from "./camera";
import type { TrayNeed } from "./layout";

export type Rest = { tray: string; idx: number; w: number; zu: number };

export type Placements = {
  /** positions[round] maps chit id to where it rests. */
  positions: Array<Map<number, Rest>>;
  heights: TrayHeights;
};

export function placeChits(scene: CountScene, perStack: number): Placements {
  const heights: TrayHeights = {};
  const positions = scene.spots.map((row) => {
    const pos = new Map<number, Rest>();
    const stackHeight = new Map<string, number>();
    row.forEach((spot, id) => {
      if (!spot) return;
      const key = `${spot.tray}:${Math.floor(spot.index / perStack)}`;
      const zu = stackHeight.get(key) ?? 0;
      pos.set(id, { tray: spot.tray, idx: spot.index, w: spot.weight, zu });
      stackHeight.set(key, zu + spot.weight);
    });
    for (const [key, h] of stackHeight) {
      const tray = key.slice(0, key.lastIndexOf(":"));
      heights[tray] = Math.max(heights[tray] ?? 0, h);
    }
    return pos;
  });
  return { positions, heights };
}

/** Most chits each tray holds in any round: what the layout must make room for. */
export function trayNeeds(scene: CountScene): TrayNeed[] {
  const most = new Map<string, number>();
  for (const row of scene.spots) {
    const n = new Map<string, number>();
    for (const spot of row) if (spot) n.set(spot.tray, Math.max(n.get(spot.tray) ?? 0, spot.index + 1));
    for (const [tray, k] of n) most.set(tray, Math.max(most.get(tray) ?? 0, k));
  }
  return scene.trays.map((t) => ({ id: t.id, well: t.kind === "inactive", maxChits: most.get(t.id) ?? 0 }));
}
