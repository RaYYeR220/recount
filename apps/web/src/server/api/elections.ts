import { ELECTIONS_DIR, getElection, listElections } from "../elections";
import { handle, json } from "../http";

type SlugContext = { params: Promise<{ slug: string }> };

/** Replays only change with a deploy, so CDNs may keep them. */
const CACHEABLE = { "cache-control": "public, max-age=300, s-maxage=86400" };

export function electionsEndpoint(dir: string = ELECTIONS_DIR) {
  return handle(async () => json(await listElections(dir), { headers: CACHEABLE }));
}

export function electionEndpoint(dir: string = ELECTIONS_DIR) {
  return handle(async (_req: Request, { params }: SlugContext) => {
    const { slug } = await params;
    return json(await getElection(slug, dir), { headers: CACHEABLE });
  });
}
