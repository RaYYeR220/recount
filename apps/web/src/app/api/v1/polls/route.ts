import { liveDeps } from "@/server/api/context";
import { createPollEndpoint } from "@/server/api/polls";

export const POST = createPollEndpoint(liveDeps);
