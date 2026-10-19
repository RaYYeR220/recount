import { APIError } from "better-auth/api";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuth, type Auth } from "@/server/auth";
import { viewerFrom } from "@/server/session";
import { createTestDb } from "./db";

function cookieHeader(setCookies: string[]): Headers {
  const pairs = setCookies.map((c) => c.split(";")[0]);
  return new Headers({ cookie: pairs.join("; ") });
}

async function rejection(promise: Promise<unknown>): Promise<APIError> {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(APIError);
  return error as APIError;
}

describe("email and password auth", () => {
  let auth: Auth;

  beforeAll(async () => {
    auth = createAuth(await createTestDb());
  });

  it("signs up, signs in and resolves the session to a viewer", async () => {
    const signUp = await auth.api.signUpEmail({
      body: { name: "Ada", email: "ada@example.com", password: "recount-demo-ada" },
    });
    expect(signUp.token).toBeTruthy();

    const signIn = await auth.api.signInEmail({
      body: { email: "ada@example.com", password: "recount-demo-ada" },
      returnHeaders: true,
    });
    const viewer = await viewerFrom(auth, cookieHeader(signIn.headers.getSetCookie()));
    expect(viewer).toEqual({ id: signUp.user.id, email: "ada@example.com", name: "Ada" });
  });

  it("returns no viewer without a session cookie", async () => {
    expect(await viewerFrom(auth, new Headers())).toBeNull();
  });

  it("rejects a wrong password", async () => {
    await auth.api.signUpEmail({
      body: { name: "Bea", email: "bea@example.com", password: "right-password" },
    });
    const error = await rejection(
      auth.api.signInEmail({ body: { email: "bea@example.com", password: "wrong-password" } }),
    );
    expect(error.statusCode).toBe(401);
  });

  it("rejects a duplicate email", async () => {
    await auth.api.signUpEmail({
      body: { name: "Cy", email: "cy@example.com", password: "first-password" },
    });
    const error = await rejection(
      auth.api.signUpEmail({
        body: { name: "Cy again", email: "CY@example.com", password: "second-password" },
      }),
    );
    expect(error.statusCode).toBe(422);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const error = await rejection(
      auth.api.signUpEmail({
        body: { name: "Dee", email: "dee@example.com", password: "1234567" },
      }),
    );
    expect(error.statusCode).toBe(400);
  });
});
