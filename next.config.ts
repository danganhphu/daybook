import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A screen seen in the last 30 seconds opens from the browser's copy; every change the app makes clears it
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
