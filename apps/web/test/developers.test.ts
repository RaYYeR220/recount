import { describe, expect, it } from "vitest";
import { buildEngineExample } from "@/components/developers/engineExample";
import { CREATE_POLL_EXAMPLE, curlFor, examplePath } from "@/components/developers/examples";
import { listOperations, listSchemas } from "@/components/developers/operations";
import { typeOf } from "@/components/developers/schemaText";
import { openApiDocument } from "@/server/openapi";
import { createPollSchema } from "@/server/polls/schema";
import { tabulateInputSchema } from "@/server/tabulation";

const operations = listOperations();
const op = (id: string) => operations.find((o) => o.operationId === id)!;

/** The JSON between -d '…' in a curl line. */
const bodyOf = (curl: string) => JSON.parse(/-d '([\s\S]*)'$/.exec(curl)![1]!) as unknown;

describe("the API reference", () => {
  it("lists every operation in the OpenAPI document, once", () => {
    const fromDocument = Object.entries(openApiDocument.paths).flatMap(([path, item]) => Object.keys(item).map((m) => `${m} /api/v1${path}`));
    expect(operations.map((o) => `${o.method} ${o.url}`).sort()).toEqual(fromDocument.sort());
    expect(listSchemas().map((s) => s.name)).toEqual(Object.keys(openApiDocument.components.schemas));
  });

  it("knows which calls need a token", () => {
    expect(op("createPoll").auth).toBe("required");
    expect(op("getPollResults").auth).toBe("optional");
    expect(op("tabulate").auth).toBe("none");
  });

  it("gives every example a body the server accepts", () => {
    expect(tabulateInputSchema.safeParse(bodyOf(curlFor(op("tabulate"), "$RECOUNT_URL"))).success).toBe(true);
    expect(createPollSchema.safeParse(CREATE_POLL_EXAMPLE).success).toBe(true);
    expect(bodyOf(curlFor(op("createPoll"), "$RECOUNT_URL"))).toEqual(CREATE_POLL_EXAMPLE);
  });

  it("points reads at seeded data and keeps the same lines whatever the origin", () => {
    expect(examplePath(op("getPollCvr"))).toBe("/api/v1/polls/lunch-closed/cvr?format=csv");
    expect(curlFor(op("getElection"), "https://recount.example")).toBe('curl "https://recount.example/api/v1/elections/nyc-2025-dem-mayor"');
    for (const o of operations) {
      expect(curlFor(o, "$RECOUNT_URL").split("\n").length).toBe(curlFor(o, "http://localhost:3203").split("\n").length);
    }
    expect(curlFor(op("closePoll"), "$RECOUNT_URL")).toContain('-H "Authorization: Bearer $RECOUNT_TOKEN"');
  });

  it("writes schema types in one line", () => {
    expect(typeOf({ $ref: "#/components/schemas/Round" })).toBe("Round");
    expect(typeOf({ type: "array", items: { type: "string" } })).toBe("array of string");
    expect(typeOf({ type: ["string", "null"], format: "date-time" })).toBe("string | null (date-time)");
    expect(typeOf({ enum: ["link", "codes"] })).toBe('"link" | "codes"');
    expect(typeOf({ type: "object", additionalProperties: { type: "integer" } })).toBe("map of integer");
  });
});

describe("the engine example", () => {
  it("prints what running it prints", () => {
    const { code, presets } = buildEngineExample();
    expect(code).toContain('result.winners;        // ["Tacos"]');
    expect(code).toContain("result.rounds.length;  // 2");
    expect(code).toContain('// {"Pizza": "6", "Tacos": "7"}');
    expect(presets).toContain("nyc");
  });
});
