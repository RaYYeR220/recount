import { headers } from "next/headers";
import { Suspense } from "react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { curlFor } from "./examples";
import type { Operation } from "./operations";

/** This deployment's own origin, from the request. */
async function origin(): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? (/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

async function CurlForOrigin({ op }: { op: Operation }) {
  const base = await origin();
  return <CodeBlock code={curlFor(op, base ?? "$RECOUNT_URL")} language="shell" label={`Example: ${op.method.toUpperCase()} ${op.url}`} className="dev-curl" />;
}

/**
 * The operation's curl line against this site. It reads the request, so it streams
 * in; until then the same block shows $RECOUNT_URL, with the same lines.
 */
export function Curl({ op }: { op: Operation }) {
  return (
    <Suspense
      fallback={<CodeBlock code={curlFor(op, "$RECOUNT_URL")} language="shell" label={`Example: ${op.method.toUpperCase()} ${op.url}`} className="dev-curl" />}
    >
      <CurlForOrigin op={op} />
    </Suspense>
  );
}
