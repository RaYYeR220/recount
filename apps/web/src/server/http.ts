import { unstable_rethrow } from "next/navigation";
import { DomainError, httpStatus, type DomainErrorCode } from "./errors";
import { validationError } from "./validation";

export const MAX_BODY_BYTES = 1_000_000;

const MESSAGES: Record<DomainErrorCode, string> = {
  not_found: "Not found",
  unauthorized: "A valid API token is required",
  validation: "The request is not valid",
  poll_not_open: "The poll is not open yet",
  poll_closed: "The poll is closed",
  already_voted: "This browser has already voted in this poll",
  code_used: "This invite code has already been used",
  code_required: "This poll needs an invite code",
  code_invalid: "This invite code is not valid for this poll",
  options_locked: "Options cannot change once ballots exist",
  schedule_locked: "This part of the schedule can no longer change",
  hidden_until_close: "Results are hidden until the poll closes",
  rate_limited: "Too many requests, try again later",
  payload_too_large: `The request body is larger than ${MAX_BODY_BYTES} bytes`,
};

export function json(body: unknown, init: { status?: number; headers?: HeadersInit } = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return Response.json(body, { status: init.status ?? 200, headers });
}

function errorResponse(error: DomainError): Response {
  const headers = new Headers();
  if (error.code === "unauthorized") headers.set("www-authenticate", 'Bearer realm="recount"');
  const retryAfter = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
  if (error.code === "rate_limited" && retryAfter) headers.set("retry-after", String(retryAfter));

  const body = {
    error: {
      code: error.code,
      message: MESSAGES[error.code],
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };
  return json(body, { status: httpStatus(error.code), headers });
}

/** Logs only the error's name and SQL state: driver messages can quote query parameters. */
function describe(error: unknown): { name: string; sqlState?: string } {
  let current = error;
  while (current instanceof Error) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return { name: (error as Error).name, sqlState: code };
    current = current.cause;
  }
  return { name: error instanceof Error ? error.name : typeof error };
}

export function handle<Rest extends unknown[]>(
  fn: (req: Request, ...rest: Rest) => Promise<Response>,
): (req: Request, ...rest: Rest) => Promise<Response> {
  return async (req, ...rest) => {
    try {
      return await fn(req, ...rest);
    } catch (error) {
      // Next signals request-time APIs during prerendering by throwing; let it through.
      unstable_rethrow(error);
      if (error instanceof DomainError) return errorResponse(error);
      console.error("Unhandled API error", describe(error));
      return json({ error: { code: "internal", message: "Something went wrong" } }, { status: 500 });
    }
  };
}

/** Reads at most MAX_BODY_BYTES regardless of what Content-Length claims. */
export async function readJson(req: Request): Promise<unknown> {
  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw new DomainError("payload_too_large");
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new DomainError("payload_too_large");
      }
      chunks.push(value);
    }
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw validationError({ path: "", message: "The request body must be JSON" });
  }
}
