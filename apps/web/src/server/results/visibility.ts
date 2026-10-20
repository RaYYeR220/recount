import type { PollRow } from "../polls/detail";
import { pollStatus } from "../polls/status";

type VisibilityInput = Pick<
  PollRow,
  "ownerId" | "resultsVisibility" | "opensAt" | "closesAt" | "closedEarlyAt" | "createdAt"
>;

/**
 * live: anyone. after_close: the owner any time, everyone else once closed.
 * owner_only: the owner; to anyone else the results do not exist.
 */
export function canSeeResults(
  poll: VisibilityInput,
  viewerId: string | null,
  now: Date,
): "yes" | "hidden_until_close" | "not_found" {
  if (viewerId !== null && viewerId === poll.ownerId) return "yes";
  if (poll.resultsVisibility === "owner_only") return "not_found";
  if (poll.resultsVisibility === "after_close" && pollStatus(poll, now) !== "closed") {
    return "hidden_until_close";
  }
  return "yes";
}
