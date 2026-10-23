import type { Ref } from "react";
import { Chit } from "@/components/ui/Chit";
import type { SceneTray, TrayRound } from "@/lib/countScene";

export type PlaqueProps = {
  tray: SceneTray;
  /** State and plaque line for the round in view. */
  state: TrayRound;
  /** Figure shown (the last settled round; the count-up runs between). */
  figure: string;
  /** Several seats: the badge names the seat ("Seat 2") instead of "Winner". */
  multiSeat: boolean;
  /** The poll is still open: the badge says "Leading". */
  provisional?: boolean;
  countRef: Ref<HTMLSpanElement>;
};

/** A brass name plate on the front edge of a tray. */
export function Plaque({ tray, state, figure, multiSeat, provisional, countRef }: PlaqueProps) {
  const up = state.delta?.startsWith("+") && state.meta === state.delta;
  const badge = provisional ? "Leading" : multiSeat ? `Seat ${state.seat ?? ""}` : "Winner";
  return (
    // State goes in data-state: the renderer adds is-wide to the class list, and a changing className would wipe it.
    <div className="plaque" data-state={state.state} data-tray={tray.id}>
      <div className="pl-top">
        <Chit index={tray.chit} size={12} />
        <span className="pl-name" title={tray.label}>
          {tray.short}
        </span>
        <span className="pl-badge">{badge}</span>
      </div>
      <span className="pl-count" ref={countRef}>
        {figure}
      </span>
      <span className="pl-meta">{up ? <span className="up">{state.meta}</span> : state.meta}</span>
    </div>
  );
}
