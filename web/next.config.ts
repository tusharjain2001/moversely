import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // When the site and the AI run on the same machine (local demo), the browser
  // calls /ai/* and Next.js forwards it, so one public link serves both.
  experimental: {
    // Forwarded requests time out after 30 s by default; a phone uploading a
    // one-minute video on mobile data can take longer than that.
    proxyTimeout: 10 * 60 * 1000,
    // Forwarded request bodies are cut off at 10 MB by default, which is
    // under a minute of video.
    proxyClientMaxBodySize: "500mb",
  },
  async rewrites() {
    const target = process.env.AI_PROXY_TARGET || "http://localhost:8000";
    return [{ source: "/ai/:path*", destination: `${target}/:path*` }];
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
