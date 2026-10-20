export type Handler = (req: Request, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;

export type CallInit = RequestInit & { token?: string; ip?: string };

/** Calls a route handler the way Next would, with the slug taken from the path. */
export function call(handler: Handler, path: string, init: CallInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.ip) headers.set("x-real-ip", init.ip);
  const slug = path.split("?")[0].split("/")[2] ?? "";
  const request = new Request(`http://localhost:3000/api/v1${path}`, { ...init, headers });
  return handler(request, { params: Promise.resolve({ slug }) });
}

export function postJson(body: unknown, extra: Omit<CallInit, "body" | "method"> = {}): CallInit {
  return {
    ...extra,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
