"use client";

import { useSyncExternalStore } from "react";
import { formatWhen } from "@/lib/when";

const subscribe = () => () => {};

/**
 * The same moment on the reader's own clock, named as such, when their zone differs
 * from the poll's. Rendered after hydration only: the server can't know the zone.
 */
export function ViewerTime({ at, pollZone }: { at: Date; pollZone: string }) {
  const zone = useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );
  if (!zone || zone === pollZone) return null;
  return (
    <span className="block text-sm text-ink-3">
      That&apos;s {formatWhen(at, zone)} in your time zone ({zone}).
    </span>
  );
}
