import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas ships a native .node binary that Turbopack can't bundle
  // into a JS chunk — opt it out of bundling entirely (FR-7's render module).
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
