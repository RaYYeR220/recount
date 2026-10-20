import { liveDeps } from "@/server/api/context";
import { pollResultsEndpoint } from "@/server/api/results";

export const GET = pollResultsEndpoint(liveDeps);
