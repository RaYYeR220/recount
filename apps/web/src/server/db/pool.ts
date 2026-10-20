import { neonConfig, Pool } from "@neondatabase/serverless";

/** Host the local docker-compose stack answers on (resolves to 127.0.0.1). */
const LOCAL_HOST = "db.localtest.me";
const LOCAL_PROXY_PORT = 54444;

/**
 * Neon in production; locally the same driver talks to plain Postgres
 * through the WebSocket proxy in docker-compose.yml.
 */
export function createPool(connectionString: string | undefined): Pool {
  if (connectionString && new URL(connectionString).hostname === LOCAL_HOST) {
    neonConfig.wsProxy = (host) => `${host}:${LOCAL_PROXY_PORT}/v1`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  }
  return new Pool({ connectionString });
}
