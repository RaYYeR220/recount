import { liveDeps } from "@/server/api/context";
import { closePollEndpoint } from "@/server/api/polls";

export const POST = closePollEndpoint(liveDeps);
