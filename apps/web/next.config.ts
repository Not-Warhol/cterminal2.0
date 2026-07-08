import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cterminal/core"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
