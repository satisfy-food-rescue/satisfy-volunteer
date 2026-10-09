import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared TypeScript source (dates, domain labels, the mobile API contract).
  transpilePackages: ["@satisfy/core"],
};

export default nextConfig;
