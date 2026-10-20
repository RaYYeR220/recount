/** Canvas 2D drawing: the table, trays and chits, through the camera. */
import type { ChitStyle } from "@/lib/optionColour";
import { elevation, project, type Framing, type Projected } from "./camera";
import type { Geometry, TableLayout, TrayBox } from "./layout";
import type { Textures } from "./textures";

export type View = {
  L: TableLayout;
  geo: Geometry;
  framing: Framing;
  W: number;
  H: number;
  dpr: number;
  tex: Textures;
};

type Ctx = CanvasRenderingContext2D;

const P = (v: View, x: number, y: number, z: number) => project(v.framing.camera, x, y, z);
const E = (v: View, x: number, y: number, z: number) => elevation(v.framing.camera, x, y, z);

/** Screen outline of each tray floor, for dimming trays that are out. */
export type TrayFloors = Record<string, Projected[]>;

/** The walnut table, its apron and the empty trays. Drawn once per size. */
export function drawBoard(g: Ctx, v: View): TrayFloors {
  const { tableX0: x0, tableX1: x1, backY: yb, apronH: H } = v.framing;
  g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  g.clearRect(0, 0, v.W, v.H);

  const fl = P(v, x0, 0, 0);
  const fr = P(v, x1, 0, 0);
  const bl = P(v, x0, yb, 0);
  const br = P(v, x1, yb, 0);
  const fbl = P(v, x0, 0, -H);
  const fbr = P(v, x1, 0, -H);

  // shadow the table throws on the wall behind it
  const sh = g.createLinearGradient(0, bl.y - 70, 0, bl.y + 4);
  sh.addColorStop(0, "rgba(10,6,3,0)");
  sh.addColorStop(1, "rgba(10,6,3,.38)");
  g.fillStyle = sh;
  g.fillRect(0, bl.y - 70, v.W, 74);

  // table top, lit from a lamp above the left of centre
  g.save();
  g.beginPath();
  g.moveTo(bl.x, bl.y);
  g.lineTo(br.x, br.y);
  g.lineTo(fr.x, fr.y);
  g.lineTo(fl.x, fl.y);
  g.closePath();
  g.clip();
  const topH = fl.y - bl.y;
  const wood = v.tex.wood;
  g.drawImage(wood, 0, 0, wood.width, wood.height, Math.min(fl.x, bl.x), bl.y, Math.max(fr.x, br.x) - Math.min(fl.x, bl.x), topH);
  const pool = g.createRadialGradient(v.W * 0.42, bl.y + topH * 0.15, 10, v.W * 0.42, bl.y + topH * 0.2, v.W * 0.7);
  pool.addColorStop(0, "rgba(255,214,150,.20)");
  pool.addColorStop(0.45, "rgba(255,200,130,.06)");
  pool.addColorStop(1, "rgba(10,6,3,.42)");
  g.fillStyle = pool;
  g.fillRect(0, bl.y, v.W, topH);
  const depthShade = g.createLinearGradient(0, bl.y, 0, fl.y);
  depthShade.addColorStop(0, "rgba(10,6,3,.42)");
  depthShade.addColorStop(0.35, "rgba(10,6,3,0)");
  depthShade.addColorStop(1, "rgba(255,220,170,.05)");
  g.fillStyle = depthShade;
  g.fillRect(0, bl.y, v.W, topH);
  g.restore();

  // gilt inlay around the top
  const ins = 22;
  g.save();
  g.strokeStyle = "rgba(201,161,74,.55)";
  g.lineWidth = 1.1;
  g.beginPath();
  const a = P(v, x0 + ins, ins, 0);
  const b = P(v, x1 - ins, ins, 0);
  const c = P(v, x1 - ins, yb - ins, 0);
  const d = P(v, x0 + ins, yb - ins, 0);
  g.moveTo(d.x, d.y);
  g.lineTo(c.x, c.y);
  g.lineTo(b.x, b.y);
  g.lineTo(a.x, a.y);
  g.closePath();
  g.stroke();
  g.restore();

  // apron, the front face
  g.save();
  g.beginPath();
  g.moveTo(fl.x, fl.y);
  g.lineTo(fr.x, fr.y);
  g.lineTo(fbr.x, fbr.y);
  g.lineTo(fbl.x, fbl.y);
  g.closePath();
  g.clip();
  const ap = v.tex.apron;
  g.drawImage(ap, 0, 0, ap.width, ap.height, fbl.x, fl.y, fbr.x - fbl.x, fbl.y - fl.y);
  const apShade = g.createLinearGradient(0, fl.y, 0, fbl.y);
  apShade.addColorStop(0, "rgba(255,214,160,.10)");
  apShade.addColorStop(0.08, "rgba(10,6,3,.05)");
  apShade.addColorStop(1, "rgba(10,6,3,.5)");
  g.fillStyle = apShade;
  g.fillRect(0, fl.y, v.W, fbl.y - fl.y);
  g.restore();
  // bevel highlight on the front edge
  g.strokeStyle = "rgba(255,220,170,.28)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(fl.x, fl.y + 0.75);
  g.lineTo(fr.x, fr.y + 0.75);
  g.stroke();
  g.strokeStyle = "rgba(201,161,74,.6)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(fl.x, fl.y + 6);
  g.lineTo(fr.x, fr.y + 6);
  g.stroke();

  const floors: TrayFloors = {};
  for (const id in v.geo.trays) floors[id] = drawTray(g, v, v.geo.trays[id]!);
  return floors;
}

