import type { z } from "zod";
import { DomainError } from "./errors";

export type Issue = { path: string; message: string };

export function validationError(...issues: Issue[]): DomainError {
  return new DomainError("validation", { issues });
}

export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw validationError(
      ...result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}
