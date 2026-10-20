import { z } from "zod";

export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
export const content = (schema: object) => ({ "application/json": { schema } });
export const errorResponse = (description: string) => ({ description, content: content(ref("Error")) });
export const instant = { type: ["string", "null"], format: "date-time" };
export const decimal = { type: "string", pattern: "^-?\\d+(\\.\\d+)?$", description: "Exact decimal, e.g. 4 or 2.3330" };
export const decimalRecord = { type: "object", additionalProperties: decimal };

export function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const generated: Record<string, unknown> = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  delete generated.$schema;
  return generated;
}

export const slugParameter = {
  name: "slug",
  in: "path",
  required: true,
  schema: { type: "string" },
};

export const formatParameter = (formats: string[], description: string) => ({
  name: "format",
  in: "query",
  required: false,
  schema: { enum: formats },
  description,
});

export const optionalToken = [{}, { apiToken: [] }];

export const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" }, details: {} },
    },
  },
};
