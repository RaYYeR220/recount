import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createApiToken } from "@/server/apiTokens";
import { closePollEndpoint, createPollEndpoint, getPollEndpoint } from "@/server/api/polls";
import type { Db } from "@/server/db/client";
import { GET as getOpenApi } from "@/app/api/v1/openapi.json/route";
import { call, postJson, type CallInit, type Handler } from "./apiClient";
import { createTestDb } from "./db";
import { T0, createUser, minutesAfter, pollInput } from "./factories";

describe("API v1 polls", () => {
  let db: Db;
  let now = T0;
  const deps = { db: () => db, now: () => now };
  const createRoute = createPollEndpoint(deps) as Handler;
  const getRoute = getPollEndpoint(deps) as Handler;
  const closeRoute = closePollEndpoint(deps) as Handler;
  let adaToken: string;
  let adaEmail: string;
  let rivalToken: string;

  async function createVia(token: string) {
    const response = await call(createRoute, "/polls", postJson(pollInput(), { token }));
    expect(response.status).toBe(201);
    return (await response.json()) as { slug: string };
  }

  beforeAll(async () => {
    db = await createTestDb();
    const ada = await createUser(db, "Ada");
    adaEmail = ada.email;
    adaToken = (await createApiToken(db, ada.id, "tests", T0)).token;
    rivalToken = (await createApiToken(db, (await createUser(db, "Rival")).id, "tests", T0)).token;
  });

  describe("POST /polls", () => {
    it("requires an API token", async () => {
      const response = await call(createRoute, "/polls", postJson(pollInput()));
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toMatch(/^Bearer/);
      expect(await response.json()).toEqual({
        error: { code: "unauthorized", message: expect.any(String) },
      });
    });

    it("rejects an unknown token", async () => {
      const response = await call(createRoute, "/polls", postJson(pollInput(), { token: `rk_${"z".repeat(32)}` }));
      expect(response.status).toBe(401);
    });

    it("creates a poll for the token's owner", async () => {
      const response = await call(
        createRoute,
        "/polls",
        postJson(pollInput({ title: "Via the API" }), { token: adaToken }),
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toMatchObject({ title: "Via the API", status: "open", ballotCount: 0 });
      expect(body.slug).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/);
      expect(response.headers.get("location")).toBe(`/api/v1/polls/${body.slug}`);
      expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it("reports validation issues", async () => {
      const response = await call(
        createRoute,
        "/polls",
        postJson({ ...pollInput(), options: ["Only one"] }, { token: adaToken }),
      );
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("validation");
      expect(body.error.details.issues).toContainEqual(expect.objectContaining({ path: "options" }));
    });

    it("rejects a body that is not JSON", async () => {
      const response = await call(createRoute, "/polls", { method: "POST", body: "{nope", token: adaToken });
      expect(response.status).toBe(422);
    });

    it("rejects a body over 1 MB, whatever Content-Length claims", async () => {
      const big = JSON.stringify({ ...pollInput(), description: "x".repeat(1_000_001) });
      const response = await call(createRoute, "/polls", { method: "POST", body: big, token: adaToken });
      expect(response.status).toBe(413);

      const lying = await call(createRoute, "/polls", {
        method: "POST",
        body: new Blob([big]).stream(),
        duplex: "half",
        headers: { "content-length": "10" },
        token: adaToken,
      } as CallInit);
      expect(lying.status).toBe(413);
    });
  });

  describe("GET /polls/{slug}", () => {
    it("returns the public view without anything about the owner", async () => {
      const { slug } = await createVia(adaToken);
      const response = await call(getRoute, `/polls/${slug}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const text = await response.text();
      expect(JSON.parse(text)).toMatchObject({ slug, status: "open", options: expect.any(Array) });
      expect(text).not.toContain(adaEmail);
      expect(text).not.toContain("ownerId");
    });

    it("answers 404 for an unknown slug", async () => {
      expect((await call(getRoute, "/polls/nosuchpoll")).status).toBe(404);
    });
  });

  describe("POST /polls/{slug}/close", () => {
    it("closes the owner's poll", async () => {
      const { slug } = await createVia(adaToken);
      now = minutesAfter(5);
      const response = await call(closeRoute, `/polls/${slug}/close`, { method: "POST", token: adaToken });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ slug, status: "closed" });
    });

    it("gives a non-owner exactly the response of an unknown slug", async () => {
      const { slug } = await createVia(adaToken);
      const theirs = await call(closeRoute, `/polls/${slug}/close`, { method: "POST", token: rivalToken });
      const unknown = await call(closeRoute, "/polls/nosuchpoll/close", { method: "POST", token: rivalToken });

      expect(theirs.status).toBe(404);
      expect(unknown.status).toBe(404);
      expect(await theirs.text()).toBe(await unknown.text());
      expect([...theirs.headers]).toEqual([...unknown.headers]);
    });

    it("requires an API token", async () => {
      const { slug } = await createVia(adaToken);
      expect((await call(closeRoute, `/polls/${slug}/close`, { method: "POST" })).status).toBe(401);
    });
  });
});

describe("GET /openapi.json", () => {
  const v1 = fileURLToPath(new URL("../src/app/api/v1", import.meta.url)).replace(/\\/g, "/");
  const routeFiles = readdirSync(v1, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith("route.ts"))
    .map((file) => file.replace(/\\/g, "/"))
    .filter((file) => !file.startsWith("openapi.json/"));

  it("documents every v1 route and method", async () => {
    const response = await getOpenApi();
    const doc = JSON.parse(await response.text());
    expect(doc.openapi).toMatch(/^3\.1\./);
    expect(routeFiles.length).toBeGreaterThan(0);

    for (const file of routeFiles) {
      const path = `/${file.replace(/\/?route\.ts$/, "")}`.replace(/\[(\w+)\]/g, "{$1}");
      const route = await import(`${v1}/${file}`);
      const methods = Object.keys(route).filter((name) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(name));
      expect(Object.keys(doc.paths[path] ?? {}).map((m) => m.toUpperCase()).sort(), path).toEqual(methods.sort());
    }
  });
});
