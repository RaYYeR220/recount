import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safeNext";
import { getViewer } from "@/server/session";

/** Someone already signed in skips the form and goes where they were headed. Renders nothing. */
export async function SignedInRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  if (await getViewer()) redirect(next);
  return null;
}
