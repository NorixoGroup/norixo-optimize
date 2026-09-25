import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  async redirects() {
    return [
      {
        source: "/analyze",
        destination: "/free-audit",
        permanent: true,
      },
      {
        source: "/analyze/result",
        destination: "/free-audit",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
