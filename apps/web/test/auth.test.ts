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

describe("sign-in throttling", () => {
  let auth: Auth;
  let clock = new Date("2026-10-19T12:00:00Z");

  const signIn = (email: string, password: string, ip: string) =>
    auth.api.signInEmail({ body: { email, password }, headers: new Headers({ "x-real-ip": ip }) });

  async function failTimes(email: string, times: number) {
    for (let i = 1; i <= times; i++) {
      const error = await rejection(signIn(email, `wrong-password-${i}`, `203.0.113.${i}`));
      expect(error.statusCode).toBe(401);
    }
  }

  beforeAll(async () => {
    auth = createAuth(await createTestDb(), () => clock);
    for (const name of ["eve", "fay", "gus"]) {
      await auth.api.signUpEmail({
        body: { name, email: `${name}@example.com`, password: `${name}-password` },
      });
    }
  });

  it("locks an email after 10 failed attempts, whatever the client IP", async () => {
    await failTimes("eve@example.com", 10);

    const eleventh = await rejection(signIn("eve@example.com", "wrong-again", "198.51.100.7"));
    expect(eleventh.statusCode).toBe(429);
    const rightPassword = await rejection(signIn(" EVE@example.com", "eve-password", "198.51.100.8"));
    expect(rightPassword.statusCode).toBe(429);
    await expect(signIn("fay@example.com", "fay-password", "198.51.100.7")).resolves.toBeTruthy();
  });

  it("lets the email in again once the 15 minute window has passed", async () => {
    await failTimes("gus@example.com", 10);
    await rejection(signIn("gus@example.com", "gus-password", "198.51.100.9"));

    clock = new Date(clock.getTime() + 15 * 60 * 1000);
    await expect(signIn("gus@example.com", "gus-password", "198.51.100.9")).resolves.toBeTruthy();
  });

  it("starts counting again after a successful sign-in", async () => {
    await failTimes("fay@example.com", 9);
    await signIn("fay@example.com", "fay-password", "198.51.100.10");
    await failTimes("fay@example.com", 10);
  });

  it("keys the per-IP limit on the platform client IP header, not x-forwarded-for", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const response = await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-real-ip": "192.0.2.10",
            "x-forwarded-for": `198.51.100.${100 + i}`,
          },
          body: JSON.stringify({ email: "nobody@example.com", password: "not-a-password" }),
        }),
      );
      statuses.push(response.status);
    }
    expect(statuses).toEqual([401, 401, 401, 429]);
  });
});
