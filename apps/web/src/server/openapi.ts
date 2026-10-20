import { z } from "zod";
import { MAX_BODY_BYTES } from "./http";
import { createPollSchema } from "./polls/schema";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const instant = { type: ["string", "null"], format: "date-time" };
const content = (schema: object) => ({ "application/json": { schema } });

const errorResponse = (description: string) => ({ description, content: content(ref("Error")) });

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const generated: Record<string, unknown> = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  delete generated.$schema;
  return generated;
}

const slugParameter = {
  name: "slug",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "The poll's public slug, as in /p/{slug}.",
};

const pollFields = {
  slug: { type: "string" },
  title: { type: "string" },
  description: { type: "string" },
  seats: { type: "integer", minimum: 1 },
  presetId: { type: "string" },
  maxRanks: { type: ["integer", "null"], minimum: 1 },
  accessMode: { enum: ["link", "codes"] },
  resultsVisibility: { enum: ["live", "after_close", "owner_only"] },
  timeZone: { type: "string", description: "IANA time zone the schedule was entered in." },
  opensAt: instant,
  closesAt: instant,
  closedEarlyAt: instant,
  status: { enum: ["scheduled", "open", "closed"] },
};

const schemas = {
  Error: {
    type: "object",
    required: ["error"],
    properties: {
      error: {
        type: "object",
        required: ["code", "message"],
        properties: { code: { type: "string" }, message: { type: "string" }, details: {} },
      },
    },
  },
  PublicPoll: {
    type: "object",
    required: [...Object.keys(pollFields), "options"],
    properties: {
      ...pollFields,
      options: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "label"],
          properties: { id: { type: "string", format: "uuid" }, label: { type: "string" } },
        },
      },
    },
  },
  OwnerPoll: {
    type: "object",
    properties: {
      ...pollFields,
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      ballotCount: { type: "integer" },
      options: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            label: { type: "string" },
            position: { type: "integer" },
          },
        },
      },
      warnings: {
        type: "array",
        description: "Local times that fell into a DST gap (moved forward) or overlap (earlier instant used).",
        items: {
          type: "object",
          properties: {
            field: { enum: ["opensAt", "closesAt"] },
            code: { enum: ["dst_gap_shifted", "dst_overlap_earlier"] },
          },
        },
      },
    },
  },
  CreatePollInput: jsonSchema(createPollSchema),
};

const pollPaths = {
  "/polls": {
    post: {
      operationId: "createPoll",
      summary: "Create a poll owned by the token's user",
      security: [{ apiToken: [] }],
      requestBody: {
        required: true,
        description: `JSON, at most ${MAX_BODY_BYTES} bytes. Local times are YYYY-MM-DDTHH:mm in timeZone; null opensAtLocal opens now, null closesAtLocal means manual close.`,
        content: content(ref("CreatePollInput")),
      },
      responses: {
        "201": { description: "Created", content: content(ref("OwnerPoll")) },
        "401": errorResponse("Missing or unknown API token"),
        "413": errorResponse("Body too large"),
        "422": errorResponse("Validation failed"),
      },
    },
  },
  "/polls/{slug}": {
    get: {
      operationId: "getPoll",
      summary: "Public view of a poll: options, schedule and status",
      parameters: [slugParameter],
      responses: {
        "200": { description: "The poll", content: content(ref("PublicPoll")) },
        "404": errorResponse("No such poll"),
      },
    },
  },
  "/polls/{slug}/close": {
    post: {
      operationId: "closePoll",
      summary: "Close a poll now",
      description: "Idempotent. A poll owned by someone else answers exactly like an unknown slug.",
      security: [{ apiToken: [] }],
      parameters: [slugParameter],
      responses: {
        "200": { description: "The closed poll", content: content(ref("OwnerPoll")) },
        "401": errorResponse("Missing or unknown API token"),
        "404": errorResponse("No such poll"),
      },
    },
  },
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Recount API",
    version: "1.0.0",
    description: "Ranked-choice polls you can recount.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      apiToken: {
        type: "http",
        scheme: "bearer",
        description: "A personal API token (rk_…) created in settings.",
      },
    },
    schemas,
  },
  // Tabulation, results, CVR and election paths join the polls here.
  paths: { ...pollPaths },
};
