"use client";

import { useSyncExternalStore } from "react";
import { CopyButton } from "@/components/CopyButton";
import { Input } from "@/components/ui";

const subscribe = () => () => {};

/** The voter link in full, ready to copy. Server rendering shows the path until the origin is known. */
export function ShareLink({ path }: { path: string }) {
  const url = useSyncExternalStore(
    subscribe,
    () => `${window.location.origin}${path}`,
    () => path,
  );
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label htmlFor="share-link" className="sr-only">
        Voter link
      </label>
      <Input id="share-link" mono readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-[1_1_16rem]" />
      <CopyButton text={url} done="Link copied." variant="ink">
        Copy link
      </CopyButton>
    </div>
  );
}
