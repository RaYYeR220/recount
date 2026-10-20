import { errorSchema } from "./common";
import { countPaths, countSchemas } from "./counts";
import { electionPaths, electionSchemas } from "./elections";
import { pollPaths, pollSchemas } from "./polls";

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Recount API",
    version: "1.0.0",
    description: "Ranked-choice polls you can recount.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      apiToken: {
        type: "http",
        scheme: "bearer",
        description: "A personal API token (rk_…) created in settings.",
      },
    },
    schemas: { Error: errorSchema, ...pollSchemas, ...countSchemas, ...electionSchemas },
  },
  paths: { ...pollPaths, ...countPaths, ...electionPaths },
};
