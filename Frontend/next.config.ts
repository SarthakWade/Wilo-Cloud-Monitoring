import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/data/:path*',
        destination: 'http://localhost:8000/api/file/:path*'
      }
    ];
  }
};

export default nextConfig;