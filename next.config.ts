import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Cloudflare Pages serves this site at the domain root.
  // Do not set basePath or assetPrefix (those were for GitHub Pages).
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
