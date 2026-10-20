/**
 * Table layout: which trays sit in which row, how big they are, and the camera and
 * motion settings for one width. World units: a stack of chits sits on a `pitch`
 * grid; y runs from the front edge of the table to the back, z is height.
 */

export type TraySpec = {
  id: string;
  /** Stacks across and front to back. */
  cols: number;
  rows: number;
  /** Walnut well instead of felt (the inactive tray). */
  well?: boolean;
  /** Fill stacks from the front row instead of the back. */
  fill?: "front" | "back";
};

export type TableLayout = {
  /** Rows of trays, front to back. */
  rows: Array<{ trays: TraySpec[]; aisleAfter?: number }>;
  pitch: number;
  pad: number;
  gap: number;
  perStack: number;
  chitR: number;
  chitT: number;
  recess: number;
  lip: number;
  trayRadius: number;
  frontMargin: number;
  minBack: number;
  sideOverhang: number;
  /** Camera distance as a multiple of the row width (long lens, little distortion). */
  lens: number;
  /** Camera pitch in degrees. */
  pitchDeg: number;
  jitter: number;
  /** Screen width the front row spans. */
  contentWidth: number;
  /** Screen height of the table's front face. */
  apronPx: number;
  bottomInset: number;
  /** Highest screen y a stack may reach (keeps a little wall above the table). */
  topLimit: number;
  plaqueOffset: number;
  plaqueOffsetBack: number;
  plaqueMin: number;
  plaqueGrow: number;
  /** Trays wider than this get a wide plate with the figure on the right. */
  wideAt?: number;
  wideMax?: number;
  /** Delay between chits taking off, ms. */
  stagger: number;
  /** Base flight time, ms. */
  flight: number;
  /** Plaques on the table edge, or in a grid under the table. */
  plaques: "overlay" | "grid";
};

/** What a tray must hold at most, across every round. */
export type TrayNeed = { id: string; well: boolean; maxChits: number };

export type LayoutInput = { width: number; trays: readonly TrayNeed[] };

export type LayoutFn = (input: LayoutInput) => TableLayout;

/** Containers narrower than this get the compact table (two rows, plaques underneath). */
export const COMPACT_BELOW = 640;
/** Most trays in one row before plaques move under the table. */
export const OVERLAY_MAX_TRAYS = 6;

/** Stacks needed for `count` chits, arranged a little wider than deep. */
export function traySize(count: number, perStack: number): { cols: number; rows: number } {
  const stacks = Math.max(1, Math.ceil(count / perStack));
  const rows = Math.min(3, Math.max(1, Math.round(Math.sqrt(stacks / 1.3))));
  return { cols: Math.ceil(stacks / rows), rows };
}

function chunk<T>(items: readonly T[], perRow: number): T[][] {
  const rows = Math.ceil(items.length / perRow);
  const size = Math.ceil(items.length / rows);
  return Array.from({ length: rows }, (_, i) => items.slice(i * size, (i + 1) * size));
}

/** The count panel on results and replay pages: one row of trays, plaques on the front edge. */
export const panelLayout: LayoutFn = ({ width, trays }) => {
  const compact = width < COMPACT_BELOW;
  const most = Math.max(1, ...trays.map((t) => t.maxChits));
  const perStack = most <= 12 ? 12 : 20;
  const tall = perStack > 12;
  const specs: TraySpec[] = trays.map((t) => ({ id: t.id, well: t.well, ...traySize(t.maxChits, perStack) }));
  const perRow = compact ? 4 : OVERLAY_MAX_TRAYS;
  const overlay = !compact && specs.length <= perRow;
  const rows = specs.length <= perRow ? [{ trays: specs }] : chunk(specs, compact ? 3 : perRow).map((r, i, all) => ({ trays: r, aisleAfter: i < all.length - 1 ? 40 : 0 }));
  return {
    rows,
    pitch: 100,
    pad: 16,
    gap: compact ? 14 : 34,
    perStack,
    chitR: 41,
    chitT: tall ? 7.2 : 12,
    recess: 7,
    lip: 7,
    trayRadius: 26,
    frontMargin: 26,
    minBack: 46,
    sideOverhang: 400,
    lens: 2.4,
    pitchDeg: compact || rows.length > 1 ? 44 : 38,
    jitter: tall ? 2 : 1.2,
    contentWidth: width - (compact ? 20 : 64),
    apronPx: compact ? 16 : overlay ? 84 : 24,
    bottomInset: 0,
    topLimit: 22,
    plaqueOffset: 8,
    plaqueOffsetBack: 6,
    plaqueMin: 104,
    plaqueGrow: 10,
    wideAt: 260,
    wideMax: 300,
    stagger: tall ? 30 : 90,
    flight: 900,
    plaques: overlay ? "overlay" : "grid",
  };
};

export type TrayBox = TraySpec & {
  x0: number;
  y0: number;
  /** Width and depth including padding. */
  w: number;
  d: number;
  row: number;
  rowWidth: number;
};

export type Geometry = {
  trays: Record<string, TrayBox>;
  /** Width of the widest row. */
  rowWidth: number;
  /** Front-to-back depth of all tray rows. */
  depth: number;
};

/** Places trays in world units; rows are centred on the widest one. */
export function buildGeometry(L: TableLayout): Geometry {
  const trays: Record<string, TrayBox> = {};
  let rowWidth = 0;
  let y = L.frontMargin;
  L.rows.forEach((row, ri) => {
    let x = 0;
    let rowDepth = 0;
    const items = row.trays.map((t) => {
      const w = t.cols * L.pitch + 2 * L.pad;
      const d = t.rows * L.pitch + 2 * L.pad;
      const item = { ...t, x0: x, y0: 0, w, d, row: ri, rowWidth: 0 };
      x += w + L.gap;
      rowDepth = Math.max(rowDepth, d);
      return item;
    });
    const width = x - L.gap;
    rowWidth = Math.max(rowWidth, width);
    for (const it of items) {
      it.y0 = y;
      it.rowWidth = width;
      trays[it.id] = it;
    }
    y += rowDepth + (row.aisleAfter ?? 0);
  });
  const depth = y - (L.rows[L.rows.length - 1]?.aisleAfter ?? 0);
  for (const id in trays) trays[id]!.x0 += (rowWidth - trays[id]!.rowWidth) / 2;
  return { trays, rowWidth, depth };
}

export type SlotPoint = { x: number; y: number; z: number; stack: number; level: number; slotKey: string };

/** World position of the chit at `index` in a tray; `zu` overrides its height in chit units. */
export function slotPosition(geo: Geometry, L: TableLayout, trayId: string, index: number, zu?: number): SlotPoint {
  const t = geo.trays[trayId]!;
  const stack = Math.floor(index / L.perStack);
  const level = index % L.perStack;
  const col = stack % t.cols;
  let row = Math.floor(stack / t.cols);
  if (t.fill !== "front") row = t.rows - 1 - row;
  return {
    x: t.x0 + L.pad + L.pitch / 2 + col * L.pitch,
    y: t.y0 + L.pad + L.pitch / 2 + row * L.pitch,
    z: -L.recess + (zu ?? level) * L.chitT,
    stack,
    level,
    slotKey: `${trayId}:${stack}`,
  };
}
