import { fittedHeight } from "@/components/table/camera";
import { buildGeometry, traySize, type LayoutFn, type TableLayout, type TrayNeed, type TraySpec } from "@/components/table/layout";
import { placeChits, trayNeeds } from "@/components/table/placement";
import type { CountScene } from "@/lib/countScene";

/** Hero widths from here up lay the table across the whole hero, behind nothing but the rail. */
export const HERO_WIDE = 900;
/** Room above the tallest stack for the shadow the table throws on the wall. */
export const HERO_HEADROOM = 64;
/** Compact tables stop growing here (tablets in portrait); the walnut still runs edge to edge. */
const COMPACT_MAX_WIDTH = 640;

const PER_STACK = 20;

/** Stacks across and deep, in tray order (options first, inactive last). */
const WIDE_SIZES: Array<[number, number]> = [[4, 3], [4, 3], [1, 3], [1, 2], [1, 1]];
const COMPACT_FRONT: Array<[number, number]> = [[4, 3], [4, 3]];
const COMPACT_BACK: Array<[number, number]> = [[2, 2], [1, 2], [1, 1]];
const INACTIVE_SIZE: [number, number] = [1, 2];

function spec(need: TrayNeed, size: [number, number] | undefined): TraySpec {
  const [cols, rows] = size ?? [0, 0];
  const fits = need.maxChits <= cols * rows * PER_STACK;
  return { id: need.id, well: need.well, ...(fits ? { cols, rows } : traySize(need.maxChits, PER_STACK)) };
}

const shared = {
  pitch: 100,
  pad: 14,
  gap: 24,
  perStack: PER_STACK,
  chitR: 42,
  chitT: 7.2,
  recess: 7,
  lip: 7,
  bottomInset: 0,
  plaqueOffsetBack: 6,
  stagger: 30,
  flight: 900,
} satisfies Partial<TableLayout>;

/**
 * The landing's table. Wide: one row of trays across the hero, a long front apron
 * for the brass plates, the camera low enough that the stacks rise in front of the
 * claim. Compact: the two leaders in front, the rest behind, plates underneath.
 */
export const heroLayout: LayoutFn = ({ width, trays }) => {
  const options = trays.filter((t) => !t.well);
  const wells = trays.filter((t) => t.well).map((t) => spec(t, INACTIVE_SIZE));
  if (width >= HERO_WIDE) {
    return {
      ...shared,
      rows: [{ trays: [...options.map((t, i) => spec(t, WIDE_SIZES[i])), ...wells] }],
      trayRadius: 26,
      frontMargin: 30,
      minBack: 70,
      sideOverhang: 900,
      lens: 2.4,
      pitchDeg: 40,
      jitter: 2.2,
      contentWidth: Math.min(width - 112, 1328),
      apronPx: 92,
      topLimit: HERO_HEADROOM,
      plaqueOffset: 10,
      // Narrower heroes have narrower trays; the plates shrink with them so they never overlap.
      plaqueMin: Math.round(Math.min(108, Math.max(80, (width - 112) * 0.09))),
      plaqueGrow: width >= 1180 ? 16 : 2,
      wideAt: 240,
      wideMax: 296,
      plaques: "overlay",
    };
  }
  const front = options.slice(0, COMPACT_FRONT.length).map((t, i) => spec(t, COMPACT_FRONT[i]));
  const back = [...options.slice(COMPACT_FRONT.length).map((t, i) => spec(t, COMPACT_BACK[i])), ...wells];
  return {
    ...shared,
    rows: back.length > 0 ? [{ trays: front, aisleAfter: 90 }, { trays: back }] : [{ trays: front }],
    trayRadius: 24,
    frontMargin: 30,
    minBack: 40,
    sideOverhang: 400,
    lens: 2.6,
    pitchDeg: 54,
    jitter: 2,
    contentWidth: Math.min(width, COMPACT_MAX_WIDTH) - 24,
    apronPx: 22,
    topLimit: 10,
    plaqueOffset: 6,
    plaqueMin: 80,
    plaqueGrow: 0,
    plaques: "grid",
  };
};

/**
 * Height of the compact table as a CSS length. The fitted height is a + b·width up
 * to COMPACT_MAX_WIDTH, where the trays stop growing, so two widths give it exactly
 * and the box is the right size in the server HTML, before any script runs.
 */
export function compactHeight(scene: CountScene): string {
  const needs = trayNeeds(scene);
  const height = (width: number) => {
    const L = heroLayout({ width, trays: needs });
    return fittedHeight(L, buildGeometry(L), placeChits(scene, L.perStack).heights, width);
  };
  const [w1, w2] = [320, COMPACT_MAX_WIDTH - 20];
  const h1 = height(w1);
  const b = (height(w2) - h1) / (w2 - w1);
  return `calc(${(h1 - b * w1).toFixed(1)}px + ${b.toFixed(4)} * min(100cqi, ${COMPACT_MAX_WIDTH}px))`;
}

/**
 * Narrows each plate on the table's edge to the room between its neighbours, so
 * plates never overlap when a short screen shrinks the table. Plates are in tray
 * order, left to right; each may take the distance to its nearer neighbour.
 */
export function fitPlates(plates: readonly HTMLElement[], gap = 6): void {
  const xs = plates.map((el) => parseFloat(el.style.getPropertyValue("--px")));
  plates.forEach((el, i) => {
    const room = Math.min(i > 0 ? xs[i]! - xs[i - 1]! : Infinity, i < xs.length - 1 ? xs[i + 1]! - xs[i]! : Infinity) - gap;
    if (Number.isFinite(room)) el.style.setProperty("--pw-room", `${Math.max(0, room).toFixed(1)}px`);
    else el.style.removeProperty("--pw-room");
  });
}
