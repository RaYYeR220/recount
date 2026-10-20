import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { getDb, type Db } from "./db/client";
import * as schema from "./db/schema";
import { DEMO_PERSONA_EMAILS } from "./demo";
import { DomainError } from "./errors";
import { checkRateLimit, clearRateLimit, LIMITS } from "./rateLimit";

const SIGN_IN_PATH = "/sign-in/email";

/**
 * Demo personas are exempt: their passwords are public, so locking them
 * protects nothing and would let anyone take the demo down.
 */
function signInKey(body: unknown): string | null {
  const email = (body as { email?: unknown } | undefined)?.email;
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return DEMO_PERSONA_EMAILS.includes(normalized) ? null : `sign-in:${normalized}`;
}

/**
 * A Vercel deployment answers on its own URL, its branch alias and (for
 * production) the project domain. Trust exactly those hosts, never a
 * wildcard like *.vercel.app. Outside Vercel, BETTER_AUTH_URL decides.
 */
export function authBaseURL(env: Record<string, string | undefined> = process.env): BetterAuthOptions["baseURL"] {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  const own = env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_BRANCH_URL;
  const hosts = [own, env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL].filter(
    (host): host is string => Boolean(host),
  );
  if (hosts.length === 0) return undefined;
  return { allowedHosts: [...new Set(hosts)], protocol: "https", fallback: `https://${hosts[0]}` };
}

export function createAuth(db: Db, clock: () => Date = () => new Date()) {
  return betterAuth({
    baseURL: authBaseURL(),
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "authRateLimit",
      customRules: {
        "/sign-in/email": { window: 60, max: 60 },
        "/sign-up/email": { window: 60, max: 30 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for", "x-real-ip"] },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const key = ctx.path === SIGN_IN_PATH ? signInKey(ctx.body) : null;
        if (!key) return;
        const { limit, windowSeconds } = LIMITS.emailSignIn;
        try {
          await checkRateLimit(db, key, limit, windowSeconds, clock());
        } catch (error) {
          if (error instanceof DomainError && error.code === "rate_limited") {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Too many sign-in attempts for this email. Try again later.",
            });
          }
          throw error;
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const key = ctx.path === SIGN_IN_PATH ? signInKey(ctx.body) : null;
        if (key && !(ctx.context.returned instanceof APIError)) {
          await clearRateLimit(db, key);
        }
      }),
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export const auth = createAuth(getDb());
