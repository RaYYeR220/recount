/**
 * Draws a CountScene on a canvas and flies chits between rounds. The board and the
 * resting chits are cached as bitmaps; the canvas only redraws every frame while
 * chits are in the air. Plaques are DOM elements positioned from the same camera,
 * so their text stays crisp and readable by assistive technology.
 */
import type { CountScene } from "@/lib/countScene";
import { INACTIVE_TRAY } from "@/lib/countScene";
import { chitStyle, NEUTRAL_CHITS, type ChitStyle } from "@/lib/optionColour";
import { frame, project } from "./camera";
import { dimTrays, drawBoard, drawChit, drawContact, drawResting, type RestingChit, type TrayFloors, type View } from "./draw";
import { planDeal, planLength, planMove, type FlightContext, type Mover, type RestPoint } from "./flights";
import { buildGeometry, slotPosition, type LayoutFn, type TableLayout } from "./layout";
import { placeChits, trayNeeds, type Placements, type Rest } from "./placement";
import { textures } from "./textures";

export type RendererEvent =
  | { type: "round"; from: number; to: number; animate: boolean }
  | { type: "start"; round: number; total: number; deal: boolean }
  | { type: "settled"; round: number; skipped: boolean }
  | { type: "layout"; plaques: TableLayout["plaques"] };

type Anim = { movers: Mover[]; staticLayer: HTMLCanvasElement; t0: number; total: number; target: number };

/** Chits thinner than this (a sliver of a sliver at city scale) are not drawn. */
const MIN_VISIBLE = 0.02;

const easeOutBack = (p: number, s = 1.15) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function hash(n: number, mul: number, shift: number): number {
  let h = Math.imul(n, mul) >>> 0;
  h ^= h >>> shift;
  return h >>> 0;
}

