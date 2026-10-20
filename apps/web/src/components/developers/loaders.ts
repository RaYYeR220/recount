import { cacheLife } from "next/cache";
import { lunchRequest } from "@/components/landing/apiExample";
import { compactJson } from "@/lib/compactJson";
import { runTabulation } from "@/server/tabulation";
import { buildEngineExample } from "./engineExample";

/** The examples' real outputs, counted by the engine while the page is built. */
export async function getDeveloperExamples() {
  "use cache";
  cacheLife("max");
  const { output } = runTabulation(lunchRequest());
  return JSON.parse(JSON.stringify({ tabulateResponse: compactJson(output, 58), engine: buildEngineExample() })) as {
    tabulateResponse: string;
    engine: ReturnType<typeof buildEngineExample>;
  };
}
