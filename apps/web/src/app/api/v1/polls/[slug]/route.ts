import { liveDeps } from "@/server/api/context";
import { getPollEndpoint } from "@/server/api/polls";

export const GET = getPollEndpoint(liveDeps);
