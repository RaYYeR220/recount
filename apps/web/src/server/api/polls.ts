import { handle, json, readJson } from "../http";
import { closePoll } from "../polls/close";
import { createPoll } from "../polls/create";
import type { PollDetail } from "../polls/detail";
import { getPublicPoll } from "../polls/get";
import type { CreatePollInput } from "../polls/schema";
import { requireApiUser, type ApiDeps } from "./context";

type SlugContext = { params: Promise<{ slug: string }> };

export type OwnerPollView = Omit<PollDetail, "id" | "ownerId">;

/** What the owner sees through the API: the detail minus internal ids. */
export function ownerView(poll: PollDetail): OwnerPollView {
  const view: Partial<PollDetail> = { ...poll };
  delete view.id;
  delete view.ownerId;
  return view as OwnerPollView;
}

export function createPollEndpoint(deps: ApiDeps) {
  return handle(async (req: Request) => {
    const db = deps.db();
    const now = deps.now();
    const userId = await requireApiUser(db, req, now);
    const input = (await readJson(req)) as CreatePollInput;
    const poll = await createPoll(db, userId, input, now);
    return json(ownerView(poll), {
      status: 201,
      headers: { location: `/api/v1/polls/${poll.slug}` },
    });
  });
}

export function getPollEndpoint(deps: ApiDeps) {
  return handle(async (_req: Request, { params }: SlugContext) => {
    const { slug } = await params;
    return json(await getPublicPoll(deps.db(), slug, deps.now()));
  });
}

export function closePollEndpoint(deps: ApiDeps) {
  return handle(async (req: Request, { params }: SlugContext) => {
    const { slug } = await params;
    const db = deps.db();
    const now = deps.now();
    const userId = await requireApiUser(db, req, now);
    return json(ownerView(await closePoll(db, userId, slug, now)));
  });
}
