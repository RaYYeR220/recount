"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Back to the ballot from a status page the proxy rewrote to: the page itself is
 * static, so the poll comes from the address bar. "." already lands on the ballot
 * before the script runs.
 */
export function BallotLinkFromAddress() {
  const [href, setHref] = useState(".");
  useEffect(() => setHref(window.location.pathname.replace(/\/results\/?$/, "")), []);
  return (
    <ButtonLink href={href} native variant="brass" size="lg">
      Go to the ballot
    </ButtonLink>
  );
}
