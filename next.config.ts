import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
      },
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
        pathname: "/a/**",
      },
    ],
  },
};

export default nextConfig;
