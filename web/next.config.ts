import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e server builds into its own folder so it never clobbers a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // A stray lockfile in the home folder otherwise makes Next guess the wrong workspace root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
