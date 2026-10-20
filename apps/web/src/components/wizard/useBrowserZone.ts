"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * The browser's IANA zone if the server knows it (canonicalised: some browsers say
 * "Asia/Calcutta", others "Asia/Kolkata"), else UTC. Empty while server rendering,
 * so the markup never depends on where it was rendered.
 */
export function useBrowserZone(zones: readonly string[]): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (zones.includes(zone)) return zone;
        const canonical = new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
        return zones.includes(canonical) ? canonical : "UTC";
      } catch {
        return "UTC";
      }
    },
    () => "",
  );
}
