import { redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNext } from "@/lib/safeNext";
import { getViewer } from "@/server/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Sends someone already signed in where they were headed; otherwise carries ?next= in the form. */
async function NextInput({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNext((await searchParams).next);
  if (await getViewer()) redirect(next);
  return <input type="hidden" name="next" value={next} />;
}

/**
 * The only part of the auth forms that waits for the request. It streams in with the
 * page, before hydration, so even a form sent that early keeps its ?next=; the rest
 * of the form is static and nothing typed is swapped out. The action checks the value
 * again whatever it says.
 */
export function NextField({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<input type="hidden" name="next" value="" />}>
      <NextInput searchParams={searchParams} />
    </Suspense>
  );
}
