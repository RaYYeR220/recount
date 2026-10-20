"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { safeNext } from "@/lib/safeNext";
import { auth } from "@/server/auth";

export type AuthFormState = {
  /** A message for the whole form, read out as an alert. */
  error?: string;
  fields?: { email?: string; password?: string };
  /** What was typed, so a failed attempt keeps the email. */
  email?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

function read(form: FormData) {
  return {
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    next: safeNext(form.get("next")),
  };
}

export async function logIn(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const { email, password, next } = read(form);
  if (!email || !password) {
    return {
      email,
      fields: {
        email: email ? undefined : "Enter your email.",
        password: password ? undefined : "Enter your password.",
      },
    };
  }
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof APIError && error.statusCode === 429) {
      return { email, error: "Too many sign-in attempts for this email. Try again in 15 minutes." };
    }
    if (error instanceof APIError && error.statusCode < 500) return { email, error: "Wrong email or password." };
    throw error;
  }
  redirect(next);
}

export async function signUp(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const { email, password, next } = read(form);
  const fields: AuthFormState["fields"] = {};
  if (!EMAIL.test(email)) fields.email = "Enter an email address, like name@example.com.";
  if (password.length < MIN_PASSWORD) fields.password = `Use at least ${MIN_PASSWORD} characters.`;
  else if (password.length > MAX_PASSWORD) fields.password = `Use at most ${MAX_PASSWORD} characters.`;
  if (fields.email || fields.password) return { email, fields };

  try {
    await auth.api.signUpEmail({
      body: { name: email.slice(0, email.indexOf("@")), email, password },
      headers: await headers(),
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof APIError && error.statusCode === 422) {
      return { email, fields: { email: "There is already an account with this email. Sign in instead." } };
    }
    if (error instanceof APIError && error.statusCode === 429) {
      return { email, error: "Too many new accounts from your network. Try again in a minute." };
    }
    if (error instanceof APIError && error.statusCode < 500) {
      return { email, error: "That didn't work. Check the email and password and try again." };
    }
    throw error;
  }
  redirect(next);
}
