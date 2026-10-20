"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Caption, RoundLamps, RoundsTable, TableRenderer } from "@/components/table";
import { easeOutCubic, figureBetween } from "@/components/table/countUp";
import { Button } from "@/components/ui/Button";
import { buildCountScene } from "@/lib/countScene";
import type { HeroTableInput } from "./heroData";
import { compactHeight, fitPlates, HERO_HEADROOM, HERO_WIDE, heroLayout } from "./heroLayout";
import { HeroPlaque } from "./HeroPlaque";

export type HeroCountProps = {
  /** Rounds and trays, counted by the engine at build; the scene is made here. */
  input: HeroTableInput;
  /** The paper lid: headline, lede and the two calls to action. */
  claim: ReactNode;
  /** The report card behind the table, on the right. */
  proof: ReactNode;
  proofLabel: string;
  railLabel: string;
};

/**
 * The landing hero: the claim and the official report standing behind a walnut
 * table, a real count dealt onto it, brass plates on its front edge and a rail of
 * round lamps underneath. On phones it unfolds into claim, table, plates, rail,
 * report. With reduced motion it opens on the final round and nothing flies.
 */
export function HeroCount({ input, claim, proof, proofLabel, railLabel }: HeroCountProps) {
  const scene = useMemo(() => buildCountScene({ ...input, noun: "candidate" }), [input]);
  const last = scene.rounds.length - 1;
  const [round, setRound] = useState(0);
  const [settled, setSettled] = useState(0);
  const [boardTop, setBoardTop] = useState<number | null>(null);
  const [measured, setMeasured] = useState(false);
  /** The first round is on the table (dealt, or shown at once with reduced motion). */
  const [ready, setReady] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const claimRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TableRenderer | null>(null);
  const counts = useRef(new Map<string, HTMLSpanElement>());
  const settledRef = useRef(0);
  const tween = useRef(0);
  const captionId = useId();
  const compact = useMemo(() => compactHeight(scene), [scene]);

  // On wide heroes the table starts just under the claim and the report's figures,
  // so no stack ever covers a word. Measured before the table is first drawn.
  useLayoutEffect(() => {
    const hero = heroRef.current;
    const stage = stageRef.current;
    const claimBox = claimRef.current;
    const proofBox = proofRef.current;
    if (!hero || !stage || !claimBox || !proofBox) return;
    const measure = () => {
      if (hero.clientWidth >= HERO_WIDE) {
        const top = stage.getBoundingClientRect().top;
        const bottom = Math.max(claimBox.getBoundingClientRect().bottom, proofBox.getBoundingClientRect().bottom);
        setBoardTop(Math.round(bottom - top + 14 - HERO_HEADROOM));
      }
      setMeasured(true);
    };
    measure();
    const watch = new ResizeObserver(measure);
    for (const el of [hero, claimBox, proofBox]) watch.observe(el);
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!measured || !canvas || !stage || last < 0) return;
    const renderer = new TableRenderer(canvas, stage, scene, heroLayout, { round: 0, hidden: true });
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
        const landed = scene.rounds[e.round]!;
        for (const t of scene.trays) {
          const text = counts.current.get(t.id)?.firstChild;
          if (text) text.nodeValue = landed.trays[t.id]!.tally;
        }
        settledRef.current = e.round;
        setSettled(e.round);
        setReady(true);
      } else if (e.type === "layout" && e.plaques === "overlay") {
        fitPlates([...stage.querySelectorAll<HTMLElement>(".hero-plaques .plaque")]);
      }
    });

    let watcher: IntersectionObserver | null = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) renderer.goTo(last, { animate: false });
    else {
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
  }, [scene, last, measured]);

  if (last < 0) return null;

  const view = scene.rounds[round]!;
  const shown = scene.rounds[settled]!;
  const goTo = (i: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.goTo(i, { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
  };
  const style = {
    "--board-h-compact": compact,
    ...(boardTop === null ? {} : { "--board-top": `${boardTop}px` }),
  } as CSSProperties;

  return (
    <div
      className="hero-inner"
      ref={heroRef}
      style={style}
      data-ready={ready}
      data-round={round + 1}
      data-settled={settled + 1}
      // The compact table's height comes from trigonometry; engines may differ in the last digit.
      suppressHydrationWarning
    >
      <div className="hero-back">
        <div className="wrap grid12 hero-grid">
          <div className="hero-lid">
            <div className="hero-claim" ref={claimRef}>
              {claim}
            </div>
          </div>
        </div>
      </div>

      <div className="hero-stage" ref={stageRef}>
        <div className="hero-board">
          <canvas ref={canvasRef} aria-hidden="true" />
        </div>
        <div className="hero-plaques" aria-hidden="true">
          {scene.trays.map((tray) => (
            <HeroPlaque
              key={tray.id}
              scene={scene}
              tray={tray}
              round={round}
              figure={shown.trays[tray.id]!.tally}
              countRef={(el) => {
                if (el) counts.current.set(tray.id, el);
                else counts.current.delete(tray.id);
              }}
            />
          ))}
        </div>
      </div>

      <div className="hero-rail" role="group" aria-label={railLabel} aria-describedby={captionId}>
        <div className="wrap hero-rail-inner">
          <RoundLamps rounds={scene.rounds} current={round} onSelect={goTo} />
          <div className="hero-words">
            <p className="hero-caption" id={captionId} aria-live="polite">
              <Caption parts={view.caption} />
            </p>
            <p className="hero-footnote">{input.footnote}</p>
          </div>
          <div className="hero-actions">
            <Button variant="brass" size="lg" onClick={() => goTo(round === last ? 0 : round + 1)}>
              {round === last ? "Count again" : "Next round"}
            </Button>
          </div>
        </div>
      </div>

      <div className="hero-front">
        <div className="wrap grid12 hero-grid">
          <aside className="hero-proof" aria-label={proofLabel}>
            <div className="hero-proof-body" ref={proofRef}>
              {proof}
            </div>
          </aside>
        </div>
      </div>

      {/* A table never shrinks to its 1px box, so its own box clips it. */}
      <div className="sr-only">
        <RoundsTable scene={scene} title={input.title} />
      </div>
    </div>
  );
}
