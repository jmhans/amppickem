import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // The commissioner xlsx template is read via fs at runtime, not imported —
  // Vercel's build-time file tracing won't find it on its own.
  outputFileTracingIncludes: {
    '/api/picks/export': ['./app/lib/templates/**'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'a.espncdn.com', pathname: '/i/teamlogos/nfl/**' }],
  },
};

export default nextConfig;
