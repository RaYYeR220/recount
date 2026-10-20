import { openApiDocument } from "@/server/openapi";

export function GET() {
  return Response.json(openApiDocument, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
