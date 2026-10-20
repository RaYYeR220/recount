import { formatUnits, toUnits } from "@/lib/votes";

/**
 * A figure part of the way from one engine value to the next, in the count's own
 * fixed-point units, for the plaques' count-up. `t` runs 0..1; at 1 it is exactly
 * the target as the engine printed it.
 */
export function figureBetween(from: string, to: string, dp: number, t: number): string {
  if (t >= 1) return formatUnits(toUnits(to, dp), dp);
  const a = Number(toUnits(from, dp));
  const b = Number(toUnits(to, dp));
  return formatUnits(BigInt(Math.round(a + (b - a) * t)), dp);
}

export const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
