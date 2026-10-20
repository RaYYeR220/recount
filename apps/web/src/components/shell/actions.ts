"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

/** Ends the session (Better Auth clears the cookie) and goes home. */
export async function logOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
