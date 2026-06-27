import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/palmavistahoa",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
