import { refName, type Schema } from "./operations";

/** A one-line type for a JSON Schema: "Round", "array of string", "map of decimal", "\"link\" | \"codes\"". */
export function typeOf(s: Schema | undefined): string {
  if (!s) return "any";
  if (s.$ref) return refName(s.$ref);
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  const options = s.oneOf ?? s.anyOf;
  if (options) return options.map(typeOf).join(" or ");
  const type = Array.isArray(s.type) ? s.type.join(" | ") : s.type;
  if (type === "array") return `array of ${typeOf(s.items)}`;
  if (s.pattern && type === "string" && s.description?.startsWith("Exact decimal")) return "decimal string";
  if ((type === "object" || type === undefined) && s.additionalProperties && typeof s.additionalProperties === "object") {
    return `map of ${typeOf(s.additionalProperties)}`;
  }
  if (type) return s.format ? `${type} (${s.format})` : type;
  return s.properties ? "object" : "any";
}

/** Limits worth printing next to a type: min and max, items, default. */
export function limitsOf(s: Schema | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  if (s.minimum !== undefined && s.maximum !== undefined) out.push(`${s.minimum}–${s.maximum}`);
  else if (s.minimum !== undefined) out.push(`at least ${s.minimum}`);
  else if (s.maximum !== undefined) out.push(`at most ${s.maximum}`);
  if (s.minItems !== undefined || s.maxItems !== undefined) out.push(`${s.minItems ?? 0}–${s.maxItems ?? "any"} items`);
  if (s.default !== undefined) out.push(`default ${JSON.stringify(s.default)}`);
  return out;
}
