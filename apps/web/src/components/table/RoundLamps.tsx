"use client";

import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import type { SceneRound } from "@/lib/countScene";

export type RoundLampsProps = {
  rounds: readonly SceneRound[];
  current: number;
  onSelect: (round: number) => void;
};

/**
 * One brass lamp per round on a gilt track. Click a lamp to jump to its round;
 * the arrow keys, Home and End scrub. Only the lit lamp is in the tab order.
 */
export function RoundLamps({ rounds, current, onSelect }: RoundLampsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const last = rounds.length - 1;

  // Keep the lit lamp in view when a long count scrolls sideways (never scrolls the page).
  useEffect(() => {
    const lamp = refs.current[current];
    const box = lamp?.closest<HTMLElement>(".ct-lamps");
    if (!lamp || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: lamp.offsetLeft - box.clientWidth / 2 + lamp.offsetWidth / 2, behavior: "smooth" });
  }, [current]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next =
      event.key === "ArrowRight" ? Math.min(last, current + 1)
      : event.key === "ArrowLeft" ? Math.max(0, current - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    if (next !== current) onSelect(next);
  }

  const fill = { "--fill": `${last > 0 ? (current / last) * 100 : 0}%` } as CSSProperties;
  return (
    <div className="ct-lamps" role="group" aria-label="Rounds" onKeyDown={onKeyDown}>
      <div className="ct-lamps-row">
        <div className="ct-track" aria-hidden="true">
          <div className="ct-fill" style={fill} />
        </div>
        {rounds.map((round, i) => (
          <button
            key={round.index}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            className="ct-lamp"
            aria-pressed={i === current}
            aria-label={`Round ${round.number}: ${round.label}`}
            data-done={i < current}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onSelect(i)}
          >
            <span className="ct-lamp-n" aria-hidden="true">
              {round.number}
            </span>
            <span className="ct-lamp-t" aria-hidden="true">
              {round.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
