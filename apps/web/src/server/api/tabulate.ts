import { handle, json, readJson } from "../http";
import { checkRateLimit, LIMITS } from "../rateLimit";
import { runTabulation } from "../tabulation";
import { clientIp, type ApiDeps } from "./context";

/** Stateless: nothing about the request is stored except a per-IP counter. */
export function tabulateEndpoint(deps: ApiDeps) {
  return handle(async (req: Request) => {
    const { limit, windowSeconds } = LIMITS.tabulate;
    await checkRateLimit(deps.db(), `tabulate:${clientIp(req)}`, limit, windowSeconds, deps.now());
    const { output, rctab } = runTabulation(await readJson(req));
    return json(new URL(req.url).searchParams.get("format") === "rctab" ? rctab : output);
  });
}
