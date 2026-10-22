import { createHash, timingSafeEqual } from "node:crypto";
import { DomainError } from "../errors";
import { handle, json } from "../http";
import { purgeRateLimits, purgeTestData } from "../purge";
import type { ApiDeps } from "./context";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; without a configured secret nothing runs. */
function authorized(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export function purgeEndpoint(deps: ApiDeps, secret: () => string | undefined = () => process.env.CRON_SECRET) {
  return handle(async (req: Request) => {
    if (!authorized(req, secret())) throw new DomainError("unauthorized");
    const removed = await purgeTestData(deps.db(), deps.now());
    return json({ ...removed, rateLimits: await purgeRateLimits(deps.db(), deps.now()) });
  });
}
