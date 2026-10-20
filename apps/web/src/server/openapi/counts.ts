import { MAX_BODY_BYTES } from "../http";
import { MAX_PATTERNS, tabulateInputSchema } from "../tabulation";
import {
  content,
  decimal,
  decimalRecord,
  errorResponse,
  formatParameter,
  jsonSchema,
  optionalToken,
  ref,
  slugParameter,
} from "./common";

const names = { type: "array", items: { type: "string" } };
const nullableName = { type: ["string", "null"] };

export const countSchemas = {
  Round: {
    type: "object",
    properties: {
      round: { type: "integer" },
      tally: decimalRecord,
      activeTotal: decimal,
      threshold: decimal,
      elected: names,
      eliminated: names,
      transfers: {
        type: "array",
        items: {
          type: "object",
          properties: { from: { type: "string" }, to: decimalRecord },
          description: "Votes leaving an elected or eliminated candidate; keys are candidates, exhausted or residualSurplus.",
        },
      },
      inactive: decimalRecord,
      residualSurplus: decimal,
      finalRoundSurplus: decimal,
    },
  },
  Rules: { type: "object", description: "RCTab contest rule options used for the count." },
  RctabSummary: {
    type: "object",
    description: "RCTab detailed report JSON (jsonFormatVersion 1); numbers print like Java BigDecimal.",
    properties: {
      config: { type: "object" },
      jsonFormatVersion: { const: "1" },
      results: { type: "array", items: { type: "object" } },
      summary: { type: "object" },
    },
  },
  PollResults: {
    type: "object",
    properties: {
      status: { enum: ["scheduled", "open", "closed"] },
      totalBallots: { type: "integer" },
      seats: { type: "integer" },
      candidates: names,
      rounds: { type: "array", items: ref("Round") },
      winners: names,
      pairwise: {
        type: "object",
        properties: {
          matrix: {
            type: "object",
            description: "matrix[a][b]: ballots ranking a above b.",
            additionalProperties: { type: "object", additionalProperties: { type: "integer" } },
          },
          condorcetWinner: nullableName,
          condorcetLoser: nullableName,
        },
      },
      condorcetWinner: nullableName,
      pluralityWinner: nullableName,
      isSnapshot: { type: "boolean", description: "True once the poll is closed and the count is frozen." },
      cvrSha256: { type: "string", description: "SHA-256 of the CVR CSV this count was made from." },
      rules: ref("Rules"),
    },
  },
  Cvr: {
    type: "object",
    properties: {
      header: names,
      rows: { type: "array", items: names, description: "One row per ballot, ordered by receipt." },
      sha256: { type: "string" },
    },
  },
  TabulateInput: jsonSchema(tabulateInputSchema),
  Tabulation: {
    type: "object",
    properties: {
      totalBallots: { type: "integer" },
      undervotes: { type: "integer" },
      candidates: names,
      rounds: { type: "array", items: ref("Round") },
      winners: names,
      condorcetWinner: nullableName,
      pluralityWinner: nullableName,
      rules: ref("Rules"),
    },
  },
};

const rctabFormat = formatParameter(["rctab"], "rctab returns RCTab's detailed report JSON instead.");

export const countPaths = {
  "/tabulate": {
    post: {
      operationId: "tabulate",
      summary: "Count ballots you send; nothing is stored",
      parameters: [rctabFormat],
      requestBody: {
        required: true,
        description: `JSON, at most ${MAX_BODY_BYTES} bytes and ${MAX_PATTERNS} ballot patterns. Rate limited per IP.`,
        content: content(ref("TabulateInput")),
      },
      responses: {
        "200": {
          description: "The count",
          content: content({ oneOf: [ref("Tabulation"), ref("RctabSummary")] }),
        },
        "413": errorResponse("Body too large"),
        "422": errorResponse("Validation failed"),
        "429": errorResponse("Too many requests from this address"),
      },
    },
  },
  "/polls/{slug}/results": {
    get: {
      operationId: "getPollResults",
      summary: "Round-by-round results, live while open and frozen once closed",
      description:
        "Visibility follows the poll: live polls answer anyone, after_close polls answer the owner until they close, owner_only polls answer only the owner and look like an unknown slug to everyone else.",
      security: optionalToken,
      parameters: [slugParameter, rctabFormat],
      responses: {
        "200": { description: "The count", content: content({ oneOf: [ref("PollResults"), ref("RctabSummary")] }) },
        "401": errorResponse("An Authorization header was sent but the token is unknown"),
        "403": errorResponse("Results are hidden until the poll closes"),
        "404": errorResponse("No such poll, or its results are private"),
      },
    },
  },
  "/polls/{slug}/cvr": {
    get: {
      operationId: "getPollCvr",
      summary: "Anonymised cast vote record of a closed poll",
      security: optionalToken,
      parameters: [slugParameter, formatParameter(["csv"], "csv returns the exact file the hash covers.")],
      responses: {
        "200": {
          description: "The CVR",
          content: { ...content(ref("Cvr")), "text/csv": { schema: { type: "string" } } },
        },
        "401": errorResponse("An Authorization header was sent but the token is unknown"),
        "404": errorResponse("No such poll, or its results are private"),
        "423": errorResponse("The poll is not closed yet"),
      },
    },
  },
};
