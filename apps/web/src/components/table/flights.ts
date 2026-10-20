/**
 * Flight plans between rounds: which chits move, from where to where, when they
 * take off and how long they fly. Only chits whose place changed are in a plan;
 * everything else stays on the static layer.
 */
import type { Rest } from "./placement";

export type RestPoint = { x: number; y: number; z: number; w: number; stack: number; level: number; slotKey: string };

export type Mover = {
  cid: number;
  /** A sliver appearing out of its parent. */
  spawn: boolean;
  from: RestPoint;
  to: RestPoint;
  fromDown: boolean;
  toDown: boolean;
  delay: number;
  dur: number;
  /** drop: dealt from above; fly: an arc between trays. */
  kind: "fly" | "drop";
  peak: number;
};

export type FlightContext = {
  restPoint: (cid: number, rest: Rest) => RestPoint;
  faceDown: (tray: string) => boolean;
  parent: (cid: number) => number | null;
  chitT: number;
  stagger: number;
  flight: number;
};

/** Total running time of a plan, ms. */
export function planLength(movers: readonly Mover[]): number {
  return movers.reduce((a, m) => Math.max(a, m.delay + m.dur), 0) + 30;
}

/** Deal a round onto an empty table: stacks drop in from the back row forward. */
export function planDeal(target: Map<number, Rest>, ctx: FlightContext): Mover[] {
  const stacks = new Map<string, Array<{ cid: number; to: RestPoint; tray: string }>>();
  for (const [cid, rest] of target) {
    const to = ctx.restPoint(cid, rest);
    let list = stacks.get(to.slotKey);
    if (!list) stacks.set(to.slotKey, (list = []));
    list.push({ cid, to, tray: rest.tray });
  }
  const keys = [...stacks.keys()].sort((a, b) => {
    const A = stacks.get(a)![0]!.to;
    const B = stacks.get(b)![0]!.to;
    return B.y - A.y || A.x - B.x;
  });
  const movers: Mover[] = [];
  keys.forEach((key, si) => {
    for (const it of stacks.get(key)!.sort((a, b) => a.to.level - b.to.level)) {
      const down = ctx.faceDown(it.tray);
      movers.push({
        cid: it.cid,
        spawn: false,
        from: { ...it.to, z: it.to.z + 140 + it.to.level * 2 },
        to: it.to,
        fromDown: down,
        toDown: down,
        delay: si * 38 + it.to.level * 16,
        dur: 420,
        kind: "drop",
        peak: 0,
      });
    }
  });
  return movers;
}

/** Move from one round's resting places to another's, in either direction. */
export function planMove(from: Map<number, Rest>, to: Map<number, Rest>, ctx: FlightContext, forward: boolean): Mover[] {
  const list: Array<{ cid: number; p0: Rest; p1: Rest; source: number; spawn: boolean }> = [];
  for (const [cid, p1] of to) {
    let p0 = from.get(cid);
    let source = cid;
    let spawn = false;
    if (!p0) {
      // A sliver born between the two rounds rises out of its nearest ancestor on the table.
      let anc = ctx.parent(cid);
      while (anc !== null && !from.has(anc)) anc = ctx.parent(anc);
      if (anc === null) continue;
      p0 = from.get(anc)!;
      source = anc;
      spawn = true;
    }
    if (!spawn && p0.tray === p1.tray && p0.idx === p1.idx && p0.w === p1.w && p0.zu === p1.zu) continue;
    list.push({ cid, p0, p1, source, spawn });
  }
  // Lower positions land first so nothing hangs in the air.
  list.sort((a, b) => a.p1.idx - b.p1.idx || a.cid - b.cid);
  const flying = list.filter((it) => it.spawn || it.p0.tray !== it.p1.tray || it.p0.idx !== it.p1.idx);
  const stagger = flying.length > 40 ? ctx.stagger : ctx.stagger * 2.2;
  let k = 0;
  return list.map((it) => {
    const start = ctx.restPoint(it.source, it.p0);
    const end = ctx.restPoint(it.cid, it.p1);
    if (it.spawn) {
      start.z += ctx.chitT * it.p0.w;
      start.w = it.p1.w;
    }
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const moves = dist > 1;
    return {
      cid: it.cid,
      spawn: it.spawn,
      from: start,
      to: end,
      fromDown: ctx.faceDown(it.p0.tray),
      toDown: ctx.faceDown(it.p1.tray),
      delay: moves ? k++ * (forward ? stagger : stagger * 0.6) : 0,
      dur: moves ? ctx.flight + Math.min(260, dist * 0.18) : 420,
      kind: "fly" as const,
      peak: moves ? 70 + dist * 0.22 : 0,
    };
  });
}
