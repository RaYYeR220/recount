import type { ReactNode } from "react";
import { chitStyle, type ChitKey } from "@/lib/optionColour";

/*
 * Top-down drawings of a small count on felt: three trays, one chit per ballot.
 * Everything is placed in a 300 x 214 box; the figures come from the engine's rounds.
 */

const TW = 84;
const TH = 104;
const TY = 34;
const TX = [14, 108, 202] as const;
const INLAY = "#f6efdc";

function FigChit({ x, y, r, chit }: { x: number; y: number; r: number; chit: ChitKey }) {
  const face = chitStyle(chit).face;
  const circ = 2 * Math.PI * r * 0.8;
  return (
    <g>
      <circle cx={x} cy={y + 1.6} r={r} fill="rgba(0,0,0,.35)" />
      <circle cx={x} cy={y} r={r} fill={face} />
      <circle
        cx={x}
        cy={y}
        r={r * 0.8}
        fill="none"
        stroke={INLAY}
        strokeWidth={r * 0.22}
        strokeDasharray={`${(circ / 12).toFixed(2)} ${((circ / 12) * 2).toFixed(2)}`}
        transform={`rotate(${(x * 7 + y * 3) % 90} ${x} ${y})`}
        opacity={0.9}
      />
      <circle cx={x} cy={y} r={r * 0.56} fill="none" stroke="rgba(0,0,0,.22)" strokeWidth={1} />
      <circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.42} fill="rgba(255,248,230,.18)" />
    </g>
  );
}

/** Part of a chit: `keep` draws what stays (1 - frac), otherwise only the frac slice that moves on. */
function Wedge({ x, y, r, chit, frac, keep }: { x: number; y: number; r: number; chit: ChitKey; frac: number; keep: boolean }) {
  const a0 = -Math.PI / 2;
  const a1 = a0 + Math.PI * 2 * (keep ? 1 - frac : frac);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (a: number) => `${(x + r * Math.cos(a)).toFixed(2)} ${(y + r * Math.sin(a)).toFixed(2)}`;
  const d = `M${x} ${y} L${p(a0)} A${r} ${r} 0 ${large} 1 ${p(a1)} Z`;
  return (
    <g>
      <path d={d} transform="translate(0 1.6)" fill="rgba(0,0,0,.3)" />
      <path d={d} fill={chitStyle(chit).face} stroke={INLAY} strokeOpacity={0.55} strokeWidth={0.8} />
      {keep ? <circle cx={x} cy={y} r={r} fill="none" stroke={INLAY} strokeOpacity={0.35} strokeDasharray="2 2" /> : null}
    </g>
  );
}

type TrayState = "" | "out" | "win";

function Tray({ i, label, value, state = "" }: { i: number; label: string; value: string; state?: TrayState }) {
  const x = TX[i]!;
  const dim = state === "out";
  const win = state === "win";
  return (
    <g>
      <rect x={x} y={TY} width={TW} height={TH} rx={14} fill={dim ? "#1d2e23" : "#24392c"} stroke={win ? "#e6cd85" : "rgba(0,0,0,.35)"} strokeWidth={win ? 2 : 1} />
      <rect x={x + 1.5} y={TY + 1.5} width={TW - 3} height={10} rx={9} fill="rgba(0,0,0,.18)" />
      <text x={x + TW / 2} y={TY + TH + 22} textAnchor="middle" className="fig-label" fill={dim ? "rgba(243,239,230,.55)" : "#f3efe6"}>
        {label}
      </text>
      <text x={x + TW / 2} y={TY + TH + 40} textAnchor="middle" className="fig-value" fill={win ? "#e6cd85" : dim ? "rgba(243,239,230,.6)" : "rgba(243,239,230,.8)"}>
        {value}
      </text>
    </g>
  );
}

/** n items in up to three columns, centred in tray i; `top` fixes the first row, `rows` reserves height. */
function grid(i: number, n: number, pitch: number, draw: (x: number, y: number, k: number) => ReactNode, top?: number, rows?: number): ReactNode[] {
  const cols = Math.min(3, n);
  const R = rows ?? Math.ceil(n / 3);
  const x0 = TX[i]! + TW / 2 - ((cols - 1) * pitch) / 2;
  const y0 = top ?? TY + TH / 2 - ((R - 1) * pitch) / 2;
  return Array.from({ length: n }, (_, k) => <g key={k}>{draw(x0 + (k % 3) * pitch, y0 + Math.floor(k / 3) * pitch, k)}</g>);
}

