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
  countRef: Ref<HTMLSpanElement>;
};

/** A brass name plate on the front edge of a tray. */
export function Plaque({ tray, state, figure, multiSeat, countRef }: PlaqueProps) {
  const up = state.delta?.startsWith("+") && state.meta === state.delta;
  return (
    // State goes in data-state: the renderer adds is-wide to the class list, and a changing className would wipe it.
    <div className="plaque" data-state={state.state} data-tray={tray.id}>
      <div className="pl-top">
        <Chit index={tray.chit} size={12} />
        <span className="pl-name" title={tray.label}>
          {tray.short}
        </span>
        <span className="pl-badge">{multiSeat ? `Seat ${state.seat ?? ""}` : "Winner"}</span>
      </div>
      <span className="pl-count" ref={countRef}>
        {figure}
      </span>
      <span className="pl-meta">{up ? <span className="up">{state.meta}</span> : state.meta}</span>
    </div>
  );
}