export class TableRenderer {
  round: number;
  private anim: Anim | null = null;
  private raf = 0;
  private resizeRaf = 0;
  private view: View | null = null;
  private floors: TrayFloors = {};
  private board: HTMLCanvasElement | null = null;
  private restingCache: { round: number; canvas: HTMLCanvasElement } | null = null;
  private placements: Placements | null = null;
  private perStack = 0;
  private hidden: boolean;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver;
  private readonly outByRound: string[][];
  private readonly listeners = new Set<(e: RendererEvent) => void>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly stage: HTMLElement,
    private readonly scene: CountScene,
    private readonly layoutFn: LayoutFn,
    options: { round: number; hidden?: boolean },
  ) {
    this.round = options.round;
    this.hidden = options.hidden ?? false;
    this.ctx = canvas.getContext("2d")!;
    this.outByRound = scene.rounds.map((r) => Object.entries(r.trays).filter(([, t]) => t.state === "out").map(([id]) => id));
    this.observer = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => this.resize());
    });
    this.observer.observe(canvas.parentElement!);
    this.resize();
  }

  on(fn: (e: RendererEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: RendererEvent) {
    for (const fn of this.listeners) fn(e);
  }

  get animating(): boolean {
    return this.anim !== null;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.resizeRaf);
    this.observer.disconnect();
    this.listeners.clear();
    this.anim = null;
  }

  // ---------- layout ----------
  private resize(): void {
    const box = this.canvas.parentElement!;
    const rect = box.getBoundingClientRect();
    const W = Math.round(rect.width);
    const H = Math.round(rect.height);
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;

    const L = this.layoutFn({ width: W, trays: trayNeeds(this.scene) });
    if (L.perStack !== this.perStack || !this.placements) {
      this.perStack = L.perStack;
      this.placements = placeChits(this.scene, L.perStack);
    }
    const geo = buildGeometry(L);
    const framing = frame(L, geo, this.placements.heights, W, H);
    this.view = { L, geo, framing, W, H, dpr, tex: textures() };
    this.board ??= document.createElement("canvas");
    this.board.width = this.canvas.width;
    this.board.height = this.canvas.height;
    this.floors = drawBoard(this.board.getContext("2d")!, this.view);
    this.restingCache = null;
    this.placePlaques();
    this.emit({ type: "layout", plaques: L.plaques });
    if (this.anim) this.anim.staticLayer = this.restingLayer(this.anim.target, new Set(this.anim.movers.map((m) => m.cid)));
    this.draw(this.anim ? performance.now() : null);
  }

  private placePlaques(): void {
    const v = this.view!;
    const { L, geo } = v;
    const cam = v.framing.camera;
    for (const el of this.stage.querySelectorAll<HTMLElement>("[data-tray]")) {
      const t = geo.trays[el.dataset.tray!];
      if (!t) continue;
      const centre = project(cam, t.x0 + t.w / 2, t.y0, 0).x;
      const top = t.row === 0 ? project(cam, t.x0 + t.w / 2, 0, 0).y + L.plaqueOffset : project(cam, t.x0 + t.w / 2, t.y0 - L.lip, 0).y + L.plaqueOffsetBack;
      const trayW = project(cam, t.x0 + t.w, t.y0, 0).x - project(cam, t.x0, t.y0, 0).x;
      const wide = trayW > (L.wideAt ?? Infinity);
      el.classList.toggle("is-wide", wide);
      el.style.setProperty("--px", `${centre.toFixed(1)}px`);
      el.style.setProperty("--py", `${top.toFixed(1)}px`);
      el.style.setProperty("--pw", `${(wide ? Math.min(trayW - 24, L.wideMax ?? 300) : Math.max(L.plaqueMin, trayW + L.plaqueGrow)).toFixed(0)}px`);
    }
    this.stage.dataset.ready = "true";
  }

  // ---------- chits ----------
  private restPoint = (cid: number, p: Rest): RestPoint => {
    const v = this.view!;
    const s = slotPosition(v.geo, v.L, p.tray, p.idx, p.zu);
    const j = v.L.jitter;
    return { ...s, w: p.w, x: s.x + this.jitter(cid) * j, y: s.y + this.jitter(cid + 31) * j * 0.6 };
  };

  private jitter(cid: number): number {
    return (hash(cid + 7, 2246822519, 15) % 1000) / 1000 - 0.5;
  }

  private rotOf = (cid: number): number => (hash(cid + 1, 2654435761, 13) % 6283) / 1000;

  private faceDown = (tray: string): boolean => tray === INACTIVE_TRAY;

  private styleOf = (cid: number, down: boolean): ChitStyle => (down ? NEUTRAL_CHITS.inactive : chitStyle(this.scene.chits[cid]!.chit));

  private resting(round: number, exclude?: Set<number>): RestingChit[] {
    const out: RestingChit[] = [];
    for (const [cid, p] of this.placements!.positions[round]!) {
      if (exclude?.has(cid) || p.w < MIN_VISIBLE) continue;
      out.push({ cid, ...this.restPoint(cid, p), faceDown: this.faceDown(p.tray) });
    }
    return out;
  }

  private restingLayer(round: number, exclude?: Set<number>): HTMLCanvasElement {
    const v = this.view!;
    const c = document.createElement("canvas");
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext("2d")!;
    dimTrays(g, v, this.floors, this.outByRound[round] ?? []);
    if (!this.hidden) drawResting(g, v, this.resting(round, exclude), this.styleOf, this.rotOf);
    return c;
  }

  private draw(now: number | null): void {
    const v = this.view;
    if (!v || !this.board) return;
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.board, 0, 0);
    if (!this.anim || now === null) {
      if (!this.restingCache || this.restingCache.round !== this.round) this.restingCache = { round: this.round, canvas: this.restingLayer(this.round) };
      g.drawImage(this.restingCache.canvas, 0, 0);
      return;
    }
    const anim = this.anim;
    g.drawImage(anim.staticLayer, 0, 0);
    g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    const t = now - anim.t0;
    const flyers: Array<{ m: Mover; p: number }> = [];
    const settled: RestingChit[] = [];
    for (const m of anim.movers) {
      const p = clamp01((t - m.delay) / m.dur);
      if (p <= 0) {
        if (!m.spawn && m.kind !== "drop" && m.from.w >= MIN_VISIBLE) settled.push({ cid: m.cid, ...m.from, faceDown: m.fromDown });
      } else if (p >= 1) {
        if (m.to.w >= MIN_VISIBLE) settled.push({ cid: m.cid, ...m.to, faceDown: m.toDown });
      } else flyers.push({ m, p });
    }
    drawResting(g, v, settled, this.styleOf, this.rotOf);
    flyers.sort((a, b) => b.m.to.y - a.m.to.y);
    const back = NEUTRAL_CHITS.inactive;
    for (const { m, p } of flyers) {
      if (Math.max(m.from.w, m.to.w) < MIN_VISIBLE) continue;
      const drop = m.kind === "drop";
      const k = drop ? easeOut(p) : easeOutBack(p, 1.05);
      const x = m.from.x + (m.to.x - m.from.x) * k;
      const y = m.from.y + (m.to.y - m.from.y) * k;
      const lift = drop || !m.peak ? 0 : m.peak * Math.sin(Math.PI * Math.min(1, p * 1.04));
      const z = m.from.z + (m.to.z - m.from.z) * (drop ? easeOut(p) : easeInOut(p)) + lift;
      drawContact(g, v, x, y, Math.max(0.15, 0.7 - Math.max(0, z - m.to.z) / 260));
      const turning = clamp01((p - 0.15) / 0.7);
      const flip = m.fromDown === m.toDown ? (m.toDown ? 1 : 0) : m.toDown ? easeInOut(turning) : 1 - easeInOut(turning);
      const face = chitStyle(this.scene.chits[m.cid]!.chit);
      const w = m.from.w + (m.to.w - m.from.w) * Math.min(1, p * 1.6);
      drawChit(g, v, x, y, z, flip > 0.5 ? back : face, {
        flip: flip > 0.5 ? 1 - flip : flip,
        backStyle: back,
        squash: drop ? 1 : 1 - 0.18 * Math.sin(Math.PI * p),
        rot: this.rotOf(m.cid) + (m.peak ? p * 2.4 : 0),
        w,
      });
    }
    if (t >= anim.total) this.finish(false);
    else this.raf = requestAnimationFrame((ts) => this.draw(ts));
  }

  // ---------- rounds ----------
  /** Shows a round. With `animate`, flies the chits that change place; `deal` drops every chit in. */
  goTo(target: number, options: { animate?: boolean; deal?: boolean } = {}): void {
    const animate = options.animate ?? true;
    const deal = options.deal ?? false;
    if (!this.view || !this.placements) return;
    if (this.anim) this.finish(true);
    const from = this.round;
    if (target === from && !deal) {
      if (this.hidden) {
        this.hidden = false;
        this.restingCache = null;
        this.draw(null);
        this.emit({ type: "settled", round: target, skipped: false });
      }
      return;
    }
    this.round = target;
    this.hidden = false;
    this.emit({ type: "round", from, to: target, animate });
    if (!animate) {
      this.restingCache = null;
      this.draw(null);
      this.emit({ type: "settled", round: target, skipped: false });
      return;
    }
    const L = this.view.L;
    const ctx: FlightContext = {
      restPoint: this.restPoint,
      faceDown: this.faceDown,
      parent: (cid) => this.scene.chits[cid]?.parent ?? null,
      chitT: L.chitT,
      stagger: L.stagger,
      flight: L.flight,
    };
    const P1 = this.placements.positions[target]!;
    const movers = deal ? planDeal(P1, ctx) : planMove(this.placements.positions[from]!, P1, ctx, target > from);
    const moving = new Set(movers.map((m) => m.cid));
    const total = planLength(movers);
    this.anim = { movers, staticLayer: this.restingLayer(target, moving), t0: performance.now(), total, target };
    this.stage.setAttribute("aria-busy", "true");
    this.emit({ type: "start", round: target, total, deal });
    this.raf = requestAnimationFrame((ts) => this.draw(ts));
  }

  /** Lands every chit in the air at once. */
  finish(skipped: boolean): void {
    cancelAnimationFrame(this.raf);
    const round = this.anim ? this.anim.target : this.round;
    this.anim = null;
    this.restingCache = null;
    this.stage.removeAttribute("aria-busy");
    this.draw(null);
    this.emit({ type: "settled", round, skipped });
  }
}
