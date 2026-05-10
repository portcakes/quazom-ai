import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@quazom-ai/ui", "@quazom-ai/db"],
};

export default nextConfig;
