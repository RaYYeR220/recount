import type { Db } from "./db/client";
import { checkRateLimit, LIMITS } from "./rateLimit";

/** The same headers Better Auth reads the client address from (advanced.ipAddress). */
const IP_HEADERS = ["x-vercel-forwarded-for", "x-real-ip"];

export function clientIpFrom(requestHeaders: Headers): string | null {
  for (const name of IP_HEADERS) {
    const value = requestHeaders.get(name)?.split(",")[0]?.trim();
    if (value) return value;
  }
  return null;
}

/**
 * Per-IP limits for signing in and up through the server actions. Better Auth's own
 * per-IP rules only run in its HTTP router, which the actions bypass. Demo personas
 * are not exempt here: only the per-email limit spares them. Without a client
 * address (local development) there is nothing to key on, so nothing is limited.
 */
export async function limitAuthAttempt(
  db: Db,
  kind: "signIn" | "signUp",
  requestHeaders: Headers,
  now: Date,
): Promise<void> {
  const ip = clientIpFrom(requestHeaders);
  if (!ip) return;
  const { limit, windowSeconds } = kind === "signIn" ? LIMITS.signInIp : LIMITS.signUpIp;
  await checkRateLimit(db, `${kind === "signIn" ? "sign-in-ip" : "sign-up-ip"}:${ip}`, limit, windowSeconds, now);
}