function Head({ children }: { children: ReactNode }) {
  return (
    <text x={286} y={21} textAnchor="end" className="fig-head">
      {children}
    </text>
  );
}

export function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 300 214" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  );
}

export type ThreeTrays = Array<{ label: string; chit: ChitKey; count: number }>;

/** Round 1: every ballot in its first choice's tray. */
export function DealFigure({ trays, head, label }: { trays: ThreeTrays; head: string; label: string }) {
  return (
    <Figure label={label}>
      {trays.map((t, i) => (
        <Tray key={t.label} i={i} label={t.label} value={String(t.count)} />
      ))}
      {trays.map((t, i) => grid(i, t.count, 26, (x, y) => <FigChit x={x} y={y} r={12} chit={t.chit} />, undefined, 3))}
      <Head>{head}</Head>
    </Figure>
  );
}

/** The smallest tray empties; its chits arc over to their next choice. */
export function ClearFigure({ trays, out, to, moved, label }: { trays: ThreeTrays; out: number; to: number; moved: number; label: string }) {
  const flying = [
    [236, 30],
    [212, 18],
    [188, 22],
    [164, 30],
  ].slice(0, Math.min(4, moved));
  return (
    <Figure label={label}>
      {trays.map((t, i) => (
        <Tray key={t.label} i={i} label={t.label} value={i === out ? "out" : i === to ? `${t.count} + ${moved}` : String(t.count)} state={i === out ? "out" : ""} />
      ))}
      {trays.map((t, i) => (i === out ? null : grid(i, t.count, 26, (x, y) => <FigChit x={x} y={y} r={12} chit={t.chit} />, undefined, 3)))}
      <path d="M244 62 C 240 14, 176 10, 166 52" fill="none" stroke="#e6cd85" strokeWidth={1.6} strokeDasharray="4 4" />
      <path d="M160 45 l6 9 l7 -7" fill="none" stroke="#e6cd85" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      {flying.map(([x, y]) => (
        <FigChit key={`${x}`} x={x!} y={y!} r={12} chit={trays[out]!.chit} />
      ))}
    </Figure>
  );
}

/** The next count: the receiving tray holds its own chits and the ones that moved in. */
export function WinFigure({
  trays,
  out,
  winner,
  received,
  label,
}: {
  trays: ThreeTrays;
  out: number;
  winner: number;
  received: { chit: ChitKey; count: number };
  label: string;
}) {
  return (
    <Figure label={label}>
      {trays.map((t, i) => (
        <Tray
          key={t.label}
          i={i}
          label={t.label}
          value={i === out ? "out" : i === winner ? `${t.count + received.count}, wins` : String(t.count)}
          state={i === out ? "out" : i === winner ? "win" : ""}
        />
      ))}
      {trays.map((t, i) =>
        i === out
          ? null
          : i === winner
            ? grid(i, t.count + received.count, 26, (x, y, k) => <FigChit x={x} y={y} r={12} chit={k < t.count ? t.chit : received.chit} />, undefined, 3)
            : grid(i, t.count, 26, (x, y) => <FigChit x={x} y={y} r={12} chit={t.chit} />, undefined, 3),
      )}
    </Figure>
  );
}

/** STV: the elected tray keeps 1 - f of every chit; slivers of f go on to the next choices. */
export function SurplusFigure({
  elected,
  others,
  fraction,
  head,
  label,
}: {
  elected: { label: string; chit: ChitKey; count: number; value: string };
  others: Array<{ label: string; chit: ChitKey; count: number; value: string; slivers: number }>;
  fraction: number;
  head: string;
  label: string;
}) {
  return (
    <Figure label={label}>
      <Tray i={0} label={elected.label} value={elected.value} state="win" />
      {others.slice(0, 2).map((o, k) => (
        <Tray key={o.label} i={k + 1} label={o.label} value={o.value} />
      ))}
      {grid(0, elected.count, 23, (x, y) => <Wedge x={x} y={y} r={10} chit={elected.chit} frac={fraction} keep />, TY + 16)}
      {others.slice(0, 2).map((o, k) => (
        <g key={o.label}>
          {grid(k + 1, o.count, 23, (x, y) => <FigChit x={x} y={y} r={10} chit={o.chit} />, TY + 16)}
          {grid(k + 1, o.slivers, 23, (x, y) => <Wedge x={x} y={y} r={9} chit={elected.chit} frac={fraction} keep={false} />, TY + 66)}
        </g>
      ))}
      <Head>{head}</Head>
    </Figure>
  );
}
