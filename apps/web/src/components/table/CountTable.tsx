"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { CountScene } from "@/lib/countScene";
import { cx } from "@/lib/cx";
import { formatCount } from "@/lib/votes";
import { Caption } from "./Caption";
import { easeOutCubic, figureBetween } from "./countUp";
import { OVERLAY_MAX_TRAYS, panelLayout, type LayoutFn } from "./layout";
import { Plaque } from "./Plaque";
import { RoundLamps } from "./RoundLamps";
import { RoundsTable } from "./RoundsTable";
import { tableHeights } from "./sizing";
import { TableRenderer } from "./TableRenderer";

export type CountTableProps = {
  /** From buildCountScene(): real engine rounds, never hand-written figures. */
  scene: CountScene;
  /** Accessible name of the table and its data table. */
  title?: string;
  /** Tray arrangement and camera per width. Default: the results panel. */
  layout?: LayoutFn;
  /** Line under the caption. Default explains what a chit is; false hides it. */
  footnote?: ReactNode | false;
  className?: string;
};

function defaultFootnote(scene: CountScene): string {
  const per = scene.ballotsPerChit === 1 ? "one ballot" : `${formatCount(scene.ballotsPerChit)} ballots`;
  const sliver = scene.multiSeat ? " A surplus moves on as thin slivers of chits." : "";
  return `Each chit is ${per} and keeps its first-choice colour. Face down means no choices left.${sliver} Plaques show exact counts.`;
}

/**
 * The count table: trays of chits on walnut, a brass plaque per option, and a rail
 * of round lamps. Next round flies the ballots that move; the lamps and the arrow
 * keys scrub. With reduced motion it opens on the final round and nothing flies.
 */
export function CountTable({ scene, title = "The count, round by round", layout = panelLayout, footnote, className }: CountTableProps) {
  const last = scene.rounds.length - 1;
  const [round, setRound] = useState(0);
  const [settled, setSettled] = useState(0);
  const [plaqueMode, setPlaqueMode] = useState(scene.trays.length <= OVERLAY_MAX_TRAYS ? "overlay" : "grid");
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TableRenderer | null>(null);
  const counts = useRef(new Map<string, HTMLSpanElement>());
  const settledRef = useRef(0);
  const tween = useRef(0);
  const captionId = useId();
  const heights = useMemo(() => tableHeights(scene, layout), [scene, layout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || last < 0) return;
    const renderer = new TableRenderer(canvas, stage, scene, layout, { round: 0, hidden: true });
    rendererRef.current = renderer;

    const countUp = (target: number, ms: number) => {
      cancelAnimationFrame(tween.current);
      const from = scene.rounds[settledRef.current]!;
      const to = scene.rounds[target]!;
      const moving = scene.trays.filter((t) => from.trays[t.id]!.raw !== to.trays[t.id]!.raw);
      if (ms <= 0 || moving.length === 0) return;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        for (const t of moving) {
          const text = counts.current.get(t.id)?.firstChild;
          if (text) text.nodeValue = figureBetween(from.trays[t.id]!.raw, to.trays[t.id]!.raw, scene.dp, easeOutCubic(p));
        }
        if (p < 1) tween.current = requestAnimationFrame(step);
      };
      tween.current = requestAnimationFrame(step);
    };

    const off = renderer.on((e) => {
      if (e.type === "round") setRound(e.to);
      else if (e.type === "start") countUp(e.round, e.deal ? 0 : Math.max(600, e.total - 150));
      else if (e.type === "settled") {
        cancelAnimationFrame(tween.current);
        // Land every figure exactly; React's next render writes the same text.
        const landed = scene.rounds[e.round]!;
        for (const t of scene.trays) {
          const text = counts.current.get(t.id)?.firstChild;
          if (text) text.nodeValue = landed.trays[t.id]!.tally;
        }
        settledRef.current = e.round;
        setSettled(e.round);
      } else if (e.type === "layout") setPlaqueMode(e.plaques);
    });

    let watcher: IntersectionObserver | null = null;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) renderer.goTo(last, { animate: false });
    else {
      // Deal the first round once the table is on screen.
      watcher = new IntersectionObserver(
        (entries) => {
          if (!entries.some((en) => en.isIntersecting)) return;
          watcher?.disconnect();
          renderer.goTo(0, { deal: true });
        },
        { threshold: 0.2 },
      );
      watcher.observe(stage);
    }

    return () => {
      off();
      watcher?.disconnect();
      cancelAnimationFrame(tween.current);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [scene, layout, last]);

  if (last < 0) return null;

  const view = scene.rounds[round]!;
  const shown = scene.rounds[settled]!;
  const goTo = (i: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.goTo(i, { animate: !reduce });
  };
  const style = { "--ct-h-wide": heights.wide, "--ct-h-compact": heights.compact } as CSSProperties;

  return (
    <section
      className={cx("count-table", className)}
      aria-label={title}
      style={style}
      // The box height comes from trigonometry; engines may differ in the last digit.
      suppressHydrationWarning
      data-plaques={plaqueMode}
      data-lamp-labels={scene.rounds.length <= 5}
      data-many-rounds={scene.rounds.length > 8}
      data-round={round + 1}
      data-settled={settled + 1}
    >
      <div className="ct-stage" ref={stageRef}>
        <div className="ct-box">
          <canvas ref={canvasRef} aria-hidden="true" />
        </div>
        <div className="ct-plaques" aria-hidden="true">
          {scene.trays.map((tray) => (
            <Plaque
              key={tray.id}
              tray={tray}
              state={view.trays[tray.id]!}
              figure={shown.trays[tray.id]!.tally}
              multiSeat={scene.multiSeat}
              countRef={(el) => {
                if (el) counts.current.set(tray.id, el);
                else counts.current.delete(tray.id);
              }}
            />
          ))}
        </div>
      </div>
      <div className="ct-rail" role="group" aria-label="Count controls" aria-describedby={captionId}>
        <RoundLamps rounds={scene.rounds} current={round} onSelect={goTo} />
        <div className="ct-words">
          <p className="ct-caption" id={captionId} aria-live="polite">
            <Caption parts={view.caption} />
          </p>
          {footnote === false ? null : <p className="ct-footnote">{footnote ?? defaultFootnote(scene)}</p>}
        </div>
        <div className="ct-actions">
          <Button variant="brass" onClick={() => goTo(round === last ? 0 : round + 1)}>
            {round === last ? "Count again" : "Next round"}
          </Button>
        </div>
      </div>
      <RoundsTable scene={scene} title={title} />
    </section>
  );
}
