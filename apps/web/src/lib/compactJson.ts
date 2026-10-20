/**
 * JSON.stringify with two-space indents that keeps any object or array that fits
 * in `width` columns on one line, the way people write examples by hand:
 * `{ "Pizza": "6", "Tacos": "4" }` instead of four lines. Parses back to the same value.
 */
export function compactJson(value: unknown, width = 76): string {
  return print(value, "", 0, width);
}

function inline(value: unknown): string {
  if (Array.isArray(value)) return value.length === 0 ? "[]" : `[${value.map(inline).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    return entries.length === 0 ? "{}" : `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(", ")} }`;
  }
  return JSON.stringify(value) ?? "null";
}

/** `lead` is how many columns of the line come before the value (a key and its colon). */
function print(value: unknown, indent: string, lead: number, width: number): string {
  const flat = inline(value);
  if (value === null || typeof value !== "object" || indent.length + lead + flat.length <= width) return flat;
  const inner = `${indent}  `;
  if (Array.isArray(value)) return `[\n${value.map((v) => inner + print(v, inner, 0, width)).join(",\n")}\n${indent}]`;
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  const lines = entries.map(([k, v]) => {
    const key = `${JSON.stringify(k)}: `;
    return `${inner}${key}${print(v, inner, key.length, width)}`;
  });
  return `{\n${lines.join(",\n")}\n${indent}}`;
}
