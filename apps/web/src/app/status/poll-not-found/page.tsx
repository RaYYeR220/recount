import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Named on the page as well as in not-found.tsx: the deployed 404 fell back to the bare site title.
export const metadata: Metadata = { title: "Poll not found" };

/** Prerendered as a 404; the proxy rewrites unknown or unshared polls here (see src/proxy.ts). */
export default function PollNotFoundStatus(): never {
  notFound();
}
