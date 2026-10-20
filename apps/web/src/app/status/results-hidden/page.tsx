import { forbidden } from "next/navigation";

/** Prerendered as a 403; the proxy rewrites hidden results here (see src/proxy.ts). */
export default function ResultsHiddenStatus(): never {
  forbidden();
}
