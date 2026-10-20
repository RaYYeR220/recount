import { liveDeps } from "@/server/api/context";
import { pollCvrEndpoint } from "@/server/api/results";

export const GET = pollCvrEndpoint(liveDeps);
