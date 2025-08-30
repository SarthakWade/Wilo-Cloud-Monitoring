import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/data/:file*.json',
        destination: 'http://localhost:8000/api/file/:file*.csv'
      }
    ];
  }
};

export default nextConfig;