import { notFound } from "next/navigation";

/** Prerendered as a 404; the proxy rewrites unknown or unshared polls here (see src/proxy.ts). */
export default function PollNotFoundStatus(): never {
  notFound();
}
