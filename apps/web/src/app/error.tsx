"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/StatusPage";
import { Button, ButtonLink } from "@/components/ui/Button";

function digestOf(error: unknown): string | null {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string") return error.digest;
  return null;
}

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = digestOf(error);

  return (
    <StatusPage
      title="Something went wrong on our side."
      description="This part of the page failed to load. Trying again usually works; if it keeps happening, the reference below points us to it in the logs."
      actions={
        <>
          <Button variant="brass" size="lg" onClick={() => retry()}>
            Try again
          </Button>
          <ButtonLink href="/" variant="line" size="lg">
            Go home
          </ButtonLink>
        </>
      }
      footnote={digest ? <span className="mono">Reference {digest}</span> : null}
    />
  );
}
