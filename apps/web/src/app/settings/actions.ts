"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createApiToken, revokeApiToken } from "@/server/apiTokens";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { requireViewer } from "@/server/session";

export type TokenState = { token?: string; name?: string; error?: string };

/** Creates a token and hands its value back once; only its hash is stored. */
export async function createToken(_prev: TokenState, form: FormData): Promise<TokenState> {
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 60) return { error: "Name the token in 1 to 60 characters, like “Deploy script”." };
  let token: string;
  try {
    const viewer = await requireViewer();
    token = (await createApiToken(getDb(), viewer.id, name, new Date())).token;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError && error.code === "unauthorized") return { error: "Your session ended. Sign in again, then try once more." };
    throw error;
  }
  refresh();
  return { token, name };
}

export async function revokeToken(id: string): Promise<{ error?: string }> {
  try {
    const viewer = await requireViewer();
    await revokeApiToken(getDb(), viewer.id, id);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError && error.code === "not_found") return { error: "That token is already gone." };
    if (error instanceof DomainError && error.code === "unauthorized") return { error: "Your session ended. Sign in again, then try once more." };
    throw error;
  }
  refresh();
  return {};
}
