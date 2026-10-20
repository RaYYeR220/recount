import { openApiDocument } from "@/server/openapi";

/** A loose view of the parts of OpenAPI 3.1 the reference renders. */
export type Schema = {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  format?: string;
  description?: string;
  items?: Schema;
  oneOf?: Schema[];
  anyOf?: Schema[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: Schema | boolean;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
};

export type Parameter = { name: string; in: string; required?: boolean; description?: string; schema?: Schema };

export type Operation = {
  method: "get" | "post" | "put" | "patch" | "delete";
  /** Path under the server URL, e.g. /polls/{slug}. */
  path: string;
  /** Full path as called, e.g. /api/v1/polls/{slug}. */
  url: string;
  operationId: string;
  summary: string;
  description?: string;
  /** "required", "optional" or "none". */
  auth: "required" | "optional" | "none";
  parameters: Parameter[];
  requestBody?: { description?: string; required?: boolean; content: Record<string, { schema: Schema }> };
  responses: Array<{ status: string; description: string; content?: Record<string, { schema: Schema }> }>;
};

export const API_BASE = openApiDocument.servers[0]!.url;

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

type RawOperation = {
  operationId: string;
  summary: string;
  description?: string;
  security?: Array<Record<string, unknown>>;
  parameters?: Parameter[];
  requestBody?: Operation["requestBody"];
  responses: Record<string, { description: string; content?: Record<string, { schema: Schema }> }>;
};

function authOf(security: RawOperation["security"]): Operation["auth"] {
  if (!security || security.length === 0) return "none";
  return security.some((s) => Object.keys(s).length === 0) ? "optional" : "required";
}

/** Every operation in the OpenAPI document served at /api/v1/openapi.json, in document order. */
export function listOperations(): Operation[] {
  const out: Operation[] = [];
  for (const [path, item] of Object.entries(openApiDocument.paths as Record<string, Record<string, RawOperation>>)) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      out.push({
        method,
        path,
        url: `${API_BASE}${path}`,
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        auth: authOf(op.security),
        parameters: op.parameters ?? [],
        requestBody: op.requestBody,
        responses: Object.entries(op.responses).map(([status, r]) => ({ status, description: r.description, content: r.content })),
      });
    }
  }
  return out;
}

/** Named schemas under components.schemas. */
export function listSchemas(): Array<{ name: string; schema: Schema }> {
  return Object.entries(openApiDocument.components.schemas as Record<string, Schema>).map(([name, schema]) => ({ name, schema }));
}

/** "#/components/schemas/Round" → "Round". */
export function refName(ref: string): string {
  return ref.split("/").at(-1)!;
}
