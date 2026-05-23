import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@quazom-ai/ui"],
  async redirects() {
    return [
      // Quazom is in open alpha; the dedicated /waitlist page was retired in
      // favour of direct sign-up. Anyone landing on the old URL (cached
      // search results, old emails, etc.) should be sent home where the
      // "Sign up" CTA lives.
      {
        source: "/waitlist",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
