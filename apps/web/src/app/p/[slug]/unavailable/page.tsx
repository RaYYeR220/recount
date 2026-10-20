import { notFound } from "next/navigation";

/** Always not found, so there is no instant UI to validate. */
export const instant = false;

/**
 * Where the proxy sends a poll that doesn't exist. It is not-found at build time
 * already, so it is served as a real 404 with the poll not-found page.
 */
export default function PollUnavailable() {
  notFound();
}
