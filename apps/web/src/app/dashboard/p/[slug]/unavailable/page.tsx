import { notFound } from "next/navigation";

/** Always not found, so there is no instant UI to validate. */
export const instant = false;

/**
 * Where the proxy sends a manage page the viewer may not open, missing or not
 * theirs alike. Not-found at build time, so it is served as a real 404.
 */
export default function ManageUnavailable() {
  notFound();
}
