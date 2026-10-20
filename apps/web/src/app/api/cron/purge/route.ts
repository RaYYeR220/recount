import { liveDeps } from "@/server/api/context";
import { purgeEndpoint } from "@/server/api/cron";

export const GET = purgeEndpoint(liveDeps);