function drawTray(g: Ctx, v: View, t: TrayBox): Projected[] {
  const L = v.L;
  const r = Math.min(L.trayRadius, t.w / 2 - 2, t.d / 2 - 2);
  const path = (inset: number, z: number) => {
    const xa = t.x0 + inset;
    const xb = t.x0 + t.w - inset;
    const ya = t.y0 + inset;
    const yb = t.y0 + t.d - inset;
    const rr = Math.max(2, r - inset * 0.6);
    const pts: Projected[] = [];
    const corner = (cx: number, cy: number, a0: number) => {
      for (let k = 0; k <= 6; k++) {
        const a = a0 + (k / 6) * (Math.PI / 2);
        pts.push(P(v, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z));
      }
    };
    corner(xb - rr, ya + rr, -Math.PI / 2);
    corner(xb - rr, yb - rr, 0);
    corner(xa + rr, yb - rr, Math.PI / 2);
    corner(xa + rr, ya + rr, Math.PI);
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    return pts;
  };
  // walnut lip with its shadow
  g.save();
  g.shadowColor = "rgba(8,4,2,.55)";
  g.shadowBlur = 14;
  g.shadowOffsetY = 4;
  path(-L.lip, 1.5);
  g.fillStyle = "#4a311f";
  g.fill();
  g.restore();
  path(-L.lip, 1.5);
  const lipG = g.createLinearGradient(0, P(v, 0, t.y0 + t.d, 0).y, 0, P(v, 0, t.y0, 0).y);
  lipG.addColorStop(0, "#6d4b31");
  lipG.addColorStop(1, "#3d2817");
  g.fillStyle = lipG;
  g.fill();
  g.strokeStyle = "rgba(232,205,133,.55)";
  g.lineWidth = 1;
  path(-L.lip * 0.35, 1.5);
  g.stroke();

  // recess: back wall, then the felt floor
  path(0, 0);
  g.fillStyle = "#1c2d22";
  g.fill();
  const floor = path(1.5, -L.recess);
  g.save();
  g.clip();
  g.fillStyle = g.createPattern(t.well ? v.tex.apron : v.tex.felt, "repeat")!;
  g.fillRect(0, 0, v.W, v.H);
  const bb = floor.reduce((acc, p) => ({ x0: Math.min(acc.x0, p.x), y0: Math.min(acc.y0, p.y), x1: Math.max(acc.x1, p.x), y1: Math.max(acc.y1, p.y) }), {
    x0: Infinity,
    y0: Infinity,
    x1: -Infinity,
    y1: -Infinity,
  });
  const cx = (bb.x0 + bb.x1) / 2;
  const cy = (bb.y0 + bb.y1) / 2;
  const vg = g.createRadialGradient(cx, cy, 4, cx, cy, Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * 0.7);
  vg.addColorStop(0, t.well ? "rgba(255,200,140,.05)" : "rgba(120,170,130,.10)");
  vg.addColorStop(1, t.well ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.42)");
  g.fillStyle = vg;
  g.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
  const wall = g.createLinearGradient(0, bb.y0, 0, bb.y0 + 16);
  wall.addColorStop(0, "rgba(0,0,0,.55)");
  wall.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = wall;
  g.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, 16);
  // faint rings where stacks sit
  g.strokeStyle = "rgba(210,235,215,.07)";
  g.lineWidth = 1;
  for (let col = 0; col < t.cols; col++) {
    for (let row = 0; row < t.rows; row++) {
      const x = t.x0 + L.pad + L.pitch / 2 + col * L.pitch;
      const y = t.y0 + L.pad + L.pitch / 2 + row * L.pitch;
      const c = P(v, x, y, -L.recess);
      const e = E(v, x, y, 0);
      g.beginPath();
      g.ellipse(c.x, c.y, L.chitR * c.s * 1.06, L.chitR * c.s * 1.06 * Math.sin(e), 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.restore();
  return floor;
}

/** Darkens the floor of trays whose option is out. */
export function dimTrays(g: Ctx, v: View, floors: TrayFloors, ids: readonly string[]): void {
  g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  for (const id of ids) {
    const pts = floors[id];
    if (!pts) continue;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.fillStyle = "rgba(14,9,5,.42)";
    g.fill();
  }
}

const shades = new WeakMap<Ctx, { side: CanvasGradient; face: CanvasGradient }>();

function shadesFor(g: Ctx) {
  let s = shades.get(g);
  if (!s) {
    const side = g.createLinearGradient(-1, 0, 1, 0);
    side.addColorStop(0, "rgba(255,240,220,.22)");
    side.addColorStop(0.28, "rgba(255,240,220,.04)");
    side.addColorStop(0.62, "rgba(0,0,0,.08)");
    side.addColorStop(1, "rgba(0,0,0,.42)");
    const face = g.createRadialGradient(-0.35, -0.45, 0.05, 0, 0, 1.05);
    face.addColorStop(0, "rgba(255,248,230,.30)");
    face.addColorStop(0.55, "rgba(255,248,230,0)");
    face.addColorStop(1, "rgba(0,0,0,.20)");
    s = { side, face };
    shades.set(g, s);
  }
  return s;
}

export type ChitDrawOptions = {
  /** Thickness in chits (1 whole). */
  w?: number;
  /** Vertical squash in flight. */
  squash?: number;
  /** 0..1 turning over toward `backStyle`. */
  flip?: number;
  backStyle?: ChitStyle;
  /** Another chit lies on top: skip the face. */
  covered?: boolean;
  /** Spin of the edge inlays, radians. */
  rot?: number;
};

export function drawChit(g: Ctx, v: View, x: number, y: number, z: number, style: ChitStyle, o: ChitDrawOptions = {}): void {
  const L = v.L;
  const top = P(v, x, y, z + L.chitT * (o.w ?? 1));
  const bot = P(v, x, y, z);
  const e = E(v, x, y, z);
  const rx = L.chitR * top.s;
  const ry = rx * Math.sin(e) * (o.squash ?? 1);
  const flip = o.flip ?? 0;
  const st = flip > 0.5 && o.backStyle ? o.backStyle : style;
  const ryAbs = Math.abs(ry * Math.cos(flip * Math.PI)) + 0.6;
  const tierSpots = st.tier === 1 ? 8 : 4;
  const shade = shadesFor(g);

  // edge band
  g.beginPath();
  g.moveTo(top.x - rx, top.y);
  g.lineTo(bot.x - rx, bot.y);
  g.ellipse(bot.x, bot.y, rx, ryAbs, 0, Math.PI, 0, true);
  g.lineTo(top.x + rx, top.y);
  g.ellipse(top.x, top.y, rx, ryAbs, 0, 0, Math.PI, false);
  g.closePath();
  g.fillStyle = st.side;
  g.fill();
  if (st.spots) {
    g.fillStyle = st.inlay;
    const width = st.tier === 1 ? 0.14 : 0.24;
    for (let k = 0; k < tierSpots; k++) {
      const phi = (k / tierSpots) * Math.PI * 2 + (o.rot ?? 0);
      const sphi = Math.sin(phi);
      if (sphi <= 0.12) continue;
      const xa = rx * Math.cos(phi - width);
      const xb = rx * Math.cos(phi + width);
      g.globalAlpha = 0.22 + 0.5 * sphi;
      g.fillRect(bot.x + Math.min(xa, xb), top.y + ryAbs * sphi, Math.abs(xb - xa), Math.max(1, bot.y - top.y));
    }
    g.globalAlpha = 1;
  }
  g.save();
  g.setTransform(v.dpr * rx, 0, 0, v.dpr, v.dpr * bot.x, 0);
  g.fillStyle = shade.side;
  g.fill();
  g.restore();
  g.strokeStyle = "rgba(0,0,0,.38)";
  g.lineWidth = 0.8;
  g.beginPath();
  g.ellipse(bot.x, bot.y, rx, ryAbs, 0, Math.PI, 0, true);
  g.stroke();
  if (o.covered) return;

  // face
  g.beginPath();
  g.ellipse(top.x, top.y, rx, ryAbs, 0, 0, Math.PI * 2);
  g.fillStyle = st.face;
  g.fill();
  g.save();
  g.setTransform(v.dpr * rx, 0, 0, v.dpr * Math.max(ryAbs, 0.5), v.dpr * top.x, v.dpr * top.y);
  g.fillStyle = shade.face;
  g.fill();
  g.restore();
  if (ryAbs <= 2) return;
  if (st.spots) {
    g.strokeStyle = st.inlay;
    g.lineWidth = Math.max(1, rx * 0.15) * ((ryAbs / rx) * 0.55 + 0.45);
    g.globalAlpha = 0.9;
    const width = st.tier === 1 ? 0.12 : 0.2;
    for (let k = 0; k < tierSpots; k++) {
      const phi = (k / tierSpots) * Math.PI * 2 + (o.rot ?? 0);
      g.beginPath();
      g.ellipse(top.x, top.y, rx * 0.84, ryAbs * 0.84, 0, phi - width, phi + width);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  g.strokeStyle = st.ring;
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(top.x, top.y, rx * 0.66, ryAbs * 0.66, 0, 0, Math.PI * 2);
  g.stroke();
  if (st.tier === 2) {
    g.strokeStyle = st.inlay;
    g.lineWidth = Math.max(1, rx * 0.06);
    g.beginPath();
    g.ellipse(top.x, top.y, rx * 0.5, ryAbs * 0.5, 0, 0, Math.PI * 2);
    g.stroke();
  }
  if (st.pen) {
    g.strokeStyle = "rgba(40,36,90,.75)";
    g.lineWidth = Math.max(1, rx * 0.07);
    g.beginPath();
    g.moveTo(top.x - rx * 0.36, top.y + ryAbs * 0.08);
    g.bezierCurveTo(top.x - rx * 0.15, top.y - ryAbs * 0.4, top.x - rx * 0.02, top.y + ryAbs * 0.45, top.x + rx * 0.14, top.y - ryAbs * 0.05);
    g.bezierCurveTo(top.x + rx * 0.24, top.y - ryAbs * 0.3, top.x + rx * 0.3, top.y + ryAbs * 0.2, top.x + rx * 0.4, top.y - ryAbs * 0.1);
    g.stroke();
  }
  if (st.faceDown) {
    g.strokeStyle = "rgba(255,255,255,.12)";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(top.x, top.y, rx * 0.86, ryAbs * 0.86, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.ellipse(top.x, top.y, rx * 0.36, ryAbs * 0.36, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

/** Soft shadow on the tray floor under a stack or a chit in flight. */
export function drawContact(g: Ctx, v: View, x: number, y: number, alpha: number): void {
  const L = v.L;
  const p = P(v, x, y, -L.recess);
  const e = E(v, x, y, 0);
  const rx = L.chitR * p.s * 1.12;
  const ry = rx * Math.sin(e);
  g.save();
  g.translate(p.x + rx * 0.06, p.y + ry * 0.18);
  g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, rx * 0.4, 0, 0, rx * 1.15);
  gr.addColorStop(0, `rgba(0,0,0,${0.55 * alpha})`);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, rx * 1.15, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export type RestingChit = {
  cid: number;
  x: number;
  y: number;
  z: number;
  w: number;
  level: number;
  slotKey: string;
  faceDown: boolean;
};

/** Chits at rest, back to front, with a contact shadow under each stack. */
export function drawResting(g: Ctx, v: View, items: RestingChit[], styleOf: (cid: number, faceDown: boolean) => ChitStyle, rotOf: (cid: number) => number): void {
  const occupied = new Set(items.map((it) => `${it.slotKey}:${it.level}`));
  const bases = new Map<string, RestingChit>();
  for (const it of items) if (!bases.has(it.slotKey) || bases.get(it.slotKey)!.level > it.level) bases.set(it.slotKey, it);
  for (const b of bases.values()) drawContact(g, v, b.x, b.y, 1);
  items.sort((a, b) => b.y - a.y || a.x - b.x || a.z - b.z);
  for (const it of items) {
    const covered = occupied.has(`${it.slotKey}:${it.level + 1}`);
    drawChit(g, v, it.x, it.y, it.z, styleOf(it.cid, it.faceDown), { covered, rot: rotOf(it.cid), w: it.w });
  }
}
