import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't let Next.js auto-generate/overwrite CLAUDE.md — the project's
  // CLAUDE.md is the hand-authored brief and the source of truth.
  agentRules: false,
};

export default nextConfig;
