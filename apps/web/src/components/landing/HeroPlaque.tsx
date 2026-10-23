import type { Ref } from "react";
import { Chit } from "@/components/ui/Chit";
import type { CountScene, SceneTray } from "@/lib/countScene";
import { toUnits } from "@/lib/votes";

/** "43.8%": share of the ballots still counting, to one place, rounded half up in exact units. */
export function shareOf(value: string, active: string, dp: number): string {
  const a = toUnits(active, dp);
  if (a <= 0n) return "0.0%";
  const permille = (toUnits(value, dp) * 2000n + a) / (2n * a);
  return `${permille / 10n}.${permille % 10n}%`;
}

/** The plate's small line: the change this round in green, then the share; or when the tray went out. */
export function plaqueLine(scene: CountScene, round: number, trayId: string): { delta: string | null; rest: string } {
  const r = scene.rounds[round]!;
  const t = r.trays[trayId]!;
  if (t.state === "out") {
    const outAt = scene.rounds.findIndex((x) => x.trays[trayId]!.state === "out");
    return { delta: null, rest: `Out in round ${outAt + 1}` };
  }
  if (t.state === "inactive") {
    if (t.delta) return { delta: t.delta, rest: "" };
    // An empty tray reads "none yet" or "none", as the scene words it.
    return { delta: null, rest: toUnits(t.raw, scene.dp) === 0n ? t.meta : "no choices left" };
  }
  return { delta: round > 0 ? t.delta : null, rest: shareOf(t.raw, r.activeTotal, scene.dp) };
}

type Props = { scene: CountScene; tray: SceneTray; round: number; figure: string; countRef: Ref<HTMLSpanElement> };

/** A brass plate on the table's front edge: name, exact figure, change and share. */
export function HeroPlaque({ scene, tray, round, figure, countRef }: Props) {
  const state = scene.rounds[round]!.trays[tray.id]!;
  const line = plaqueLine(scene, round, tray.id);
  return (
    // The class list stays fixed: the table adds is-wide to it, and a changing className would wipe that.
    <div className="plaque" data-state={state.state} data-tray={tray.id}>
      <div className="pl-top">
        <Chit index={tray.chit} size={12} />
        <span className="pl-name" title={tray.label}>
          {tray.short}
        </span>
        <span className="pl-badge">Winner</span>
      </div>
      <span className="pl-count" ref={countRef}>
        {figure}
      </span>
      <span className="pl-meta">
        {line.delta ? <span className={line.delta.startsWith("+") ? "up" : undefined}>{line.delta}</span> : null}
        {line.delta && line.rest ? " " : null}
        {line.rest}
      </span>
    </div>
  );
}
