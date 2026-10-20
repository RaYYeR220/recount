/**
 * A pinhole camera looking straight down the table's long axis, pitched toward it.
 * Long lens, so trays at the edges keep their shape. Pure math; the renderer and the
 * server-side height estimate share it.
 */
import type { Geometry, TableLayout } from "./layout";

export type Camera = {
  /** Camera position. */
  px: number;
  py: number;
  pz: number;
  /** Forward and up vectors (x components are zero: no yaw). */
  fy: number;
  fz: number;
  uy: number;
  uz: number;
  /** Focal scale and screen offset. */
  F: number;
  ox: number;
  oy: number;
};

export type Projected = { x: number; y: number; s: number };

export function project(c: Camera, x: number, y: number, z: number): Projected {
  const vx = x - c.px;
  const vy = y - c.py;
  const vz = z - c.pz;
  const zc = vy * c.fy + vz * c.fz;
  const yc = vy * c.uy + vz * c.uz;
  const s = c.F / zc;
  return { x: c.ox + vx * s, y: c.oy - yc * s, s };
}

/** How steeply the camera looks down at a point: squashes circles into ellipses. */
export function elevation(c: Camera, x: number, y: number, z: number): number {
  const vx = x - c.px;
  const vy = y - c.py;
  const vz = z - c.pz;
  return Math.asin(-vz / Math.hypot(vx, vy, vz));
}

function depthOf(c: Camera, y: number, z: number): number {
  return (y - c.py) * c.fy + (z - c.pz) * c.fz;
}

/** Tallest stack each tray holds in any round, in chit units. */
export type TrayHeights = Record<string, number>;

/** Highest screen y any stack reaches (smallest y). */
export function bandTop(c: Camera, L: TableLayout, geo: Geometry, heights: TrayHeights): number {
  let top = Infinity;
  for (const id in geo.trays) {
    const t = geo.trays[id]!;
    const y = t.y0 + L.pad + (t.rows - 0.5) * L.pitch;
    for (const x of [t.x0 + L.pad + L.pitch / 2, t.x0 + t.w - L.pad - L.pitch / 2]) {
      const p = project(c, x, y, -L.recess + Math.max(1, heights[id] ?? 1) * L.chitT);
      const e = elevation(c, x, y, 0);
      top = Math.min(top, p.y - L.chitR * p.s * Math.sin(e));
    }
  }
  return top;
}

export type Framing = {
  camera: Camera;
  /** Height of the table's front face in world units. */
  apronH: number;
  backY: number;
  tableX0: number;
  tableX1: number;
};

/**
 * Frames the table in a W x H box: the front row spans contentWidth, the apron sits
 * on the bottom edge, and the picture shrinks until the tallest stack clears
 * topLimit. With `H` undefined nothing shrinks and the apron sits at y = 0.
 */
export function frame(L: TableLayout, geo: Geometry, heights: TrayHeights, W: number, H?: number): Framing {
  const theta = (L.pitchDeg * Math.PI) / 180;
  const cx = geo.rowWidth / 2;
  const dist = geo.rowWidth * L.lens;
  const targetY = geo.depth * 0.5;
  const c: Camera = {
    px: cx,
    py: targetY - dist * Math.cos(theta),
    pz: dist * Math.sin(theta),
    fy: Math.cos(theta),
    fz: -Math.sin(theta),
    uy: Math.sin(theta),
    uz: Math.cos(theta),
    F: 0,
    ox: W / 2,
    oy: 0,
  };
  const zcFront = depthOf(c, 0, 0);
  c.F = (L.contentWidth * zcFront) / geo.rowWidth;
  const e = elevation(c, cx, 0, 0);
  let apronH = L.apronPx / ((c.F / zcFront) * Math.cos(e));
  const bottom = (H ?? 0) - L.bottomInset;
  c.oy = bottom - project(c, cx, 0, -apronH).y;
  if (H !== undefined) {
    for (let i = 0; i < 4; i++) {
      const top = bandTop(c, L, geo, heights);
      if (top >= L.topLimit - 0.5) break;
      c.F *= (bottom - L.topLimit) / (bottom - top);
      apronH = L.apronPx / ((c.F / zcFront) * Math.cos(e));
      c.oy += bottom - project(c, cx, 0, -apronH).y;
    }
  }
  return { camera: c, apronH, backY: geo.depth + L.minBack, tableX0: -L.sideOverhang, tableX1: geo.rowWidth + L.sideOverhang };
}

/** Box height that fits the table at width W with nothing to spare above topLimit. */
export function fittedHeight(L: TableLayout, geo: Geometry, heights: TrayHeights, W: number): number {
  const { camera } = frame(L, geo, heights, W);
  return Math.ceil(L.topLimit - bandTop(camera, L, geo, heights));
}
