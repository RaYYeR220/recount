"use client";

import { useSyncExternalStore } from "react";
import { ButtonLink } from "@/components/ui/Button";

const noSubscription = () => () => {};
const ballotPath = () => window.location.pathname.replace(/\/results\/?$/, "");
/** "." already lands on the ballot before the script runs. */
const serverPath = () => ".";

/**
 * Back to the ballot from a status page the proxy rewrote to: the page itself is
 * static, so the poll comes from the address bar.
 */
export function BallotLinkFromAddress() {
  const href = useSyncExternalStore(noSubscription, ballotPath, serverPath);
  return (
    <ButtonLink href={href} native variant="brass" size="lg">
      Go to the ballot
    </ButtonLink>
  );
}
