"use client";

import { useState, useTransition } from "react";
import { revokeToken } from "@/app/settings/actions";
import { Button } from "@/components/ui";

/** Revoke asks once more; scripts using the token stop working at once. */
export function RevokeTokenButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="line" size="sm" onClick={() => setConfirming(true)}>
        Revoke<span className="sr-only"> {name}</span>
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {error ? (
        <span role="alert" className="text-xs font-bold text-fail">
          {error}
        </span>
      ) : null}
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={() =>
          startTransition(async () => {
            const result = await revokeToken(id);
            if (result.error) setError(result.error);
          })
        }
      >
        {pending ? "Revoking…" : "Yes, revoke"}
        <span className="sr-only"> {name}</span>
      </Button>
      <Button variant="quiet" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        Keep
      </Button>
    </span>
  );
}
