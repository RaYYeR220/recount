import { liveDeps } from "@/server/api/context";
import { tabulateEndpoint } from "@/server/api/tabulate";

export const POST = tabulateEndpoint(liveDeps);
