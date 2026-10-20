import { content, errorResponse, ref, slugParameter } from "./common";

const source = {
  type: "object",
  properties: {
    url: { type: "string" },
    sha256: { type: "string" },
    file: { type: "string" },
    retrievedAt: { type: "string" },
    publisher: { type: "string" },
    license: { type: "string" },
    contest: { type: "string" },
  },
};

export const electionSchemas = {
  ElectionSummary: {
    type: "object",
    properties: {
      slug: { type: "string" },
      title: { type: "string" },
      file: { type: "string" },
      bytes: { type: "integer" },
      sha256: { type: "string" },
      ballots: { type: "integer" },
      patterns: { type: "integer" },
      presetId: { type: "string" },
      source,
      golden: { type: ["object", "null"] },
    },
  },
  ElectionReplay: {
    type: "object",
    properties: {
      slug: { type: "string" },
      title: { type: "string" },
      jurisdiction: { type: "string" },
      date: { type: "string" },
      office: { type: "string" },
      seats: { type: "integer" },
      presetId: { type: "string" },
      datasetSha256: { type: "string" },
      source,
      candidates: { type: "array", items: { type: "string" } },
      totalBallots: { type: "integer" },
      undervotes: { type: "integer" },
      rounds: { type: "array", items: ref("Round") },
      winners: { type: "array", items: { type: "string" } },
      rules: ref("Rules"),
      golden: { type: ["object", "null"], description: "Where the official round-by-round numbers came from." },
      comparison: {
        type: ["object", "null"],
        description: "Every number in the official report compared with this count.",
        properties: {
          cells: { type: "integer" },
          matches: { type: "boolean" },
          mismatches: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
};

export const electionPaths = {
  "/elections": {
    get: {
      operationId: "listElections",
      summary: "Certified elections replayed by the engine",
      responses: {
        "200": { description: "The library", content: content({ type: "array", items: ref("ElectionSummary") }) },
      },
    },
  },
  "/elections/{slug}": {
    get: {
      operationId: "getElection",
      summary: "One replay, counted round by round and compared with the official report",
      parameters: [slugParameter],
      responses: {
        "200": { description: "The replay", content: content(ref("ElectionReplay")) },
        "404": errorResponse("No such election"),
      },
    },
  },
};
