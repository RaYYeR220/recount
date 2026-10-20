import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPage } from "./StatusPage";

/** Same words for a missing poll and one the viewer may not see, so neither leaks the other. */
export const NOT_FOUND_POLL_COPY = "This poll doesn't exist or isn't shared with you.";

export type NotFoundPollProps = {
  /** Hide "Sign in" when the page knows the viewer is signed in already. */
  signedIn?: boolean;
};

/**
 * The page for a poll that doesn't exist or isn't shared with the viewer. Render it
 * from the poll routes' not-found.tsx (after calling notFound(), which sends 404).
 */
export function NotFoundPoll({ signedIn = false }: NotFoundPollProps) {
  return (
    <StatusPage
      title={NOT_FOUND_POLL_COPY}
      description="Check the link you were sent. If the poll is private, sign in with the account it was shared with, or ask its organiser to share it again."
      actions={
        <>
          <ButtonLink href="/dashboard" variant="brass" size="lg">
            Go to your polls
          </ButtonLink>
          {signedIn ? null : (
            <ButtonLink href="/login" variant="line" size="lg">
              Sign in
            </ButtonLink>
          )}
        </>
      }
      footnote={
        <>
          Looking for a public election? <Link href="/elections">Browse the replays</Link>.
        </>
      }
    />
  );
}
