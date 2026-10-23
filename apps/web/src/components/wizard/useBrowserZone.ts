"use client";

import { useSyncExternalStore } from "react";
import { ianaName } from "@/lib/timeZones";

const subscribe = () => () => {};

/**
 * The browser's zone under its IANA name if the server knows it (some browsers say
 * "Asia/Calcutta", others "Asia/Kolkata"; aliases are resolved first), else UTC.
 * Empty while server rendering, so the markup never depends on where it was rendered.
 */
export function useBrowserZone(zones: readonly string[]): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        const zone = ianaName(Intl.DateTimeFormat().resolvedOptions().timeZone);
        if (zones.includes(zone)) return zone;
        const canonical = ianaName(new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone);
        return zones.includes(canonical) ? canonical : "UTC";
      } catch {
        return "UTC";
      }
    },
    () => "",
  );
}
