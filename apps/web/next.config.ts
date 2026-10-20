import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: { agentFeedback: false },
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@recount/engine"],
  outputFileTracingIncludes: {
    // The landing counts the NYC replay and the election ledger from these files.
    "/": ["./public/elections/**/*"],
    "/api/v1/elections": ["./public/elections/**/*"],
    "/api/v1/elections/*": ["./public/elections/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
