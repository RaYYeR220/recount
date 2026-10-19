import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { getDb, type Db } from "./db/client";
import * as schema from "./db/schema";
import { DomainError } from "./errors";
import { checkRateLimit, clearRateLimit, LIMITS } from "./rateLimit";

const SIGN_IN_PATH = "/sign-in/email";

function signInKey(body: unknown): string | null {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? `sign-in:${email.trim().toLowerCase()}` : null;
}

export function createAuth(db: Db, clock: () => Date = () => new Date()) {
  return betterAuth({
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
