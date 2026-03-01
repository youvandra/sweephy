import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding', '@solana/kit');
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
  turbopack: {
    // Empty config to satisfy Turbopack requirement when using custom webpack config
  },
};

export default nextConfig;
