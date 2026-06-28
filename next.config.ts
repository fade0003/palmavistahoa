import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // No basePath needed for Cloudflare Pages (serves from root)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
