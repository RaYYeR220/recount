import type { Metadata } from "next";
import { forbidden } from "next/navigation";

export const metadata: Metadata = { title: "Results hidden" };

/** Prerendered as a 403; the proxy rewrites hidden results here (see src/proxy.ts). */
export default function ResultsHiddenStatus(): never {
  forbidden();
}
