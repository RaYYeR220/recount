import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // authInterrupts: forbidden() answers 403 for results hidden until close.
  experimental: { agentFeedback: false, authInterrupts: true },
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@recount/engine"],
  outputFileTracingIncludes: {
    // The landing counts the NYC replay and the election ledger from these files.
    "/": ["./public/elections/**/*"],
    "/api/v1/elections": ["./public/elections/**/*"],
    "/api/v1/elections/*": ["./public/elections/**/*"],
    "/elections": ["./public/elections/**/*"],
    "/elections/*": ["./public/elections/**/*"],
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
