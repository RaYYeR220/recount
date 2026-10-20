import type { CountScene } from "@/lib/countScene";
import { fittedHeight } from "./camera";
import { buildGeometry, COMPACT_BELOW, type LayoutFn } from "./layout";
import { placeChits, trayNeeds } from "./placement";

/**
 * The table box's height as a CSS length for each regime (wide, compact), worked out
 * with the renderer's own camera. Within a regime the picture scales with the
 * content width while the apron keeps its pixel height, so the fitted height is
 * a + b·width: two measurements give it exactly, and the box ships with the server
 * HTML at its final size, before any script runs.
 */
export function tableHeights(scene: CountScene, layout: LayoutFn): { wide: string; compact: string } {
  const needs = trayNeeds(scene);
  const height = (width: number) => {
    const L = layout({ width, trays: needs });
    const { heights } = placeChits(scene, L.perStack);
    return fittedHeight(L, buildGeometry(L), heights, width);
  };
  const line = (w1: number, w2: number) => {
    const h1 = height(w1);
    const b = (height(w2) - h1) / (w2 - w1);
    const a = h1 - b * w1;
    return `calc(${a.toFixed(1)}px + ${(b * 100).toFixed(2)}cqi)`;
  };
  return { wide: line(COMPACT_BELOW + 60, 1300), compact: line(320, COMPACT_BELOW - 20) };
}
