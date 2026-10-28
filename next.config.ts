import type { NextConfig } from "next";

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["better-sqlite3", "@mastra/core"],
};

export default config;
