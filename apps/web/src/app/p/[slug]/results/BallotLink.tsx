"use client";

import { useParams } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";

/** Back to the poll's ballot; the 403 page gets no props, so the slug comes from the URL. */
export function BallotLink() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <ButtonLink href={`/p/${encodeURIComponent(slug)}`} variant="brass" size="lg">
      Go to the ballot
    </ButtonLink>
  );
}
