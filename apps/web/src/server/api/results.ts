import { handle, json } from "../http";
import { getCvr } from "../results/cvr";
import { getResults, getResultsRctab } from "../results/get";
import { optionalApiUser, type ApiDeps } from "./context";

type SlugContext = { params: Promise<{ slug: string }> };

const wants = (req: Request, format: string) => new URL(req.url).searchParams.get("format") === format;

export function pollResultsEndpoint(deps: ApiDeps) {
  return handle(async (req: Request, { params }: SlugContext) => {
    const { slug } = await params;
    const db = deps.db();
    const now = deps.now();
    const viewerId = await optionalApiUser(db, req, now);
    return json(
      wants(req, "rctab")
        ? await getResultsRctab(db, viewerId, slug, now)
        : await getResults(db, viewerId, slug, now),
    );
  });
}

export function pollCvrEndpoint(deps: ApiDeps) {
  return handle(async (req: Request, { params }: SlugContext) => {
    const { slug } = await params;
    const db = deps.db();
    const now = deps.now();
    const cvr = await getCvr(db, await optionalApiUser(db, req, now), slug, now);
    if (!wants(req, "csv")) return json({ header: cvr.header, rows: cvr.rows, sha256: cvr.sha256 });
    return new Response(cvr.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${slug}-cvr.csv"`,
        "cache-control": "no-store",
        "x-cvr-sha256": cvr.sha256,
      },
    });
  });
}
