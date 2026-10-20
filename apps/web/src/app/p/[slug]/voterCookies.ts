import { cookies } from "next/headers";
import { randomString } from "@/server/ids";

/**
 * The voter token: one per browser, httpOnly, kept 400 days (the longest browsers
 * allow). Link-mode polls take one ballot per token, so it is set the first time
 * this browser casts and never changes after.
 */
const VOTER_COOKIE = "rk_voter";
const VOTER_MAX_AGE = 400 * 24 * 60 * 60;

/** The receipt, carried for a few minutes from the cast to the receipt page. */
const RECEIPT_COOKIE = "rk_receipt";
const RECEIPT_MAX_AGE = 15 * 60;

const secure = process.env.NODE_ENV === "production";

export async function readVoterToken(): Promise<string> {
  return (await cookies()).get(VOTER_COOKIE)?.value ?? "";
}

/** The browser's token, minted on its first ballot. Only server actions can call this. */
export async function ensureVoterToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VOTER_COOKIE)?.value;
  if (existing) return existing;
  const token = randomString(32);
  jar.set(VOTER_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: VOTER_MAX_AGE });
  return token;
}

export async function flashReceipt(slug: string, receipt: string): Promise<void> {
  (await cookies()).set(RECEIPT_COOKIE, receipt, { httpOnly: true, sameSite: "lax", secure, path: `/p/${slug}`, maxAge: RECEIPT_MAX_AGE });
}

export async function readFlashedReceipt(): Promise<string | null> {
  return (await cookies()).get(RECEIPT_COOKIE)?.value ?? null;
}
